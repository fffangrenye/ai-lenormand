import { getCardLexiconEntry } from "./lexicon";
import { pairRelationTypes, PairInterpretation, ResolvedCardMeaning } from "./pair-types";
import { meaningEvidenceSources } from "./preselection-types";
import { interpretationPlanes, semanticRoles } from "./semantic-types";

export type PairValidationResult = {
  success: boolean;
  issues: string[];
};

export function validatePairInterpretation(value: PairInterpretation): PairValidationResult {
  const issues: string[] = [];
  const leftCard = getCardLexiconEntry(value.leftCardId);
  const rightCard = getCardLexiconEntry(value.rightCardId);

  if (!leftCard) issues.push(`leftCardId ${value.leftCardId} is not valid.`);
  if (!rightCard) issues.push(`rightCardId ${value.rightCardId} is not valid.`);
  if (value.leftCardId === value.rightCardId) issues.push("ordered pair must contain two positions, not one card id.");
  if (value.direction !== "left_to_right") issues.push(`direction ${String(value.direction)} is not valid.`);

  validateRelation(value.primaryRelation, "primaryRelation", issues);
  const alternativeRelations = value.alternativeRelations ?? [];
  for (let index = 0; index < alternativeRelations.length; index += 1) {
    validateRelation(alternativeRelations[index], `alternativeRelations[${index}]`, issues);
  }

  for (let index = 0; index < value.neighborEvidence.length; index += 1) {
    const evidence = value.neighborEvidence[index];
    if (![value.leftCardId, value.rightCardId].includes(evidence.sourceCardId)) {
      issues.push(`neighborEvidence[${index}].sourceCardId is outside the ordered pair.`);
    }
    if (![value.leftCardId, value.rightCardId].includes(evidence.targetCardId)) {
      issues.push(`neighborEvidence[${index}].targetCardId is outside the ordered pair.`);
    }
    if (!evidence.evidenceCode) issues.push(`neighborEvidence[${index}].evidenceCode is required.`);
    if (evidence.suggestsRole && !semanticRoles.includes(evidence.suggestsRole)) {
      issues.push(`neighborEvidence[${index}].suggestsRole ${String(evidence.suggestsRole)} is not valid.`);
    }
  }

  return { success: issues.length === 0, issues };
}

export function assertValidPairInterpretation(value: PairInterpretation) {
  const result = validatePairInterpretation(value);
  if (!result.success) {
    throw new Error(`Invalid PairInterpretation:\n${result.issues.join("\n")}`);
  }
  return value;
}

export function validateResolvedCardMeaning(value: ResolvedCardMeaning): PairValidationResult {
  const issues: string[] = [];
  const card = getCardLexiconEntry(value.cardId);
  if (!card) issues.push(`cardId ${value.cardId} is not valid.`);
  if (card && !card.semanticModes.some((mode) => mode.id === value.primaryMode)) {
    issues.push(`primaryMode ${value.primaryMode} does not exist on card ${card.name}.`);
  }
  if (value.secondaryMode && card && !card.semanticModes.some((mode) => mode.id === value.secondaryMode)) {
    issues.push(`secondaryMode ${value.secondaryMode} does not exist on card ${card.name}.`);
  }
  if (!semanticRoles.includes(value.role)) issues.push(`role ${String(value.role)} is not valid.`);
  if (!interpretationPlanes.includes(value.plane)) issues.push(`plane ${String(value.plane)} is not valid.`);
  for (let index = 0; index < value.evidence.length; index += 1) {
    const evidence = value.evidence[index];
    if (!meaningEvidenceSources.includes(evidence.source)) issues.push(`evidence[${index}].source ${String(evidence.source)} is not valid.`);
    if (!evidence.code) issues.push(`evidence[${index}].code is required.`);
  }
  return { success: issues.length === 0, issues };
}

export function assertValidResolvedCardMeaning(value: ResolvedCardMeaning) {
  const result = validateResolvedCardMeaning(value);
  if (!result.success) {
    throw new Error(`Invalid ResolvedCardMeaning:\n${result.issues.join("\n")}`);
  }
  return value;
}

function validateRelation(value: PairInterpretation["primaryRelation"], path: string, issues: string[]) {
  if (!pairRelationTypes.includes(value.relation)) issues.push(`${path}.relation ${String(value.relation)} is not valid.`);
  if (!Number.isFinite(value.internalScore)) issues.push(`${path}.internalScore must be finite.`);
  if (!value.subjectModeId) issues.push(`${path}.subjectModeId is required.`);
  if (!value.semanticResult.headConcept) issues.push(`${path}.semanticResult.headConcept is required.`);
}
