import { RenderedReading, rendererStyles } from "./renderer-types";

export type RendererValidationResult = {
  success: boolean;
  issues: string[];
};

const forbiddenPatterns = [
  /百分百/,
  /100%/,
  /一定/,
  /绝对/,
  /永远不会/,
  /他肯定/,
  /牌明确证实/,
  /宇宙告诉你/,
  /命运注定/,
  /灵魂契约/,
  /高维能量/,
  /显化/,
  /internalScore/,
  /score=\d/,
  /\d+%/,
  /\b(?:[a-z]+_){1,}[a-z0-9]+\b/,
  /\b[a-z]+(?:-[a-z0-9]+)+\b/,
  /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/,
  /\b(?:CARD|PAIR|TRANSITION|OVERRIDE|SEMANTIC|MAIN_PROCESS)_[A-Z0-9_]+\b/,
  /\b[A-Z]{2,}_[A-Z0-9_]+\b/,
  /some pair modes remain close alternatives/i
];

function userVisibleText(reading: RenderedReading) {
  return [
    reading.headline,
    reading.answerLead,
    reading.body,
    reading.conclusion,
    reading.timingNote,
    reading.safetyNote,
    reading.learningDetails?.synthesisReasoning,
    ...(reading.learningDetails?.pairExplanations?.map((item) => item.explanation) ?? []),
    ...(reading.learningDetails?.mirrorExplanations?.map((item) => item.explanation) ?? [])
  ].filter(Boolean).join("\n");
}

export function assertNoInternalTokens(reading: RenderedReading) {
  const issues: string[] = [];
  const text = userVisibleText(reading);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) issues.push(`forbidden phrase or internal detail leaked: ${pattern}`);
  }
  if (/\d+天后|周[一二三四五六日天]|月\d+日/.test(text)) issues.push("exact date wording is not allowed.");
  return issues;
}

export function validateRenderedReading(reading: RenderedReading): RendererValidationResult {
  const issues: string[] = [];
  if (!reading || typeof reading !== "object") return { success: false, issues: ["RenderedReading must be an object."] };
  if (!(rendererStyles as readonly string[]).includes(reading.style)) issues.push("style is invalid.");
  if (!reading.body) issues.push("body is required.");
  if (!reading.engineVersion) issues.push("engineVersion is required.");
  if (reading.metadata?.source !== "rule_engine") issues.push("metadata.source must be rule_engine.");
  if (!reading.metadata?.engineVersion) issues.push("metadata.engineVersion is required.");
  issues.push(...assertNoInternalTokens(reading));
  return { success: issues.length === 0, issues };
}

export function assertValidRenderedReading(reading: RenderedReading) {
  const validation = validateRenderedReading(reading);
  if (!validation.success) throw new Error(`Invalid RenderedReading:\n${validation.issues.join("\n")}`);
  return reading;
}
