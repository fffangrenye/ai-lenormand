import {
  closingStateTypes,
  conclusionSupports,
  conclusionTypes,
  narrativeFunctions,
  safetyFlagTypes,
  semanticUnitImportances,
  semanticUnitSources,
  semanticUnitTypes,
  synthesisConditionTypes,
  synthesisConfidences,
  synthesisMainProcesses,
  synthesisTransitionTypes,
  SynthesisResult,
  WholeLineSynthesisInput,
  unresolvedPointTypes
} from "./synthesis-types";

export type SynthesisValidationResult = {
  success: boolean;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function validateIdList(value: unknown, path: string, issues: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isInteger(item))) {
    issues.push(`${path} must be a number array.`);
  }
}

function validateStringList(value: unknown, path: string, issues: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    issues.push(`${path} must be a non-empty string array.`);
  }
}

export function validateSynthesisInput(input: WholeLineSynthesisInput): SynthesisValidationResult {
  const issues: string[] = [];
  if (!input.question) issues.push("question is required.");
  if (!Array.isArray(input.resolvedCards) || !input.resolvedCards.length) issues.push("resolvedCards must contain at least one card.");
  if (!Array.isArray(input.pairs) || input.pairs.length !== input.spread.spreadSize - 1) issues.push("pairs must match spread size.");
  const spreadCards = new Set(input.spread.forwardChain.cardIds);
  for (const card of input.resolvedCards) {
    if (!spreadCards.has(card.cardId)) issues.push(`resolvedCards contains card ${card.cardId} outside spread.`);
  }
  for (let index = 0; index < input.pairs.length; index += 1) {
    const pair = input.pairs[index];
    if (pair.leftCardId !== input.spread.forwardChain.cardIds[index] || pair.rightCardId !== input.spread.forwardChain.cardIds[index + 1]) {
      issues.push(`pairs[${index}] must follow spread forward chain.`);
    }
  }
  return { success: issues.length === 0, issues };
}

export function assertValidSynthesisInput(input: WholeLineSynthesisInput) {
  const result = validateSynthesisInput(input);
  if (!result.success) throw new Error(`Invalid WholeLineSynthesisInput:\n${result.issues.join("\n")}`);
  return input;
}

export function validateSynthesisResult(result: SynthesisResult): SynthesisValidationResult {
  const issues: string[] = [];
  if (!isRecord(result)) return { success: false, issues: ["SynthesisResult must be an object."] };
  if (!result.engineVersion) issues.push("engineVersion is required.");
  if (!isOneOf(result.mainProcess, synthesisMainProcesses)) issues.push("mainProcess is invalid.");
  if (!isOneOf(result.confidence, synthesisConfidences)) issues.push("confidence is invalid.");
  validateTheme(result.coreTheme, issues);
  if (!Array.isArray(result.narrativeUnits) || result.narrativeUnits.length < 1) issues.push("narrativeUnits must contain at least one unit.");
  const unitIds = new Set<string>();
  result.narrativeUnits?.forEach((unit, index) => {
    if (unitIds.has(String(unit.order))) issues.push(`narrativeUnits[${index}] has duplicate order.`);
    unitIds.add(String(unit.order));
    if (!isOneOf(unit.function, narrativeFunctions)) issues.push(`narrativeUnits[${index}].function is invalid.`);
    if (!unit.concept) issues.push(`narrativeUnits[${index}].concept is required.`);
    validateIdList(unit.cardIds, `narrativeUnits[${index}].cardIds`, issues);
    validateStringList(unit.evidenceCodes, `narrativeUnits[${index}].evidenceCodes`, issues);
    if (!isOneOf(unit.confidence, synthesisConfidences)) issues.push(`narrativeUnits[${index}].confidence is invalid.`);
  });
  result.keyTransitions?.forEach((transition, index) => {
    if (!isOneOf(transition.type, synthesisTransitionTypes)) issues.push(`keyTransitions[${index}].type is invalid.`);
    validateIdList(transition.cardIds, `keyTransitions[${index}].cardIds`, issues);
    validateStringList(transition.evidenceCodes, `keyTransitions[${index}].evidenceCodes`, issues);
    if (!isOneOf(transition.confidence, synthesisConfidences)) issues.push(`keyTransitions[${index}].confidence is invalid.`);
  });
  result.conditions?.forEach((condition, index) => {
    if (!isOneOf(condition.type, synthesisConditionTypes)) issues.push(`conditions[${index}].type is invalid.`);
    if (!condition.concept) issues.push(`conditions[${index}].concept is required.`);
    validateIdList(condition.cardIds, `conditions[${index}].cardIds`, issues);
    validateStringList(condition.evidenceCodes, `conditions[${index}].evidenceCodes`, issues);
  });
  if (result.closingState) {
    if (!isOneOf(result.closingState.type, closingStateTypes)) issues.push("closingState.type is invalid.");
    validateIdList(result.closingState.cardIds, "closingState.cardIds", issues);
    validateStringList(result.closingState.evidence, "closingState.evidence", issues);
  }
  if (!isOneOf(result.conclusion.type, conclusionTypes)) issues.push("conclusion.type is invalid.");
  if (!isOneOf(result.conclusion.support, conclusionSupports)) issues.push("conclusion.support is invalid.");
  if (!result.conclusion.summary) issues.push("conclusion.summary is required.");
  validateStringList(result.conclusion.summaryConcepts, "conclusion.summaryConcepts", issues);
  validateIdList(result.conclusion.evidenceCardIds, "conclusion.evidenceCardIds", issues);
  result.unresolvedPoints?.forEach((point, index) => {
    if (!isOneOf(point.type, unresolvedPointTypes)) issues.push(`unresolvedPoints[${index}].type is invalid.`);
  });
  result.safetyFlags?.forEach((flag, index) => {
    if (!isOneOf(flag.type, safetyFlagTypes)) issues.push(`safetyFlags[${index}].type is invalid.`);
  });
  result.debugTrace?.collectedUnits.forEach((unit, index) => validateSemanticUnit(unit, `debugTrace.collectedUnits[${index}]`, issues));
  result.debugTrace?.mergedUnits.forEach((unit, index) => validateSemanticUnit(unit, `debugTrace.mergedUnits[${index}]`, issues));
  return { success: issues.length === 0, issues };
}

export function assertValidSynthesisResult(result: SynthesisResult) {
  const validation = validateSynthesisResult(result);
  if (!validation.success) throw new Error(`Invalid SynthesisResult:\n${validation.issues.join("\n")}`);
  return result;
}

function validateTheme(theme: SynthesisResult["coreTheme"], issues: string[]) {
  if (!theme?.label) issues.push("coreTheme.label is required.");
  if (typeof theme?.primaryCardId !== "number") issues.push("coreTheme.primaryCardId is required.");
  validateStringList(theme?.primaryModeIds, "coreTheme.primaryModeIds", issues);
  validateIdList(theme?.supportingCardIds, "coreTheme.supportingCardIds", issues);
  validateStringList(theme?.evidenceCodes, "coreTheme.evidenceCodes", issues);
  if (!isOneOf(theme?.confidence, synthesisConfidences)) issues.push("coreTheme.confidence is invalid.");
}

function validateSemanticUnit(unit: unknown, path: string, issues: string[]) {
  if (!isRecord(unit)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  if (typeof unit.id !== "string" || !unit.id) issues.push(`${path}.id is required.`);
  if (!isOneOf(unit.type, semanticUnitTypes)) issues.push(`${path}.type is invalid.`);
  if (typeof unit.concept !== "string" || !unit.concept) issues.push(`${path}.concept is required.`);
  if (!isOneOf(unit.source, semanticUnitSources)) issues.push(`${path}.source is invalid.`);
  if (!isOneOf(unit.importance, semanticUnitImportances)) issues.push(`${path}.importance is invalid.`);
  validateIdList(unit.cardIds, `${path}.cardIds`, issues);
  validateStringList(unit.modeIds, `${path}.modeIds`, issues);
  validateStringList(unit.evidenceRefs, `${path}.evidenceRefs`, issues);
  if (!isOneOf(unit.confidence, synthesisConfidences)) issues.push(`${path}.confidence is invalid.`);
}
