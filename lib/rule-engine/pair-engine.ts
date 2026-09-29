import { findPairOverrides } from "./pair-overrides";
import { getBehaviorRelation } from "./pair-behaviors";
import {
  ModePairCandidate,
  NeighborEvidence,
  PairEvidence,
  PairInput,
  PairInterpretation,
  PairRelationCandidate,
  PairRelationType,
  PairSemanticResult,
  orderedPairKey
} from "./pair-types";
import { SemanticCandidate } from "./preselection-types";
import { CardLexiconEntry, SemanticMode, SpecialBehavior } from "./semantic-types";

const TIER_SCORE = { dominant: 4, strong: 3, possible: 2, weak: 1, suppressed: 0 } as const;

export function resolveOrderedPair(input: PairInput): PairInterpretation {
  const key = orderedPairKey(input.leftCard.id, input.rightCard.id);
  const overrides = findPairOverrides(key, input.question);
  const generated = generateModePairs(input);
  const relations = generated.flatMap((modePair) => modePair.relationCandidates);
  const overrideRelations = applyPairOverrides(input, overrides);
  const allRelations = [...overrideRelations, ...relations].sort((a, b) => b.internalScore - a.internalScore || relationOrder(a.relation) - relationOrder(b.relation));
  const primaryRelation = allRelations[0] ?? fallbackRelation(input, input.left.candidates[0], input.right.candidates[0]);
  const alternatives = allRelations.filter((item) => item !== primaryRelation).slice(0, 2);
  const neighborEvidence = emitNeighborEvidence(input, primaryRelation, alternatives);
  const debugTrace = {
    pair: [input.leftCard.id, input.rightCard.id] as [number, number],
    generatedModePairs: generated.map((item) => ({ leftModeId: item.leftModeId, rightModeId: item.rightModeId, score: item.internalScore })),
    appliedOverrides: overrides.map((item) => item.code),
    appliedBehaviors: primaryRelation.evidence.filter((item) => item.source === "special_behavior").map((item) => item.detail as SpecialBehavior),
    relationCandidates: allRelations.map((item) => ({ relation: item.relation, score: item.internalScore })),
    selectedRelation: primaryRelation.relation
  };

  return {
    leftCardId: input.leftCard.id,
    rightCardId: input.rightCard.id,
    direction: "left_to_right",
    primaryRelation,
    alternativeRelations: alternatives.length ? alternatives : undefined,
    neighborEvidence,
    unresolved: determinePairUnresolved(input, primaryRelation, alternatives),
    debugTrace
  };
}

function generateModePairs(input: PairInput): ModePairCandidate[] {
  const leftModes = input.left.candidates.filter((candidate) => !candidate.blocked);
  const rightModes = input.right.candidates.filter((candidate) => !candidate.blocked);
  return leftModes.flatMap((leftCandidate) =>
    rightModes.map((rightCandidate) => {
      const leftMode = findMode(input.leftCard, leftCandidate.modeId);
      const rightMode = findMode(input.rightCard, rightCandidate.modeId);
      const relationCandidates = inferRelations(input, leftCandidate, rightCandidate, leftMode, rightMode);
      const compatibility = getCompatibility(leftCandidate, rightCandidate, leftMode, rightMode);
      return {
        leftModeId: leftCandidate.modeId,
        rightModeId: rightCandidate.modeId,
        leftTier: leftCandidate.relevance,
        rightTier: rightCandidate.relevance,
        compatibility,
        relationCandidates,
        internalScore:
          TIER_SCORE[leftCandidate.relevance] +
          TIER_SCORE[rightCandidate.relevance] +
          (compatibility === "strong" ? 2 : compatibility === "compatible" ? 1 : 0)
      };
    })
  );
}

function inferRelations(
  input: PairInput,
  leftCandidate: SemanticCandidate,
  rightCandidate: SemanticCandidate,
  leftMode: SemanticMode,
  rightMode: SemanticMode
): PairRelationCandidate[] {
  if (input.leftCard.id === 36 || input.rightCard.id === 36) {
    const crossBehavior = behaviorRelation(input, leftCandidate, rightCandidate);
    if (crossBehavior) return [crossBehavior];
  }

  const passive = passiveAnchorRelation(input, leftCandidate, rightCandidate);
  if (passive) return [passive];

  const behavior = behaviorRelation(input, leftCandidate, rightCandidate);
  if (behavior) return [behavior];

  const relation = roleRelation(input, leftCandidate, rightCandidate, leftMode, rightMode);
  return [buildRelation(input, relation, input.leftCard.id, input.rightCard.id, leftCandidate.modeId, rightCandidate.modeId, "medium", [{ source: "role_compatibility", code: "ROLE_COMPATIBILITY" }], scorePair(leftCandidate, rightCandidate, relation))];
}

function passiveAnchorRelation(input: PairInput, left: SemanticCandidate, right: SemanticCandidate) {
  if (input.leftCard.semanticAgency === "passive_anchor" && input.rightCard.semanticAgency !== "passive_anchor") {
    if (shouldSuppressPassiveAnchorDescription(input.rightCard, right.modeId)) return null;
    return buildRelation(input, "describe", input.leftCard.id, input.rightCard.id, left.modeId, right.modeId, "high", [{ source: "semantic_agency", code: "PASSIVE_PERSON_ANCHOR_RIGHT_DESCRIBES_LEFT" }], scorePair(left, right, "describe") + 3);
  }
  if (input.rightCard.semanticAgency === "passive_anchor" && input.leftCard.semanticAgency !== "passive_anchor") {
    if (shouldSuppressPassiveAnchorDescription(input.leftCard, left.modeId)) return null;
    return buildRelation(input, "describe", input.rightCard.id, input.leftCard.id, right.modeId, left.modeId, "high", [{ source: "semantic_agency", code: "PASSIVE_PERSON_ANCHOR_LEFT_DESCRIBES_RIGHT" }], scorePair(left, right, "describe") + 3);
  }
  return null;
}

function behaviorRelation(input: PairInput, left: SemanticCandidate, right: SemanticCandidate) {
  const leftBehavior = bestBehavior(input.leftCard, left.modeId);
  const rightBehavior = bestBehavior(input.rightCard, right.modeId);
  if (input.leftCard.id === 36 && input.leftCard.specialBehaviors?.includes("emphasize_following_theme")) {
    return buildBehavior(input, "emphasize_following_theme", "burden", input.rightCard.id, input.leftCard.id, right.modeId, left.modeId, left, right, { stateChange: "unclear" });
  }
  if (input.rightCard.id === 36 && input.rightCard.specialBehaviors?.includes("finalize_previous_theme")) {
    return buildBehavior(input, "finalize_previous_theme", "finalize", input.leftCard.id, input.rightCard.id, left.modeId, right.modeId, left, right, { stateChange: "end" });
  }
  const leftPreemptiveBehavior = leftOperatorPreemptsRightBehavior(input, left, right, leftBehavior, rightBehavior);
  if (leftPreemptiveBehavior) return leftPreemptiveBehavior;
  if (rightBehavior && ["backward", "bidirectional", "contextual"].includes(rightBehavior.direction)) {
    return buildBehavior(input, rightBehavior.behavior, rightBehavior.relation, input.leftCard.id, input.rightCard.id, left.modeId, right.modeId, left, right, rightBehavior);
  }
  if (input.leftCard.id === 8 && leftBehavior?.behavior === "end_adjacent_theme") {
    return buildRelation(
      input,
      "sequence",
      input.leftCard.id,
      input.rightCard.id,
      left.modeId,
      right.modeId,
      "high",
      [{ source: "special_behavior", code: "BEHAVIOR_COFFIN_LEFT_SEQUENCE", detail: "end_adjacent_theme" }],
      scorePair(left, right, "sequence") + 3,
      { stateChange: "change" }
    );
  }
  const leadingObstacle = leadingObstacleSequence(input, left, right, leftBehavior);
  if (leadingObstacle) return leadingObstacle;
  if (leftBehavior && ["forward", "bidirectional", "contextual"].includes(leftBehavior.direction)) {
    return buildBehavior(input, leftBehavior.behavior, leftBehavior.relation, input.rightCard.id, input.leftCard.id, right.modeId, left.modeId, left, right, leftBehavior);
  }
  return null;
}

function shouldSuppressPassiveAnchorDescription(descriptorCard: CardLexiconEntry, descriptorModeId: string) {
  if (descriptorCard.id !== 26) return false;
  return ["project_case", "exam_assessment", "physical_book_record"].includes(descriptorModeId);
}

function leftOperatorPreemptsRightBehavior(
  input: PairInput,
  left: SemanticCandidate,
  right: SemanticCandidate,
  leftBehavior: ReturnType<typeof bestBehavior>,
  rightBehavior: ReturnType<typeof bestBehavior>
) {
  if (!leftBehavior || !rightBehavior) return null;
  if (input.leftCard.id === 23 && ["diminish_adjacent_theme", "erode_adjacent_theme", "drain_resource"].includes(leftBehavior.behavior)) {
    if (canReceiveErosion(input.rightCard, right)) {
      return buildBehavior(input, leftBehavior.behavior, "erode", input.rightCard.id, input.leftCard.id, right.modeId, left.modeId, left, right, { stateChange: "decrease", quantityEffect: leftBehavior.quantityEffect });
    }
  }
  if (input.leftCard.id === 35 && ["stabilize_adjacent_theme", "fix_adjacent_theme"].includes(leftBehavior.behavior)) {
    if (canReceivePersistence(input.rightCard, right)) {
      return buildBehavior(input, leftBehavior.behavior, "stabilize", input.rightCard.id, input.leftCard.id, right.modeId, left.modeId, left, right, { stateChange: "stabilize", temporalEffect: leftBehavior.temporalEffect });
    }
  }
  return null;
}

function canReceiveErosion(card: CardLexiconEntry, candidate: SemanticCandidate) {
  if (card.semanticAgency === "passive_anchor") return false;
  if (card.id === 35) return false;
  return candidate.roles.some((role) => ["state", "core_theme", "resource", "information", "duration", "result"].includes(role));
}

function canReceivePersistence(card: CardLexiconEntry, candidate: SemanticCandidate) {
  if (card.semanticAgency === "passive_anchor") return false;
  return candidate.roles.some((role) => ["state", "core_theme", "resource", "information", "duration", "result", "action"].includes(role));
}

function leadingObstacleSequence(
  input: PairInput,
  left: SemanticCandidate,
  right: SemanticCandidate,
  leftBehavior: ReturnType<typeof bestBehavior>
) {
  if (input.leftCard.id !== 21 || !leftBehavior || !["block_adjacent_theme", "delay_adjacent_theme"].includes(leftBehavior.behavior)) return null;
  if (!right.roles.some((role) => role === "information" || role === "action" || role === "tempo")) return null;
  return buildRelation(
    input,
    "sequence",
    input.leftCard.id,
    input.rightCard.id,
    left.modeId,
    right.modeId,
    "high",
    [{ source: "special_behavior", code: "BEHAVIOR_OBSTACLE_STATE_THEN_ACTION", detail: leftBehavior.behavior }],
    scorePair(left, right, "sequence") + 3,
    { stateChange: left.modeId === "delay" ? "delay" : "block", temporalEffect: "slower" }
  );
}

function applyPairOverrides(input: PairInput, overrides: ReturnType<typeof findPairOverrides>) {
  return overrides.flatMap((override) =>
    override.preferredRelations
      .filter(
        (relation) =>
          modeAvailable(input.left.candidates, relation.leftModeId) &&
          modeAvailable(input.right.candidates, relation.rightModeId) &&
          supportAvailable(input.left.candidates, relation.supportsLeft) &&
          supportAvailable(input.right.candidates, relation.supportsRight)
      )
      .map((relation) => {
        const leftModeId = relation.leftModeId ?? firstAvailableMode(input.left.candidates, relation.supportsLeft) ?? input.left.candidates[0].modeId;
        const rightModeId = relation.rightModeId ?? firstAvailableMode(input.right.candidates, relation.supportsRight) ?? input.right.candidates[0].modeId;
        const rightReceivesDescription =
          relation.relation === "describe" &&
          ((isPersonAnchor(input.rightCard.id) && !isPersonAnchor(input.leftCard.id)) || (input.rightCard.semanticAgency === "passive_anchor" && !isPersonAnchor(input.leftCard.id)));
        const leftReceivesDescription =
          relation.relation === "describe" &&
          ((isPersonAnchor(input.leftCard.id) && !isPersonAnchor(input.rightCard.id)) || (input.leftCard.semanticAgency === "passive_anchor" && !isPersonAnchor(input.rightCard.id)));
        const subjectCardId = rightReceivesDescription ? input.rightCard.id : leftReceivesDescription ? input.leftCard.id : input.leftCard.id;
        const operatorCardId = rightReceivesDescription ? input.leftCard.id : leftReceivesDescription ? input.rightCard.id : input.rightCard.id;
        const subjectModeId = rightReceivesDescription ? rightModeId : leftReceivesDescription ? leftModeId : leftModeId;
        const operatorModeId = rightReceivesDescription ? leftModeId : leftReceivesDescription ? rightModeId : rightModeId;
        return buildRelation(
          input,
          relation.relation,
          subjectCardId,
          operatorCardId,
          subjectModeId,
          operatorModeId,
          override.priority === "high" ? "high" : "medium",
          [{ source: "pair_override", code: override.code }],
          20 + (override.priority === "high" ? 4 : 2),
          relation.semanticPatch
        );
      })
  );
}

function emitNeighborEvidence(input: PairInput, primary: PairRelationCandidate, alternatives: PairRelationCandidate[]): NeighborEvidence[] {
  const relations = [primary, ...alternatives];
  const evidence: NeighborEvidence[] = [];
  for (const relation of relations) {
    evidence.push({
      sourceCardId: relation.operatorCardId ?? input.leftCard.id,
      targetCardId: relation.subjectCardId,
      supportsModes: [relation.subjectModeId],
      suggestsRole: relation.relation === "communicate" ? "information" : relation.relation === "erode" ? "obstacle" : undefined,
      relationCandidate: relation.relation,
      confidence: relation.confidence,
      evidenceCode: `PAIR_SUPPORTS_${relation.relation.toUpperCase()}_${relation.subjectModeId.toUpperCase()}`
    });
    if (relation.operatorCardId && relation.operatorModeId) {
      evidence.push({
        sourceCardId: relation.subjectCardId,
        targetCardId: relation.operatorCardId,
        supportsModes: [relation.operatorModeId],
        relationCandidate: relation.relation,
        confidence: relation.confidence,
        evidenceCode: `PAIR_SUPPORTS_OPERATOR_${relation.operatorModeId.toUpperCase()}`
      });
    }
  }
  if (
    input.question.domain === "study" &&
    (input.question.primaryTopic === "academic_project" || input.question.primaryTopic === "research" || input.question.object.type === "project") &&
    input.leftCard.id === 11 &&
    input.rightCard.id === 13 &&
    primary.subjectModeId === "editing_revision_research"
  ) {
    evidence.push({
      sourceCardId: input.leftCard.id,
      targetCardId: input.rightCard.id,
      supportsModes: ["simplicity_reduction"],
      suppressesModes: ["new_beginning"],
      relationCandidate: primary.relation,
      confidence: "high",
      evidenceCode: "PAIR_SUPPORTS_STUDY_REVISION_SIMPLIFICATION"
    });
  }
  return evidence;
}

function determinePairUnresolved(input: PairInput, primary: PairRelationCandidate, alternatives: PairRelationCandidate[]) {
  if (input.left.unresolved || input.right.unresolved) return true;
  if (input.left.candidates.some((candidate) => candidate.requiresNeighborResolution) || input.right.candidates.some((candidate) => candidate.requiresNeighborResolution)) return true;
  if (alternatives[0] && Math.abs(primary.internalScore - alternatives[0].internalScore) <= 1) return true;
  if ([input.leftCard.ambiguityLevel, input.rightCard.ambiguityLevel].every((item) => item === "high")) return true;
  return false;
}

function buildBehavior(
  input: PairInput,
  behavior: SpecialBehavior,
  relation: PairRelationType,
  subjectCardId: number,
  operatorCardId: number,
  subjectModeId: string,
  operatorModeId: string,
  left: SemanticCandidate,
  right: SemanticCandidate,
  patch: Partial<PairSemanticResult>
) {
  return buildRelation(
    input,
    relation,
    subjectCardId,
    operatorCardId,
    subjectModeId,
    operatorModeId,
    "high",
    [{ source: "special_behavior", code: `BEHAVIOR_${behavior.toUpperCase()}`, detail: behavior }],
    scorePair(left, right, relation) + 3,
    patch
  );
}

function buildRelation(
  input: PairInput,
  relation: PairRelationType,
  subjectCardId: number,
  operatorCardId: number | undefined,
  subjectModeId: string,
  operatorModeId: string | undefined,
  confidence: PairRelationCandidate["confidence"],
  evidence: PairEvidence[],
  internalScore: number,
  patch?: Partial<PairSemanticResult>
): PairRelationCandidate {
  const semanticResult: PairSemanticResult = {
    headConcept: subjectModeId,
    qualifiers: operatorModeId ? [operatorModeId] : undefined,
    action: relation,
    stateChange: relationToStateChange(relation),
    informationState: relationToInformationState(relation),
    quantityEffect: relation === "pluralize" ? "multiple" : undefined,
    ...patch
  };
  return { relation, subjectCardId, operatorCardId, subjectModeId, operatorModeId, semanticResult, confidence, evidence: [{ source: "card_order", code: orderedPairKey(input.leftCard.id, input.rightCard.id) }, ...evidence], internalScore };
}

function fallbackRelation(input: PairInput, left: SemanticCandidate, right: SemanticCandidate) {
  return buildRelation(input, "describe", input.leftCard.id, input.rightCard.id, left.modeId, right.modeId, "low", [{ source: "card_order", code: "DEFAULT_LEFT_SUBJECT_RIGHT_MODIFIER" }], scorePair(left, right, "describe"));
}

function bestBehavior(card: CardLexiconEntry, modeId: string) {
  if (card.id === 33) {
    if (modeId === "solution_unlock") return getBehaviorRelation("unlock_adjacent_theme");
    if (modeId === "confirmation_certainty") return getBehaviorRelation("confirm_adjacent_theme");
    if (modeId === "importance_significance") return getBehaviorRelation("mark_importance");
    return null;
  }
  const behavior = (card.specialBehaviors ?? []).find((item) => {
    if (modeId.includes("clarity") && item === "clarify_adjacent_theme") return true;
    if (modeId.includes("unknown") && item === "mark_unknown") return true;
    if (card.id === 26 && (item === "hide_adjacent_theme" || item === "mark_unknown")) {
      return modeId === "unknown_information" || modeId === "secret_hidden";
    }
    if (card.id === 26 && item === "document_adjacent_theme") {
      return modeId === "physical_book_record";
    }
    return Boolean(getBehaviorRelation(item));
  });
  return behavior ? getBehaviorRelation(behavior) : null;
}

function roleRelation(input: PairInput, left: SemanticCandidate, right: SemanticCandidate, leftMode: SemanticMode, rightMode: SemanticMode): PairRelationType {
  if (
    (input.leftCard.semanticAgency === "passive_anchor" && shouldSuppressPassiveAnchorDescription(input.rightCard, right.modeId)) ||
    (input.rightCard.semanticAgency === "passive_anchor" && shouldSuppressPassiveAnchorDescription(input.leftCard, left.modeId))
  ) {
    return "associate";
  }
  if (
    input.question.domain === "study" &&
    (input.question.primaryTopic === "academic_project" || input.question.primaryTopic === "research" || input.question.object.type === "project") &&
    input.leftCard.id === 34 &&
    input.rightCard.id === 26 &&
    ["abundance_quantity", "depth", "cashflow_circulation"].includes(left.modeId) &&
    ["knowledge_learning", "research_investigation", "project_case"].includes(right.modeId)
  ) {
    return "modify";
  }
  if (left.roles.includes("information") || right.roles.includes("information")) return "communicate";
  if (right.roles.includes("obstacle")) return rightMode.id.includes("erosion") || rightMode.id.includes("loss") ? "erode" : "block";
  if (right.roles.includes("duration")) return "stabilize";
  if (right.roles.includes("quantity")) return "modify";
  if (leftMode.id.includes("change") || rightMode.id.includes("change")) return "change";
  if (left.roles.includes("resource") && rightMode.id.includes("financial")) return "associate";
  return "describe";
}

function getCompatibility(left: SemanticCandidate, right: SemanticCandidate, leftMode: SemanticMode, rightMode: SemanticMode): ModePairCandidate["compatibility"] {
  if (left.planes.some((plane) => right.planes.includes(plane))) return "strong";
  if (left.roles.some((role) => right.roles.includes(role))) return "compatible";
  if ((left.roles.includes("information") && right.roles.includes("obstacle")) || (left.roles.includes("resource") && right.roles.includes("resource"))) return "compatible";
  if (leftMode.id === rightMode.id) return "weak";
  return "weak";
}

function scorePair(left: SemanticCandidate, right: SemanticCandidate, relation: PairRelationType) {
  return TIER_SCORE[left.relevance] + TIER_SCORE[right.relevance] + (["describe", "communicate", "bind", "erode", "block", "confirm"].includes(relation) ? 2 : 1);
}

function modeAvailable(candidates: SemanticCandidate[], modeId?: string) {
  return !modeId || candidates.some((candidate) => candidate.modeId === modeId && !candidate.blocked);
}

function firstAvailableMode(candidates: SemanticCandidate[], modeIds?: string[]) {
  return modeIds?.find((modeId) => modeAvailable(candidates, modeId));
}

function supportAvailable(candidates: SemanticCandidate[], modeIds?: string[]) {
  return !modeIds || modeIds.some((modeId) => modeAvailable(candidates, modeId));
}

function isPersonAnchor(cardId: number) {
  return cardId === 28 || cardId === 29;
}

function findMode(card: CardLexiconEntry, modeId: string) {
  const mode = card.semanticModes.find((item) => item.id === modeId);
  if (!mode) throw new Error(`${card.name} missing mode ${modeId}`);
  return mode;
}

function relationOrder(relation: PairRelationType) {
  const index = ["end", "cut", "block", "erode", "unlock", "confirm", "sequence", "bind", "stabilize", "communicate", "describe", "associate"].indexOf(relation);
  return index === -1 ? 999 : index;
}

function relationToStateChange(relation: PairRelationType): PairSemanticResult["stateChange"] {
  if (relation === "end" || relation === "finalize" || relation === "cut") return "end";
  if (relation === "block") return "block";
  if (relation === "erode") return "decrease";
  if (relation === "change") return "change";
  if (relation === "unlock") return "unlock";
  if (relation === "confirm") return "confirm";
  if (relation === "stabilize") return "stabilize";
  return undefined;
}

function relationToInformationState(relation: PairRelationType): PairSemanticResult["informationState"] {
  if (relation === "hide") return "hidden";
  if (relation === "clarify" || relation === "confirm") return "confirmed";
  if (relation === "communicate") return "written";
  if (relation === "publicize") return "public";
  return undefined;
}
