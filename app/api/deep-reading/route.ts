import { NextResponse } from "next/server";
import { buildAiResponseDiagnostics, DeepSeekPayload } from "@/lib/ai-response-diagnostics";
import { parseAiJsonObject } from "@/lib/ai-json";
import { DeepReadingRequest, assertDeepReadingResult } from "@/lib/deep-reading-result";
import {
  AiFailureReason,
  checkDailyQuota,
  consumeDailyQuota,
  isAdminEmail,
  requireSupabaseUser,
  trackServerAnalyticsEvent
} from "@/lib/supabase-server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FREE_DEEP_READING_LIMIT = 5;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

class AiProviderError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`DeepSeek API error ${status}: ${body.slice(0, 500)}`);
    this.name = "AiProviderError";
    this.status = status;
    this.body = body;
  }
}

class InvalidAiResponseError extends Error {
  diagnostics?: ReturnType<typeof buildAiResponseDiagnostics>;

  constructor(message: string, diagnostics?: ReturnType<typeof buildAiResponseDiagnostics>) {
    super(message);
    this.name = "InvalidAiResponseError";
    this.diagnostics = diagnostics;
  }
}

function classifyAIError(error: unknown): AiFailureReason {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const status = typeof record.status === "number" ? record.status : undefined;
  const message = String(record.message ?? "").toLowerCase();
  const body = String(record.body ?? "").toLowerCase();
  const text = `${message} ${body}`;

  if (status === 402 || text.includes("insufficient balance") || text.includes("balance insufficient") || text.includes("余额不足")) {
    return "insufficient_balance";
  }
  if (status === 429) return "rate_limited";
  if (record.name === "AbortError" || text.includes("timeout")) return "timeout";
  if (text.includes("json") || text.includes("schema") || text.includes("parse")) return "invalid_response";
  if (status && status >= 500 && status <= 599) return "provider_error";
  if (text.includes("network") || text.includes("fetch failed")) return "network_error";
  return "unknown";
}

function getPublicErrorCode(reason: AiFailureReason) {
  switch (reason) {
    case "insufficient_balance":
      return "AI_PROVIDER_BALANCE_INSUFFICIENT";
    case "rate_limited":
      return "AI_PROVIDER_RATE_LIMITED";
    default:
      return "AI_GENERATION_FAILED";
  }
}

function getProviderStatus(error: unknown) {
  return error && typeof error === "object" && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null;
}

function isInvalidResponseError(error: unknown) {
  if (error instanceof Error && error.name === "InvalidAiResponseError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("json") || message.includes("schema") || message.includes("parse");
}

function getDiagnostics(error: unknown) {
  return error instanceof InvalidAiResponseError ? error.diagnostics : undefined;
}

const systemPrompt = `You are a professional Lenormand Reader for Flora Lenormand Deep Reading.

Core rules:
- You must answer in Simplified Chinese only. Do not output English unless it is a Lenormand card name.
- Combination first, individual meanings second.
- This is Lenormand, not Tarot.
- Always answer the user's current question first.
- Never invent missing project history or real-world facts.
- Reality facts explicitly provided by the user have priority over divination.
- For three_card, read 1+2, 2+3, then 1+2+3 as a continuous development.
- For five_card_linear, Card 3 is the core theme. Read 1+2, 2+3, 3+4, 4+5, then the whole five-card process.
- Do not mechanically explain each card as an encyclopedia entry.
- Fox is not automatically cheating. Snake is not automatically a third party. Ring is not automatically marriage.
- Avoid absolute predictions. Give clear but probabilistic conclusions.
- If time is not supported, set time_window to null.
- Keep the response compact enough to fit safely in JSON: core_conclusion about 1-2 sentences, interpretation about 300-500 Chinese characters, uncertainty about 1-2 sentences.

Return exactly one JSON object and nothing else:
{
  "core_conclusion": "string",
  "interpretation": "string",
  "time_window": null,
  "uncertainty": "string"
}

Do not return markdown code fences. Do not return extra fields.`;

function formatCards(cards: DeepReadingRequest["cards"]) {
  return cards.map((card) => `${card.cardNumber}. ${card.nameEn} / ${card.nameZh} — ${card.position}`).join("\n");
}

function formatRecentReadings(readings: DeepReadingRequest["recentReadings"]) {
  if (!readings.length) return "None";

  return readings
    .map(
      (reading) =>
        `Reading Date:\n${reading.createdAt}\n\nQuestion:\n${reading.question}\n\nSpread:\n${reading.spreadType}\n\nCards:\n${reading.cards
          .map((card) => `${card.cardNumber}. ${card.nameEn} / ${card.nameZh} — ${card.position}`)
          .join("\n")}\n\nCore Conclusion:\n${reading.coreConclusion}`
    )
    .join("\n\n---\n\n");
}

function formatRecentProjectMessages(messages: NonNullable<DeepReadingRequest["recentProjectMessages"]>) {
  if (!messages.length) return "None";

  return messages
    .map((message) => `${message.createdAt}\nReading Question:\n${message.readingQuestion}\n\n${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n---\n\n");
}

function buildUserPrompt(input: DeepReadingRequest) {
  return `You are performing a Deep Lenormand Reading.

CURRENT DATE:
${input.currentDate}

PROJECT:
${input.project.title}

PROJECT BACKGROUND:
${input.project.background || "None"}

PROJECT MEMORY:
${input.project.memorySummary || "None"}

RELEVANT PREVIOUS READINGS:
${formatRecentReadings(input.recentReadings)}

RECENT PROJECT MESSAGES:
${formatRecentProjectMessages(input.recentProjectMessages ?? [])}

CURRENT QUESTION:
${input.reading.question}

READING ID:
${input.reading.id}

SPREAD TYPE:
${input.reading.spreadType}

CARDS IN ORDER:
${formatCards(input.cards)}

Use the Deep Reading rules provided in the system prompt.
Return only the required JSON object.`;
}

async function requestDeepSeekContent(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AiProviderError(response.status, errorText);
  }

  const payload = (await response.json()) as DeepSeekPayload;
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  const diagnostics = buildAiResponseDiagnostics(payload);

  if (typeof content !== "string" || !content.trim()) {
    throw new InvalidAiResponseError(`DeepSeek response did not include usable message.content. finish_reason=${choice?.finish_reason ?? "unknown"}`, diagnostics);
  }

  return { content, diagnostics };
}

async function callDeepSeek(input: DeepReadingRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY on the server.");
  }

  const { content, diagnostics } = await requestDeepSeekContent(apiKey, {
    model: DEEPSEEK_MODEL,
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    temperature: 0.35,
    max_tokens: 1400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(input) }
    ]
  });

  try {
    return assertDeepReadingResult(parseAiJsonObject(content));
  } catch (error) {
    if (!isInvalidResponseError(error)) throw error;
    throw new InvalidAiResponseError(error instanceof Error ? error.message : "DeepSeek response could not be parsed.", diagnostics);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request);
    const input = (await request.json()) as DeepReadingRequest;

    await trackServerAnalyticsEvent({
      eventName: "reading_generation_started",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading",
      request,
      properties: { source: "ai" }
    });

    if (!isAdminEmail(user.email)) {
      const quota = await checkDailyQuota(user.id, "deep_reading", FREE_DEEP_READING_LIMIT);
      if (!quota.allowed) {
        await trackServerAnalyticsEvent({
          eventName: "quota_exceeded",
          userId: user.id,
          readingId: input.reading.id,
          spreadType: input.reading.spreadType,
          path: "/api/deep-reading",
          request,
          properties: { kind: "deep_reading", quota }
        });

        return NextResponse.json(
          {
            code: "QUOTA_EXCEEDED",
            error: "quota_exceeded",
            message: "今日 AI 解读额度已用完",
            quota
          },
          { status: 429 }
        );
      }
    }

    let result;
    try {
      result = await callDeepSeek(input);
    } catch (error) {
      const reason = classifyAIError(error);
      await trackServerAnalyticsEvent({
        eventName: "ai_failed",
        userId: user.id,
        readingId: input.reading.id,
        spreadType: input.reading.spreadType,
        path: "/api/deep-reading",
        request,
        properties: {
          failure_reason: reason,
          provider: "deepseek",
          model: DEEPSEEK_MODEL,
          provider_status: getProviderStatus(error),
          diagnostics: getDiagnostics(error)
        }
      });
      await trackServerAnalyticsEvent({
        eventName: "reading_generation_failed",
        userId: user.id,
        readingId: input.reading.id,
        spreadType: input.reading.spreadType,
        path: "/api/deep-reading",
        request,
        properties: {
          source: "ai",
          failure_reason: reason,
          provider: "deepseek",
          model: DEEPSEEK_MODEL
        }
      });

      return NextResponse.json(
        {
          code: getPublicErrorCode(reason),
          error: "ai_failed",
          reason,
          message: "AI 服务暂时不可用，请复制prompt后移步其他AI"
        },
        { status: 503 }
      );
    }

    if (!isAdminEmail(user.email)) {
      const consumed = await consumeDailyQuota(user.id, "deep_reading", FREE_DEEP_READING_LIMIT);
      if (!consumed.allowed) {
        await trackServerAnalyticsEvent({
          eventName: "quota_exceeded",
          userId: user.id,
          readingId: input.reading.id,
          spreadType: input.reading.spreadType,
          path: "/api/deep-reading",
          request,
          properties: { kind: "deep_reading", quota: consumed, after_ai_success: true }
        });

        return NextResponse.json(
          {
            code: "QUOTA_EXCEEDED",
            error: "quota_exceeded",
            message: "今日 AI 解读额度已用完",
            quota: consumed
          },
          { status: 429 }
        );
      }
    }

    await trackServerAnalyticsEvent({
      eventName: "ai_success",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading",
      request,
      properties: {
        provider: "deepseek",
        model: DEEPSEEK_MODEL
      }
    });
    await trackServerAnalyticsEvent({
      eventName: "reading_generation_success",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading",
      request,
      properties: {
        source: "ai",
        provider: "deepseek",
        model: DEEPSEEK_MODEL
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ code: "UNAUTHORIZED", error: "请重新登录后再生成 AI 解读。" }, { status: 401 });
    }

    return NextResponse.json({ code: "SERVER_ERROR", error: "Deep Reading generation failed." }, { status: 500 });
  }
}
