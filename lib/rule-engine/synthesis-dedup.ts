import { SemanticUnit, SynthesisConfidence } from "./synthesis-types";

export type DeduplicationResult = {
  units: SemanticUnit[];
  removedDuplicates: Array<{
    removedId: string;
    mergedIntoId: string;
    reason: string;
  }>;
};

const CONFIDENCE_SCORE = { low: 1, medium: 2, high: 3 } as const;

export function deduplicateSemanticUnits(units: SemanticUnit[]): DeduplicationResult {
  const byKey = new Map<string, SemanticUnit>();
  const removedDuplicates: DeduplicationResult["removedDuplicates"] = [];

  for (const unit of units) {
    const key = dedupKey(unit);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...unit, cardIds: uniqueNumbers(unit.cardIds), modeIds: uniqueStrings(unit.modeIds), evidenceRefs: uniqueStrings(unit.evidenceRefs) });
      continue;
    }
    byKey.set(key, mergeUnits(existing, unit));
    removedDuplicates.push({ removedId: unit.id, mergedIntoId: existing.id, reason: "same theme/target/process/person cluster" });
  }

  return { units: Array.from(byKey.values()), removedDuplicates };
}

function dedupKey(unit: SemanticUnit) {
  const theme = clusterTheme(unit.concept, unit.modeIds);
  return [theme, unit.target ?? "general", unit.process ?? unit.type, unit.personId ?? "none"].join("|");
}

function clusterTheme(concept: string, modeIds: string[]) {
  const text = `${concept} ${modeIds.join(" ")}`;
  if (/heart|love|affection|attraction|emotion|feeling/.test(text)) return "emotion";
  if (/ring|commitment|bond|agreement|contract/.test(text)) return "commitment";
  if (/cloud|uncertain|confusion|unclear|hidden|unknown|secret/.test(text)) return "information_uncertainty";
  if (/letter|message|document|communication|written|public/.test(text)) return "communication_information";
  if (/mountain|block|delay|obstacle|stop|stagnation/.test(text)) return "obstacle";
  if (/mice|erod|loss|depletion|diminish/.test(text)) return "erosion";
  if (/anchor|stable|stability|persistence|duration/.test(text)) return "stability";
  if (/coffin|ending|closure|end/.test(text)) return "ending";
  if (/whip|repeat|revision|editing|practice/.test(text)) return "revision_repetition";
  if (/child|simple|simplification|small|early/.test(text)) return "simplification";
  if (/garden|audience|public|social|network/.test(text)) return "public_audience";
  if (/fish|resource|abundance|quantity|flow|depth/.test(text)) return "resource_quantity";
  if (/dog|trust|loyal/.test(text)) return "trust";
  if (/key|confirm|solution|unlock|importance/.test(text)) return "key_resolution";
  if (/rider|approach|incoming/.test(text)) return "approach";
  return text.split(/[^a-z0-9_]+/).filter(Boolean).slice(0, 3).join("_") || "other";
}

function mergeUnits(left: SemanticUnit, right: SemanticUnit): SemanticUnit {
  return {
    ...left,
    concept: preferConcept(left, right),
    cardIds: uniqueNumbers([...left.cardIds, ...right.cardIds]),
    modeIds: uniqueStrings([...left.modeIds, ...right.modeIds]),
    evidenceRefs: uniqueStrings([...left.evidenceRefs, ...right.evidenceRefs]),
    importance: left.importance === "primary" || right.importance === "primary" ? "primary" : left.importance === "secondary" || right.importance === "secondary" ? "secondary" : "supporting",
    confidence: maxConfidence(left.confidence, right.confidence)
  };
}

function preferConcept(left: SemanticUnit, right: SemanticUnit) {
  if (right.importance === "primary" && left.importance !== "primary") return right.concept;
  if (right.evidenceRefs.length > left.evidenceRefs.length) return right.concept;
  return left.concept;
}

function maxConfidence(left: SynthesisConfidence, right: SynthesisConfidence): SynthesisConfidence {
  return CONFIDENCE_SCORE[right] > CONFIDENCE_SCORE[left] ? right : left;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values)).filter(Boolean);
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values));
}
