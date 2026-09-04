import type { InterpretationSource } from "./reading-source";
import type { DeepReadingCard, ReadingWithCards } from "./project-store";

export type DeepReadingResult = {
  core_conclusion: string;
  interpretation: string;
  time_window: string | null;
  uncertainty: string;
  interpretation_source?: InterpretationSource;
  rule_engine_version?: string | null;
  rule_engine_schema_version?: string | null;
  rule_engine_result?: unknown;
  generation_error_code?: string | null;
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
    interpretationSource?: InterpretationSource;
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
    interpretationSource?: InterpretationSource;
    ruleEngineSummary?: unknown;
  };
  cards: DeepReadingCard[];
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
};

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function hasKey(record: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => key in record);
}

export function assertDeepReadingResult(value: unknown): DeepReadingResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Deep Reading response is not a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const coreConclusion = pickString(record, ["core_conclusion", "coreConclusion", "conclusion", "summary"]);
  const interpretation = pickString(record, ["interpretation", "analysis", "reading", "content"]);
  const uncertainty = pickString(record, ["uncertainty", "caveat", "boundary", "limitations"]);
  const timeWindowValue =
    record.time_window ?? record.timeWindow ?? record.timing ?? record.time ?? (hasKey(record, ["time_window", "timeWindow", "timing", "time"]) ? null : null);

  if (!coreConclusion || !interpretation) {
    throw new Error("Deep Reading response does not match the required schema.");
  }

  if (!(typeof timeWindowValue === "string" || timeWindowValue === null || typeof timeWindowValue === "undefined")) {
    throw new Error("Deep Reading response has invalid field types.");
  }

  return {
    core_conclusion: coreConclusion,
    interpretation,
    time_window: typeof timeWindowValue === "string" ? timeWindowValue.trim() || null : null,
    uncertainty,
    interpretation_source: record.interpretation_source === "rule_engine" ? "rule_engine" : record.interpretation_source === "ai" ? "ai" : undefined,
    rule_engine_version: typeof record.rule_engine_version === "string" ? record.rule_engine_version : null,
    rule_engine_schema_version: typeof record.rule_engine_schema_version === "string" ? record.rule_engine_schema_version : null,
    rule_engine_result: record.rule_engine_result,
    generation_error_code: typeof record.generation_error_code === "string" ? record.generation_error_code : null
  };
}

export function assertDeepFollowUpResult(value: unknown): DeepFollowUpResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Follow-up response is not a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const answer = pickString(record, ["answer", "reply", "response", "content"]);
  if (!answer) {
    throw new Error("Follow-up response does not match the required schema.");
  }

  return {
    answer
  };
}
