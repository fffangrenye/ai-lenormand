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

export function assertDeepReadingResult(value: unknown): DeepReadingResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Deep Reading response is not a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = ["core_conclusion", "interpretation", "time_window", "uncertainty"];
  const keys = Object.keys(record);

  const hasOnlyExpectedKeys = keys.every((key) => allowedKeys.includes(key)) && allowedKeys.every((key) => key in record);
  if (!hasOnlyExpectedKeys) {
    throw new Error("Deep Reading response does not match the required schema.");
  }

  if (
    typeof record.core_conclusion !== "string" ||
    typeof record.interpretation !== "string" ||
    !(typeof record.time_window === "string" || record.time_window === null) ||
    typeof record.uncertainty !== "string"
  ) {
    throw new Error("Deep Reading response has invalid field types.");
  }

  return {
    core_conclusion: record.core_conclusion.trim(),
    interpretation: record.interpretation.trim(),
    time_window: typeof record.time_window === "string" ? record.time_window.trim() || null : null,
    uncertainty: record.uncertainty.trim()
  };
}

export function assertDeepFollowUpResult(value: unknown): DeepFollowUpResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Follow-up response is not a JSON object.");
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.answer !== "string") {
    throw new Error("Follow-up response does not match the required schema.");
  }

  return {
    answer: record.answer.trim()
  };
}
