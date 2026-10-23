import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function summarizeAiUsage(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (!valid(data.prompt_tokens) || !valid(data.completion_tokens)) return null;
  const cached = valid(data.prompt_cache_hit_tokens) ? Math.min(data.prompt_tokens, data.prompt_cache_hit_tokens) : 0;
  return { promptTokens: data.prompt_tokens, cachedInputTokens: cached, uncachedInputTokens: data.prompt_tokens - cached, completionTokens: data.completion_tokens, totalTokens: data.prompt_tokens + data.completion_tokens };
}

export function recordLocalAiUsage(context: { readingId: string; kind: "main" | "follow-up" }, model: string, raw: unknown, durationMs: number) {
  if (process.env.PAID_LOCAL_MODE !== "1" || process.env.NODE_ENV !== "development") return;
  const usage = summarizeAiUsage(raw); if (!usage) return;
  // Reference prices checked 2026-10-21. A range avoids guessing peak hours/holiday rules.
  const flash = /^deepseek-(?:flash|v4-flash)(?:$|-)/.test(model);
  const offPeakCny = (usage.uncachedInputTokens + usage.cachedInputTokens * 0.02 + usage.completionTokens * 4) / 1_000_000;
  const record = { at: new Date().toISOString(), ...context, model, ...usage, durationMs, ...(flash ? { referencePriceDate: "2026-10-21", estimatedOffPeakCny: offPeakCny, estimatedPeakCny: offPeakCny * 2 } : {}) };
  try {
    const directory = path.join(process.cwd(), ".local-paid"); mkdirSync(directory, { recursive: true });
    appendFileSync(path.join(directory, "ai-usage.jsonl"), JSON.stringify(record) + "\n", "utf8");
  } catch { console.warn("LOCAL_AI_USAGE_LOG_UNAVAILABLE"); }
}
