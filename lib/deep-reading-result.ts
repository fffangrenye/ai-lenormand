import type { DeepReadingCard, ReadingWithCards } from "./project-store";

export type DeepReadingResult = {
  core_conclusion: string;
  interpretation: string;
  time_window: string | null;
  uncertainty: string;
};

export type DeepFollowUpResult = {
  answer: string;
};

export type DeepReadingRequest = {
  currentDate: string;
  project: {
    title: string;
    background: string;
    memorySummary: string;
  };
  reading: {
    id: string;
    question: string;
    spreadType: ReadingWithCards["spreadType"];
  };
  cards: DeepReadingCard[];
  recentReadings: Array<{
    createdAt: string;
    question: string;
    spreadType: ReadingWithCards["spreadType"];
    cards: DeepReadingCard[];
    coreConclusion: string;
  }>;
  recentProjectMessages?: Array<{
    createdAt: string;
    readingQuestion: string;
    role: "user" | "assistant";
    content: string;
  }>;
};

export type DeepFollowUpRequest = {
  currentDate: string;
  project: {
    title: string;
    background: string;
    memorySummary: string;
  };
  reading: {
    id: string;
    question: string;
    spreadType: ReadingWithCards["spreadType"];
    coreConclusion: string;
    interpretation: string;
    timeWindow: string | null;
    uncertainty: string;
  };
  cards: DeepReadingCard[];
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
};

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} response is not a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNullableString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null) return null;
    if (typeof value === "string") return value.trim() || null;
  }
  return null;
}

function deriveConclusion(text: string) {
  const cleaned = text
    .replace(/^\s*[#>*-]+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  const firstSentence = cleaned.split(/(?<=[。！？!?])/)[0]?.trim() || cleaned;
  return firstSentence.length <= 90 ? firstSentence : `${firstSentence.slice(0, 88)}…`;
}

export function assertDeepReadingResult(value: unknown): DeepReadingResult {
  const record = asRecord(value, "Deep Reading");

  const interpretation = pickString(record, ["interpretation", "analysis", "reading", "content", "answer", "response"]);
  const explicitConclusion = pickString(record, ["core_conclusion", "coreConclusion", "conclusion", "summary"]);
  const coreConclusion = explicitConclusion || deriveConclusion(interpretation);
  const timeWindow = pickNullableString(record, ["time_window", "timeWindow", "timing", "time"]);
  const uncertainty = pickString(record, ["uncertainty", "caveat", "boundary", "limitations"]);

  if (!coreConclusion || !interpretation) {
    throw new Error("Deep Reading response does not contain usable reading content.");
  }

  return {
    core_conclusion: coreConclusion,
    interpretation,
    time_window: timeWindow,
    uncertainty: uncertainty || "牌面提供的是趋势判断，现实发展仍会受到后续选择与外部条件影响。"
  };
}

export function assertDeepFollowUpResult(value: unknown): DeepFollowUpResult {
  const record = asRecord(value, "Follow-up");
  const answer = pickString(record, ["answer", "reply", "response", "content", "interpretation", "analysis"]);

  if (!answer) {
    throw new Error("Follow-up response does not contain a usable answer field.");
  }

  return { answer };
}
