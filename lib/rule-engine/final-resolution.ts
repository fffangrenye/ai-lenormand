import { getSemanticMode } from "./lexicon";
import {
  FinalResolutionInput,
  NeighborEvidence,
  PairInput,
  PairInterpretation,
  PairPipelineResult,
  ResolvedCardMeaning
} from "./pair-types";
import { assertValidResolvedCardMeaning } from "./pair-schema";
import { resolveOrderedPair } from "./pair-engine";
import { MeaningEvidence, PreselectedCardMeaning, SemanticCandidate } from "./preselection-types";

const TIER_SCORE = { dominant: 8, strong: 6, possible: 4, weak: 2, suppressed: 0 } as const;
const CONFIDENCE_SCORE = { high: 3, medium: 2, low: 1 } as const;

export function resolveFinalCardMeanings(input: FinalResolutionInput): ResolvedCardMeaning[] {
  return input.preselected.map((meaning) => resolveOneCard(meaning, input.pairInterpretations));
}

export function resolvePairPipeline(inputs: PairInput[]): PairPipelineResult {
  const initialPairs = inputs.map(resolveOrderedPair);
  const preselected = uniquePreselected(inputs);
  const resolvedCards = resolveFinalCardMeanings({ preselected, pairInterpretations: initialPairs });
  const refinedInputs = inputs.map((input) => reorderInputByResolvedMeaning(input, resolvedCards));
  const needsRefinement = inputs.some((input, index) => shouldRefinePair(input, initialPairs[index], resolvedCards, refinedInputs[index]));
  const refinedPairs = needsRefinement ? refinedInputs.map(resolveOrderedPair) : initialPairs;

  return {
    initialPairs,
    resolvedCards,
    refinedPairs,
    refinementPasses: needsRefinement ? 1 : 0
  };
}

function resolveOneCard(meaning: PreselectedCardMeaning, pairs: PairInterpretation[]): ResolvedCardMeaning {
  const neighborEvidence = collectNeighborEvidence(meaning.cardId, pairs);
  const scored = meaning.candidates
    .filter((candidate) => !candidate.blocked)
    .map((candidate, order) => ({
      candidate,
      order,
      score: scoreCandidate(candidate, neighborEvidence),
      supported: isSupported(candidate, neighborEvidence)
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const selected = scored.find((item) => !item.candidate.requiresNeighborResolution || item.supported) ?? scored[0];
  if (!selected) {
    throw new Error(`No active candidate is available for card ${meaning.cardId}.`);
  }

  const second = scored.find((item) => item.candidate.modeId !== selected.candidate.modeId);
  const selectedMode = getSemanticMode(meaning.cardId, selected.candidate.modeId);
  const unresolvedAlternatives = scored
    .filter((item) => item.candidate.modeId !== selected.candidate.modeId)
    .filter((item) => Math.abs(selected.score - item.score) <= 2 || item.candidate.requiresNeighborResolution)
    .map((item) => item.candidate.modeId);

  const confidence = selected.candidate.requiresNeighborResolution
    ? selected.supported
      ? "medium"
      : "low"
    : selected.score >= 9
      ? "high"
      : selected.score >= 6
        ? "medium"
        : "low";

  return assertValidResolvedCardMeaning({
    cardId: meaning.cardId,
    primaryMode: selected.candidate.modeId,
    secondaryMode: second?.candidate.modeId,
    role: selected.candidate.roles[0] ?? selectedMode?.roles[0],
    plane: selected.candidate.planes[0] ?? selectedMode?.planes[0],
    confidence,
    evidence: mergeEvidence(selected.candidate.evidence, neighborEvidence, selected.candidate.modeId),
    unresolvedAlternatives: unresolvedAlternatives.length ? unresolvedAlternatives : undefined
  });
}

function collectNeighborEvidence(cardId: number, pairs: PairInterpretation[]) {
  return pairs.flatMap((pair) => pair.neighborEvidence).filter((evidence) => evidence.targetCardId === cardId);
}

function scoreCandidate(candidate: SemanticCandidate, neighborEvidence: NeighborEvidence[]) {
  const supports = neighborEvidence
    .filter((evidence) => evidence.supportsModes?.includes(candidate.modeId))
    .reduce((sum, evidence) => sum + CONFIDENCE_SCORE[evidence.confidence], 0);
  const suppresses = neighborEvidence
    .filter((evidence) => evidence.suppressesModes?.includes(candidate.modeId))
    .reduce((sum, evidence) => sum + CONFIDENCE_SCORE[evidence.confidence], 0);
  const neighborPenalty = candidate.requiresNeighborResolution && supports === 0 ? 4 : 0;
  return TIER_SCORE[candidate.relevance] + candidate.internalScore + supports - suppresses - neighborPenalty;
}

function isSupported(candidate: SemanticCandidate, neighborEvidence: NeighborEvidence[]) {
  return neighborEvidence.some((evidence) => evidence.supportsModes?.includes(candidate.modeId));
}

function mergeEvidence(base: MeaningEvidence[], neighborEvidence: NeighborEvidence[], modeId: string) {
  const merged = [...base];
  for (const evidence of neighborEvidence) {
    if (evidence.supportsModes?.includes(modeId)) {
      merged.push({ source: "neighbor", code: evidence.evidenceCode, detail: `${evidence.sourceCardId}->${evidence.targetCardId}` });
    }
  }
  return dedupeEvidence(merged);
}

function uniquePreselected(inputs: PairInput[]) {
  const byCard = new Map<number, PreselectedCardMeaning>();
  for (const input of inputs) {
    byCard.set(input.left.cardId, input.left);
    byCard.set(input.right.cardId, input.right);
  }
  return Array.from(byCard.values());
}

function reorderInputByResolvedMeaning(input: PairInput, resolved: ResolvedCardMeaning[]): PairInput {
  const leftResolved = resolved.find((item) => item.cardId === input.left.cardId);
  const rightResolved = resolved.find((item) => item.cardId === input.right.cardId);
  const left = leftResolved ? reorderPreselection(input.left, leftResolved.primaryMode) : input.left;
  const right = rightResolved ? reorderPreselection(input.right, rightResolved.primaryMode) : input.right;
  if (left === input.left && right === input.right) return input;
  return {
    ...input,
    left,
    right
  };
}

function shouldRefinePair(input: PairInput, pair: PairInterpretation, resolved: ResolvedCardMeaning[], refinedInput: PairInput) {
  const finalLeftMode = resolved.find((item) => item.cardId === input.left.cardId)?.primaryMode;
  const finalRightMode = resolved.find((item) => item.cardId === input.right.cardId)?.primaryMode;
  const initialLeftMode = modeForCard(pair, input.left.cardId);
  const initialRightMode = modeForCard(pair, input.right.cardId);
  return finalLeftMode !== initialLeftMode || finalRightMode !== initialRightMode;
}

function modeForCard(pair: PairInterpretation, cardId: number) {
  if (pair.primaryRelation.subjectCardId === cardId) return pair.primaryRelation.subjectModeId;
  if (pair.primaryRelation.operatorCardId === cardId) return pair.primaryRelation.operatorModeId;
  return undefined;
}

function reorderPreselection(meaning: PreselectedCardMeaning, primaryMode: string): PreselectedCardMeaning {
  if (meaning.candidates[0]?.modeId === primaryMode) return meaning;
  const selected = meaning.candidates.find((candidate) => candidate.modeId === primaryMode);
  if (!selected) return meaning;
  return {
    ...meaning,
    candidates: [selected, ...meaning.candidates.filter((candidate) => candidate.modeId !== primaryMode)]
  };
}

function dedupeEvidence(evidence: MeaningEvidence[]) {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.source}:${item.code}:${item.detail ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
