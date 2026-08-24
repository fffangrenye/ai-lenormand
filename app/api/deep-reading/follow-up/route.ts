import { NextResponse } from "next/server";
import { DeepFollowUpRequest, assertDeepFollowUpResult } from "@/lib/deep-reading-result";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const systemPrompt = `You are a professional Lenormand Reader answering follow-up questions for an existing AI Lenormand Deep Reading.

Core rules:
- The cards are already drawn. Do not draw, ask for, or invent new cards.
- Answer only from the existing project context, original question, cards, and generated interpretation.
- This is Lenormand, not Tarot.
- Combination first, individual meanings second.
- Reality facts explicitly provided by the user have priority over divination.
- Avoid absolute predictions. Give clear but probabilistic conclusions.
- Be concise, warm, and specific.

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

  return assertDeepFollowUpResult(extractJsonObject(content));
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as DeepFollowUpRequest;
    const result = await callDeepSeek(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Follow-up generation failed." }, { status: 500 });
  }
}
