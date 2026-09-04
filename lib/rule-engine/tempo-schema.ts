import {
  blockingStates,
  dominantDurations,
  dominantTempos,
  tempoCompatibilityValues,
  TempoCompatibilityInput,
  TempoCompatibilityResult,
  tempoEvidenceSources,
  tempoEvidenceStrengths
} from "./tempo-types";

export type TempoValidationResult = {
  success: boolean;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function validateString(value: unknown, path: string, issues: string[]) {
  if (typeof value !== "string" || !value) issues.push(`${path} is required.`);
}

export function validateTempoCompatibilityInput(input: TempoCompatibilityInput): TempoValidationResult {
  const issues: string[] = [];
  if (!input.question?.timeframe) issues.push("question.timeframe is required.");
  if (!Array.isArray(input.resolvedCards) || !input.resolvedCards.length) issues.push("resolvedCards must contain at least one card.");
  if (!input.spread) issues.push("spread is required.");
  if (!input.synthesis) issues.push("synthesis is required.");
  if (input.spread && input.resolvedCards) {
    const spreadCards = new Set(input.spread.forwardChain.cardIds);
    for (const card of input.resolvedCards) {
      if (!spreadCards.has(card.cardId)) issues.push(`resolvedCards contains card ${card.cardId} outside spread.`);
    }
  }
  return { success: issues.length === 0, issues };
}

export function assertValidTempoCompatibilityInput(input: TempoCompatibilityInput) {
  const result = validateTempoCompatibilityInput(input);
  if (!result.success) throw new Error(`Invalid TempoCompatibilityInput:\n${result.issues.join("\n")}`);
  return input;
}

export function validateTempoCompatibilityResult(result: TempoCompatibilityResult): TempoValidationResult {
  const issues: string[] = [];
  if (!isRecord(result)) return { success: false, issues: ["TempoCompatibilityResult must be an object."] };
  if (result.compatibilityTarget !== "semantic_process") issues.push("compatibilityTarget must be semantic_process.");
  if (!result.timeframe) issues.push("timeframe is required.");
  if (!isOneOf(result.dominantTempo, dominantTempos)) issues.push("dominantTempo is invalid.");
  if (!isOneOf(result.dominantDuration, dominantDurations)) issues.push("dominantDuration is invalid.");
  if (!isOneOf(result.compatibility, tempoCompatibilityValues)) issues.push("compatibility is invalid.");
  if (!isOneOf(result.confidence, ["high", "medium", "low"] as const)) issues.push("confidence is invalid.");
  validateString(result.engineVersion, "engineVersion", issues);
  if (!Array.isArray(result.tempoEvidence)) issues.push("tempoEvidence must be an array.");
  result.tempoEvidence?.forEach((item, index) => {
    if (!isOneOf(item.sourceType, tempoEvidenceSources)) issues.push(`tempoEvidence[${index}].sourceType is invalid.`);
    if (!isOneOf(item.strength, tempoEvidenceStrengths)) issues.push(`tempoEvidence[${index}].strength is invalid.`);
    validateString(item.sourceRef, `tempoEvidence[${index}].sourceRef`, issues);
    validateString(item.reasonCode, `tempoEvidence[${index}].reasonCode`, issues);
  });
  if (!Array.isArray(result.durationEvidence)) issues.push("durationEvidence must be an array.");
  result.durationEvidence?.forEach((item, index) => {
    if (!isOneOf(item.sourceType, tempoEvidenceSources)) issues.push(`durationEvidence[${index}].sourceType is invalid.`);
    if (!isOneOf(item.duration, dominantDurations)) issues.push(`durationEvidence[${index}].duration is invalid.`);
    if (!isOneOf(item.strength, tempoEvidenceStrengths)) issues.push(`durationEvidence[${index}].strength is invalid.`);
    validateString(item.sourceRef, `durationEvidence[${index}].sourceRef`, issues);
    validateString(item.reasonCode, `durationEvidence[${index}].reasonCode`, issues);
  });
  if (result.processAdjustment && !isOneOf(result.processAdjustment.toTempo, dominantTempos)) issues.push("processAdjustment.toTempo is invalid.");
  result.conditions?.forEach((condition, index) => validateString(condition.concept, `conditions[${index}].concept`, issues));
  result.warnings?.forEach((warning, index) => validateString(warning.type, `warnings[${index}].type`, issues));
  if (result.debugTrace && !result.debugTrace.compatibilityMatrixLookup) issues.push("debugTrace.compatibilityMatrixLookup is required.");
  if (result.debugTrace && result.debugTrace.compatibilityTarget !== "semantic_process") issues.push("debugTrace.compatibilityTarget must be semantic_process.");
  const blockingState = result.debugTrace?.conditions.find((condition) => condition.type === "blocked_process") ? "blocked" : "none";
  if (!isOneOf(blockingState, blockingStates)) issues.push("blockingState trace is invalid.");
  return { success: issues.length === 0, issues };
}

export function assertValidTempoCompatibilityResult(result: TempoCompatibilityResult) {
  const validation = validateTempoCompatibilityResult(result);
  if (!validation.success) throw new Error(`Invalid TempoCompatibilityResult:\n${validation.issues.join("\n")}`);
  return result;
}
