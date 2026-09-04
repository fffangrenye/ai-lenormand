import { getCardLexiconEntry } from "./lexicon";
import { PreselectedCardMeaning, relevanceTiers } from "./preselection-types";
import { interpretationPlanes } from "./semantic-types";

export type PreselectionValidationResult = {
  success: boolean;
  issues: string[];
};

export function validatePreselectedCardMeaning(value: PreselectedCardMeaning): PreselectionValidationResult {
  const issues: string[] = [];
  const card = getCardLexiconEntry(value.cardId);
  if (!card) issues.push(`cardId ${value.cardId} is not valid.`);

  if (!interpretationPlanes.includes(value.preferredPlane)) issues.push(`preferredPlane ${String(value.preferredPlane)} is not valid.`);
  if (!Array.isArray(value.candidates) || value.candidates.length < 1) issues.push("candidates must contain at least one item.");

  const seen = new Set<string>();
  for (const candidate of value.candidates ?? []) {
    if (seen.has(candidate.modeId)) issues.push(`duplicate candidate mode ${candidate.modeId}.`);
    seen.add(candidate.modeId);
    if (card && !card.semanticModes.some((mode) => mode.id === candidate.modeId)) {
      issues.push(`candidate mode ${candidate.modeId} does not exist on card ${card.name}.`);
    }
    if (!relevanceTiers.includes(candidate.relevance)) issues.push(`${candidate.modeId}: invalid relevance ${String(candidate.relevance)}.`);
    if (!Number.isFinite(candidate.internalScore)) issues.push(`${candidate.modeId}: internalScore must be finite.`);
    if (candidate.blocked) issues.push(`${candidate.modeId}: blocked candidate cannot be selected as top active candidate.`);
    const mode = card?.semanticModes.find((item) => item.id === candidate.modeId);
    if (mode?.activation?.neighborSupportRequired && !candidate.requiresNeighborResolution) {
      issues.push(`${candidate.modeId}: neighbor-required mode must carry requiresNeighborResolution.`);
    }
    if (candidate.requiresNeighborResolution && candidate.relevance !== "possible" && candidate.relevance !== "weak" && candidate.relevance !== "suppressed") {
      issues.push(`${candidate.modeId}: neighbor-required mode cannot rank above possible in preselection.`);
    }
  }

  return { success: issues.length === 0, issues };
}

export function assertValidPreselectedCardMeaning(value: PreselectedCardMeaning) {
  const result = validatePreselectedCardMeaning(value);
  if (!result.success) {
    throw new Error(`Invalid PreselectedCardMeaning:\n${result.issues.join("\n")}`);
  }
  return value;
}
