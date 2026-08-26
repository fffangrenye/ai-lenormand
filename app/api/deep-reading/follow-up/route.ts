import { NextResponse } from "next/server";
import { DeepFollowUpRequest, assertDeepFollowUpResult } from "@/lib/deep-reading-result";
import { AiFailureReason, consumeDailyQuota, isAdminEmail, requireSupabaseUser, trackServerAnalyticsEvent } from "@/lib/supabase-server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FREE_FOLLOW_UP_LIMIT = 1;
const FOLLOW_UP_USAGE_TRACKING_LIMIT = 1000000;
const FOLLOW_UP_FAILURE_MESSAGE = "这次追问暂时没有生成成功。你的问题已经保留，可以稍后再问一次。";

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

const systemPrompt = `You are a professional Lenormand Reader answering follow-up questions for an existing AI Lenormand Deep Reading.

Core rules:
- You must answer in Simplified Chinese only. Do not output English unless it is a Lenormand card name.
- The cards are already drawn. Do not draw, ask for, or invent new cards.
- Answer only from the existing project context, original question, cards, and generated interpretation.
- This is Lenormand, not Tarot.
- Combination first, individual meanings second.
- Reality facts explicitly provided by the user have priority over divination.
- Avoid absolute predictions. Give clear but probabilistic conclusions.
- Be concise, warm, and specific.
- Keep answer within 260 Chinese characters.

Return exactly one JSON object and nothing else:
{
  "answer": "string"
}

Do not return markdown code fences. Do not return extra fields.`;

function formatCards(cards: DeepFollowUpRequest["cards"]) {
  return cards.map((card) => `${card.cardNumber}. ${card.nameEn} / ${card.nameZh} — ${card.position}`).join("\n");
}

function formatMessages(messages: DeepFollowUpRequest["messages"]) {
  if (!messages.length) return "None";

  return messages.map((message) => `${message.createdAt}\n${message.role.toUpperCase()}:\n${message.content}`).join("\n\n---\n\n");
}

function buildUserPrompt(input: DeepFollowUpRequest) {
  return `Answer the latest user follow-up for this existing Deep Lenormand Reading.

CURRENT DATE:
${input.currentDate}

PROJECT:
${input.project.title}

PROJECT BACKGROUND:
${input.project.background || "None"}

PROJECT MEMORY:
${input.project.memorySummary || "None"}

ORIGINAL QUESTION:
${input.reading.question}

READING ID:
${input.reading.id}

SPREAD TYPE:
${input.reading.spreadType}

CARDS IN ORDER:
${formatCards(input.cards)}

ORIGINAL CORE CONCLUSION:
${input.reading.coreConclusion}

ORIGINAL INTERPRETATION:
${input.reading.interpretation}

TIME WINDOW:
${input.reading.timeWindow ?? "None"}

UNCERTAINTY:
${input.reading.uncertainty || "None"}

FOLLOW-UP CONVERSATION:
${formatMessages(input.messages)}

Use only the existing reading and conversation. Return only the required JSON object.`;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("DeepSeek response did not contain parseable JSON.");
  }
}

async function callDeepSeek(input: DeepFollowUpRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY on the server.");
  }

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      response_format: { type: "json_object" },
      temperature: 0.68,
      max_tokens: 420,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(input) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AiProviderError(response.status, errorText);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>;
  };
  const choice = payload.choices?.[0];
  const content = choice?.message?.content || choice?.message?.reasoning_content;

  if (!content) {
    throw new Error(`DeepSeek response did not include message content. finish_reason=${choice?.finish_reason ?? "unknown"}`);
  }

  return assertDeepFollowUpResult(extractJsonObject(content));
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request);

    const input = (await request.json()) as DeepFollowUpRequest;
    const successfulFollowUps = input.messages.filter((message) => message.role === "assistant" && message.content !== FOLLOW_UP_FAILURE_MESSAGE).length;
    if (!isAdminEmail(user.email) && successfulFollowUps >= FREE_FOLLOW_UP_LIMIT) {
      await trackServerAnalyticsEvent({
        eventName: "quota_exceeded",
        userId: user.id,
        readingId: input.reading.id,
        spreadType: input.reading.spreadType,
        path: "/api/deep-reading/follow-up",
        request,
        properties: { kind: "follow_up", used: successfulFollowUps, limit: FREE_FOLLOW_UP_LIMIT }
      });

      return NextResponse.json(
        {
          code: "QUOTA_EXCEEDED",
          error: "quota_exceeded",
          message: "今日解读次数已用完，请明日再试。",
          quota: { allowed: false, limit: FREE_FOLLOW_UP_LIMIT }
        },
        { status: 429 }
      );
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
        path: "/api/deep-reading/follow-up",
        request,
        properties: {
          failure_reason: reason,
          provider: "deepseek",
          model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
          provider_status: getProviderStatus(error)
        }
      });

      return NextResponse.json(
        {
          code: getPublicErrorCode(reason),
          error: "ai_failed",
          reason,
          message: "解读服务暂时不可用，本次不会消耗解读次数，请点击下方复制移步其他AI进行解读。"
        },
        { status: 503 }
      );
    }

    if (!isAdminEmail(user.email)) {
      await consumeDailyQuota(user.id, "follow_up", FOLLOW_UP_USAGE_TRACKING_LIMIT);
    }

    await trackServerAnalyticsEvent({
      eventName: "ai_success",
      userId: user.id,
      readingId: input.reading.id,
      spreadType: input.reading.spreadType,
      path: "/api/deep-reading/follow-up",
      request,
      properties: {
        provider: "deepseek",
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ code: "UNAUTHORIZED", error: "请重新登录后再追问。" }, { status: 401 });
    }

    return NextResponse.json({ code: "SERVER_ERROR", error: "Follow-up generation failed." }, { status: 500 });
  }
}
