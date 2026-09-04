export type InterpretationSource = "ai" | "rule_engine";

export type RuleEngineFeatureFlags = {
  enabled: boolean;
  defaultSource: InterpretationSource;
  explicitOverrideAllowed: boolean;
  rolloutPercent: number;
};

export type SourceResolutionReason =
  | "rule_engine_disabled"
  | "rule_engine_unavailable"
  | "unsupported_spread"
  | "explicit_rule_engine"
  | "rollout_rule_engine"
  | "rollout_ai"
  | "default_rule_engine"
  | "default_ai";

export type SourceResolutionInput = {
  flags: RuleEngineFeatureFlags;
  spreadSize: number;
  explicitSource?: InterpretationSource;
  ruleEngineAvailable?: boolean;
  cohortKey?: string;
};

export type SourceResolution = {
  source: InterpretationSource;
  eligible: boolean;
  reason: SourceResolutionReason;
  rolloutBucket?: number;
};

export function getRuleEngineFeatureFlags(env: Record<string, string | undefined> = process.env): RuleEngineFeatureFlags {
  const enabled = parseBoolean(env.RULE_ENGINE_ENABLED, false);
  const defaultRule = parseBoolean(env.RULE_ENGINE_DEFAULT, false);
  return {
    enabled,
    defaultSource: enabled && defaultRule ? "rule_engine" : "ai",
    explicitOverrideAllowed: parseBoolean(env.RULE_ENGINE_ALLOW_EXPLICIT, env.NODE_ENV === "development"),
    rolloutPercent: parseRolloutPercent(env.RULE_ENGINE_ROLLOUT_PERCENT)
  };
}

export function spreadSizeForSpreadType(spreadType: string): number {
  if (spreadType === "three_card") return 3;
  if (spreadType === "five_card_linear") return 5;
  return 0;
}

export function isRuleEngineEligible(input: { spreadSize: number }) {
  return input.spreadSize === 3 || input.spreadSize === 5;
}

export function resolveInterpretationSource(input: SourceResolutionInput): SourceResolution {
  const eligible = isRuleEngineEligible({ spreadSize: input.spreadSize });
  const available = input.ruleEngineAvailable ?? true;

  if (!input.flags.enabled) return { source: "ai", eligible, reason: "rule_engine_disabled" };
  if (!available) return { source: "ai", eligible, reason: "rule_engine_unavailable" };
  if (!eligible) return { source: "ai", eligible, reason: "unsupported_spread" };
  if (input.explicitSource === "rule_engine" && input.flags.explicitOverrideAllowed) {
    return { source: "rule_engine", eligible, reason: "explicit_rule_engine" };
  }
  const bucket = input.cohortKey ? stablePercentBucket(input.cohortKey) : undefined;
  if (bucket !== undefined && input.flags.rolloutPercent > 0) {
    return bucket < input.flags.rolloutPercent
      ? { source: "rule_engine", eligible, reason: "rollout_rule_engine", rolloutBucket: bucket }
      : { source: "ai", eligible, reason: "rollout_ai", rolloutBucket: bucket };
  }
  if (input.flags.defaultSource === "rule_engine") return { source: "rule_engine", eligible, reason: "default_rule_engine" };
  return { source: "ai", eligible, reason: "default_ai" };
}

export function stablePercentBucket(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

export function getEffectiveInterpretationSource(source: InterpretationSource | null | undefined): InterpretationSource {
  return source === "rule_engine" ? "rule_engine" : "ai";
}

export function validateReadingSourceIntegrity(input: {
  interpretationSource?: InterpretationSource | null;
  ruleEngineVersion?: string | null;
  ruleEngineResult?: unknown | null;
}) {
  const source = getEffectiveInterpretationSource(input.interpretationSource);
  const issues: string[] = [];
  if (source === "rule_engine") {
    if (!input.ruleEngineVersion) issues.push("rule_engine_version_required");
    if (!input.ruleEngineResult) issues.push("rule_engine_result_required");
  }
  if (source === "ai") {
    if (input.ruleEngineVersion) issues.push("ai_rule_engine_version_must_be_null");
    if (input.ruleEngineResult) issues.push("ai_rule_engine_result_must_be_null");
  }
  return {
    source,
    valid: issues.length === 0,
    issues
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseRolloutPercent(value: string | undefined) {
  if (value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.floor(parsed)));
}
