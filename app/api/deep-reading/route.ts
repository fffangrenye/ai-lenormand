import { NextResponse } from "next/server";
import { DeepReadingRequest, assertDeepReadingResult } from "@/lib/deep-reading-result";
import { refundDailyQuota, requireSupabaseUser, reserveDailyQuota } from "@/lib/supabase-server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FREE_DEEP_READING_LIMIT = 5;

const systemPrompt = `You are a professional Lenormand Reader for AI Lenormand Deep Reading.

Core rules:
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

SPREAD TYPE:
${input.reading.spreadType}

CARDS IN ORDER:
${formatCards(input.cards)}

Use the Deep Reading rules provided in the system prompt.
Return only the required JSON object.`;
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

async function callDeepSeek(input: DeepReadingRequest) {
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
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(input) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek response did not include message content.");
  }

  return assertDeepReadingResult(extractJsonObject(content));
}

export async function POST(request: Request) {
  let userId = "";
  let quotaReserved = false;

  try {
    const user = await requireSupabaseUser(request);
    userId = user.id;

    const input = (await request.json()) as DeepReadingRequest;
    const quota = await reserveDailyQuota(user.id, "deep_reading", FREE_DEEP_READING_LIMIT);
    if (!quota.allowed) {
      return NextResponse.json({ error: "今日免费 AI 深度解读次数已用完。你仍可以抽牌和保存牌面，明天 00:00 后刷新。", quota }, { status: 429 });
    }

    quotaReserved = true;
    const result = await callDeepSeek(input);
    return NextResponse.json(result);
  } catch (error) {
    if (quotaReserved && userId) {
      await refundDailyQuota(userId, "deep_reading").catch((refundError) => console.error(refundError));
    }

    console.error(error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "请重新登录后再生成 AI 解读。" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Deep Reading generation failed." }, { status: 500 });
  }
}
