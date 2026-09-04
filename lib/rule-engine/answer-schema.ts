import {
  answerConditionTypes,
  answerEvidenceTypes,
  answerPropositionTypes,
  answerResolutionLevels,
  answerUncertaintyTypes,
  BasicAnswerResolution,
  BasicAnswerResolverInput,
  propositionSources,
  semanticDirections,
  timingAnswerEffects
} from "./answer-types";
import { answerModes } from "./ontology";

export type AnswerValidationResult = {
  success: boolean;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function validateBasicAnswerResolverInput(input: BasicAnswerResolverInput): AnswerValidationResult {
  const issues: string[] = [];
  if (!input.question) issues.push("question is required.");
  if (!input.synthesis) issues.push("synthesis is required.");
  if (input.tempo && input.tempo.compatibilityTarget !== "semantic_process") issues.push("tempo.compatibilityTarget must be semantic_process.");
  return { success: issues.length === 0, issues };
}

export function assertValidBasicAnswerResolverInput(input: BasicAnswerResolverInput) {
  const result = validateBasicAnswerResolverInput(input);
  if (!result.success) throw new Error(`Invalid BasicAnswerResolverInput:\n${result.issues.join("\n")}`);
  return input;
}

export function validateBasicAnswerResolution(result: BasicAnswerResolution): AnswerValidationResult {
  const issues: string[] = [];
  if (!isRecord(result)) return { success: false, issues: ["BasicAnswerResolution must be an object."] };
  if (!isOneOf(result.answerMode, answerModes)) issues.push("answerMode is invalid.");
  if (!isOneOf(result.resolution, answerResolutionLevels)) issues.push("resolution is invalid.");
  if (!result.engineVersion) issues.push("engineVersion is required.");
  if (!result.explanationCode) issues.push("explanationCode is required.");
  if (!isOneOf(result.confidence, ["high", "medium", "low"] as const)) issues.push("confidence is invalid.");
  validateProposition(result.proposition, issues);
  if (!isOneOf(result.semanticSupport?.semanticDirection, semanticDirections)) issues.push("semanticSupport.semanticDirection is invalid.");
  if (typeof result.semanticSupport?.propositionMatched !== "boolean") issues.push("semanticSupport.propositionMatched must be boolean.");
  validateEvidenceList(result.supportEvidence, "supportEvidence", issues);
  validateEvidenceList(result.opposingEvidence, "opposingEvidence", issues);
  result.conditions?.forEach((condition, index) => {
    if (!isOneOf(condition.type, answerConditionTypes)) issues.push(`conditions[${index}].type is invalid.`);
    if (!condition.concept) issues.push(`conditions[${index}].concept is required.`);
  });
  result.blockers?.forEach((blocker, index) => {
    if (!blocker.type) issues.push(`blockers[${index}].type is required.`);
    if (!blocker.concept) issues.push(`blockers[${index}].concept is required.`);
  });
  result.uncertainty?.forEach((uncertainty, index) => {
    if (!isOneOf(uncertainty.type, answerUncertaintyTypes)) issues.push(`uncertainty[${index}].type is invalid.`);
    if (!uncertainty.concept) issues.push(`uncertainty[${index}].concept is required.`);
  });
  if (result.timingEffect && !isOneOf(result.timingEffect.effect, timingAnswerEffects)) issues.push("timingEffect.effect is invalid.");
  result.debugTrace?.candidateSemanticMatches.forEach((evidence, index) => validateEvidence(evidence, `debugTrace.candidateSemanticMatches[${index}]`, issues));
  return { success: issues.length === 0, issues };
}

export function assertValidBasicAnswerResolution(result: BasicAnswerResolution) {
  const validation = validateBasicAnswerResolution(result);
  if (!validation.success) throw new Error(`Invalid BasicAnswerResolution:\n${validation.issues.join("\n")}`);
  return result;
}

function validateProposition(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("proposition must be an object.");
    return;
  }
  if (!isOneOf(value.propositionType, answerPropositionTypes)) issues.push("proposition.propositionType is invalid.");
  if (!isOneOf(value.source, propositionSources)) issues.push("proposition.source is invalid.");
}

function validateEvidenceList(value: unknown, path: string, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return;
  }
  value.forEach((item, index) => validateEvidence(item, `${path}[${index}]`, issues));
}

function validateEvidence(value: unknown, path: string, issues: string[]) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  if (!isOneOf(value.type, answerEvidenceTypes)) issues.push(`${path}.type is invalid.`);
  if (typeof value.concept !== "string" || !value.concept) issues.push(`${path}.concept is required.`);
  if (!Array.isArray(value.evidenceCodes) || value.evidenceCodes.some((code) => typeof code !== "string" || !code)) issues.push(`${path}.evidenceCodes must be a non-empty string array.`);
  if (!isOneOf(value.strength, ["strong", "medium", "weak"] as const)) issues.push(`${path}.strength is invalid.`);
}
