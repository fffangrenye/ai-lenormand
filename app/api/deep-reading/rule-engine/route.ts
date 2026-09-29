import { NextResponse } from "next/server";
import { buildAiResponseDiagnostics, DeepSeekPayload } from "@/lib/ai-response-diagnostics";
import { DeepReadingRequest, assertDeepReadingResult } from "@/lib/deep-reading-result";
import { generateRuleEngineReading, ruleEngineFailureCode } from "@/lib/rule-engine-production";
import { AiVerbalizerClient, deterministicVerbalizerFallback, verbalizeWithAiGuard } from "@/lib/rule-engine/ai-verbalizer";
import { getRuleEngineFeatureFlags, resolveInterpretationSource, spreadSizeForSpreadType } from "@/lib/reading-source";
import { getRuleEngineOwnerTrialAccess } from "@/lib/rule-engine-owner-trial";
import { requireSupabaseUser, trackServerAnalyticsEvent } from "@/lib/supabase-server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

class AiVerbalizerProviderError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`DeepSeek verbalizer error ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

export async function POST(request: Request) {
  let input: DeepReadingRequest | undefined;
  try {
    const user = await requireSupabaseUser(request);
    const access = getRuleEngineOwnerTrialAccess(user);
    if (!access.allowed) {
      return NextResponse.json({ code: "RULE_ENGINE_TRIAL_FORBIDDEN", error: access.reason }, { status: 403 });
    }
    input = (await request.json()) as DeepReadingRequest;
    const resolution = resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags(),
      spreadSize: spreadSizeForSpreadType(input.reading.spreadType),
      explicitSource: "rule_engine",
      cohortKey: user.id
    });

    if (resolution.source !== "rule_engine") {
      return NextResponse.json({ code: "RULE_ENGINE_NOT_AVAILABLE", error: resolution.reason }, { status: 400 });
    }

    await trackServerAnalyticsEvent({
      eventName: "reading_generation_started",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading/rule-engine",
      request,
      properties: { source: "rule_engine" }
    });

    const result = generateRuleEngineReading({
      question: input.reading.question,
      spreadType: input.reading.spreadType,
      cards: input.cards
    });
    const verbalization = await verbalizeRuleEngineResult(result.ruleEngineResult.interpretationPlan);
    const finalResult = {
      ...result,
      deepReadingResult: verbalization.result,
      ruleEngineResult: {
        ...result.ruleEngineResult,
        verbalization: {
          source: verbalization.source,
          attempts: verbalization.attempts,
          validationIssues: verbalization.validationIssues
        }
      }
    };

    await trackServerAnalyticsEvent({
      eventName: "reading_generation_success",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading/rule-engine",
      request,
      properties: {
        source: "rule_engine",
        rule_engine_version: finalResult.ruleEngineVersion,
        rule_engine_schema_version: finalResult.ruleEngineSchemaVersion,
        verbalization_source: verbalization.source,
        verbalization_attempts: verbalization.attempts
      }
    });

    return NextResponse.json({
      ...assertDeepReadingResult(finalResult.deepReadingResult),
      interpretation_source: "rule_engine",
      rule_engine_version: finalResult.ruleEngineVersion,
      rule_engine_schema_version: finalResult.ruleEngineSchemaVersion,
      rule_engine_result: finalResult.ruleEngineResult
    });
  } catch (error) {
    const code = ruleEngineFailureCode(error);
    await trackServerAnalyticsEvent({
      eventName: "reading_generation_failed",
      readingId: input?.reading.id,
      spreadType: input?.reading.spreadType,
      path: "/api/deep-reading/rule-engine",
      request,
      properties: {
        source: "rule_engine",
        failure_code: code
      }
    });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ code: "UNAUTHORIZED", error: "请重新登录后再生成规则解读。" }, { status: 401 });
    }
    return NextResponse.json({ code, error: "rule_engine_failed", message: "规则解读暂时没有生成成功。" }, { status: 503 });
  }
}

async function verbalizeRuleEngineResult(plan: Parameters<typeof deterministicVerbalizerFallback>[0]) {
  try {
    return await verbalizeWithAiGuard(plan, deepSeekVerbalizerClient);
  } catch (error) {
    return {
      result: deterministicVerbalizerFallback(plan),
      source: "deterministic_fallback" as const,
      attempts: 0,
      validationIssues: [error instanceof Error ? error.message : "verbalizer_unavailable"]
    };
  }
}

const deepSeekVerbalizerClient: AiVerbalizerClient = async (messages) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY on the server.");

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: 1200,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AiVerbalizerProviderError(response.status, errorText);
  }

  const payload = (await response.json()) as DeepSeekPayload;
  const content = payload.choices?.[0]?.message?.content;
  const diagnostics = buildAiResponseDiagnostics(payload);
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`DeepSeek verbalizer did not include usable message.content. finish_reason=${payload.choices?.[0]?.finish_reason ?? "unknown"} diagnostics=${JSON.stringify(diagnostics)}`);
  }
  return content;
};
