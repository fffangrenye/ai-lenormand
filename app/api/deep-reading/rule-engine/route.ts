import { NextResponse } from "next/server";
import { DeepReadingRequest, assertDeepReadingResult } from "@/lib/deep-reading-result";
import { generateRuleEngineReading, ruleEngineFailureCode } from "@/lib/rule-engine-production";
import { getRuleEngineFeatureFlags, resolveInterpretationSource, spreadSizeForSpreadType } from "@/lib/reading-source";
import { requireSupabaseUser, trackServerAnalyticsEvent } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: DeepReadingRequest | undefined;
  try {
    const user = await requireSupabaseUser(request);
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

    await trackServerAnalyticsEvent({
      eventName: "reading_generation_success",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading/rule-engine",
      request,
      properties: {
        source: "rule_engine",
        rule_engine_version: result.ruleEngineVersion,
        rule_engine_schema_version: result.ruleEngineSchemaVersion
      }
    });

    return NextResponse.json({
      ...assertDeepReadingResult(result.deepReadingResult),
      interpretation_source: "rule_engine",
      rule_engine_version: result.ruleEngineVersion,
      rule_engine_schema_version: result.ruleEngineSchemaVersion,
      rule_engine_result: result.ruleEngineResult
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
