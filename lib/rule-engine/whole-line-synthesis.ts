import { QuestionContext } from "./ontology";
import { PairInterpretation, PairRelationType, ResolvedCardMeaning } from "./pair-types";
import { SpreadStructure } from "./spread-types";
import { assertValidSynthesisInput, assertValidSynthesisResult } from "./synthesis-schema";
import { deduplicateSemanticUnits } from "./synthesis-dedup";
import {
  ClosingState,
  ClosingStateType,
  NarrativeFunction,
  NarrativeUnit,
  SafetyFlag,
  SemanticUnit,
  SemanticUnitType,
  SynthesisCondition,
  SynthesisConclusion,
  SynthesisConclusionType,
  SynthesisMainProcess,
  SynthesisResult,
  SynthesisTheme,
  SynthesisTransition,
  SynthesisTransitionType,
  UnresolvedPoint,
  WholeLineSynthesisInput
} from "./synthesis-types";

const ENGINE_VERSION = "whole-line-synthesis-1.0.0";

export function synthesizeWholeLine(input: WholeLineSynthesisInput): SynthesisResult {
  const validInput = assertValidSynthesisInput(input);
  const collectedUnits = collectSynthesisUnits(validInput);
  const deduped = deduplicateSemanticUnits(collectedUnits);
  const coreTheme = resolveCoreTheme(validInput, deduped.units);
  const mainProcess = resolveMainProcess(validInput);
  const keyTransitions = resolveKeyTransitions(validInput);
  const conditions = resolveConditions(validInput, deduped.units);
  const closingState = resolveClosingState(validInput);
  const unresolvedPoints = resolveUnresolvedPoints(validInput);
  const safetyFlags = resolveSafetyFlags(validInput);
  const narrativeUnits = buildNarrativeUnits(validInput, deduped.units, coreTheme, mainProcess, keyTransitions, conditions, closingState);
  const confidence = resolveConfidence(validInput, unresolvedPoints, safetyFlags);
  const conclusion = buildConclusion(validInput.question, coreTheme, mainProcess, keyTransitions, conditions, closingState, unresolvedPoints);
  const result: SynthesisResult = {
    coreTheme,
    mainProcess,
    narrativeUnits,
    keyTransitions,
    conditions: conditions.length ? conditions : undefined,
    closingState,
    conclusion,
    unresolvedPoints: unresolvedPoints.length ? unresolvedPoints : undefined,
    confidence,
    safetyFlags: safetyFlags.length ? safetyFlags : undefined,
    debugTrace: {
      collectedUnits,
      mergedUnits: deduped.units,
      removedDuplicates: deduped.removedDuplicates,
      selectedCoreTheme: coreTheme,
      selectedMainProcess: mainProcess,
      appliedIntentProfile: validInput.question.intent,
      appliedConditions: conditions,
      unresolvedConflicts: unresolvedPoints,
      conclusionEvidence: conclusion.summaryConcepts
    },
    engineVersion: ENGINE_VERSION
  };
  return assertValidSynthesisResult(result);
}

function collectSynthesisUnits(input: WholeLineSynthesisInput): SemanticUnit[] {
  const units: SemanticUnit[] = [];
  const center = centerMeaning(input);
  units.push(unit("center", centerModeUnitType(center), center.primaryMode, [center.cardId], [center.primaryMode], centerSource(input.spread), "primary", center.confidence, targetFor(input.question), processForMode(center.primaryMode)));

  for (const pair of input.pairs) {
    const relation = pair.primaryRelation;
    units.push(
      unit(
        `pair-${pair.leftCardId}-${pair.rightCardId}`,
        unitTypeForRelation(relation.relation),
        conceptForPair(input, pair),
        [pair.leftCardId, pair.rightCardId],
        [relation.subjectModeId, relation.operatorModeId].filter((modeId): modeId is string => Boolean(modeId)),
        "pair",
        importantRelation(relation.relation) ? "primary" : "secondary",
        pair.unresolved ? "medium" : relation.confidence,
        targetFor(input.question),
        processForPair(input, pair)
      )
    );
  }

  units.push(unit("spread-process", "change", input.spread.semanticFrame.mainProcess ?? "mixed", input.spread.forwardChain.cardIds, [], "spread", "primary", input.spread.forwardChain.coherence === "coherent" ? "high" : "medium", targetFor(input.question), input.spread.semanticFrame.mainProcess));

  for (const mirror of "mirrors" in input.spread ? input.spread.mirrors : []) {
    if (mirror.function === "confirm") continue;
    units.push(
      unit(
        `mirror-${mirror.key}`,
        mirror.function === "subtext" ? "information" : "condition",
        `${mirror.key}:${mirror.relationSummary}`,
        [mirror.leftCardId, mirror.rightCardId],
        [mirror.forwardRelation.primaryRelation.subjectModeId, mirror.forwardRelation.primaryRelation.operatorModeId].filter((modeId): modeId is string => Boolean(modeId)),
        "mirror",
        "supporting",
        mirror.conflictsWithMainChain ? "low" : "medium",
        targetFor(input.question),
        mirror.relationSummary
      )
    );
  }

  return units;
}

function resolveCoreTheme(input: WholeLineSynthesisInput, units: SemanticUnit[]): SynthesisTheme {
  const center = centerMeaning(input);
  const centerPairs = input.spread.spreadSize === 3 ? input.pairs : input.pairs.slice(1, 3);
  const relationModes = centerPairs.flatMap((pair) => [pair.primaryRelation.subjectModeId, pair.primaryRelation.operatorModeId]).filter((modeId): modeId is string => Boolean(modeId));
  const evidenceCodes = [`${centerSource(input.spread).toUpperCase()}_${center.cardId}`, ...centerPairs.map((pair) => `PAIR_${pair.leftCardId}>${pair.rightCardId}`)];
  const supportingCardIds = uniqueNumbers(centerPairs.flatMap((pair) => [pair.leftCardId, pair.rightCardId]).filter((cardId) => cardId !== center.cardId));
  return {
    label: labelCoreTheme(input.question, center, relationModes, units),
    primaryCardId: center.cardId,
    primaryModeIds: uniqueStrings([center.primaryMode, ...relationModes]),
    supportingCardIds,
    evidenceCodes,
    confidence: center.confidence === "high" && centerPairs.length >= 2 ? "high" : "medium"
  };
}

function resolveMainProcess(input: WholeLineSynthesisInput): SynthesisMainProcess {
  const relations = input.spread.forwardChain.pairRelations;
  const modes = input.resolvedCards.map((card) => card.primaryMode);
  const spreadProcess = input.spread.semanticFrame.mainProcess;
  if (relations.includes("erode")) return relations.includes("stabilize") || modes.some((mode) => /stability|persistence/.test(mode)) ? "eroding" : "deteriorating";
  if (relations.includes("block")) return relations.some((relation) => relation === "sequence" || relation === "unlock") ? "delayed" : "blocked";
  if ((relations.includes("end") || relations.includes("finalize")) && relations.includes("sequence") && modes.some((mode) => /clarity|success|relief|recovery/.test(mode))) return "improving";
  if (relations.includes("sequence") || relations.includes("change")) return "changing";
  if (relations.includes("confirm") && relations.includes("hide")) return "clarifying";
  if (relations.includes("confirm")) return "confirming";
  if (relations.includes("clarify") || relations.includes("communicate")) return "clarifying";
  if (relations.includes("repeat")) return relations.includes("modify") ? "repeating" : "repeating";
  if (relations.includes("hide")) return "uncertain";
  if (relations.includes("stabilize")) return "stabilizing";
  if (relations.includes("bind")) return "binding";
  if (relations.includes("end") || relations.includes("finalize")) return "ending";
  if (relations.includes("cut")) return "cutting";
  if (relations.includes("burden")) return spreadProcess === "ending" ? "ending" : "blocked";
  if (spreadProcess) return spreadProcess;
  return "none";
}

function resolveKeyTransitions(input: WholeLineSynthesisInput): SynthesisTransition[] {
  const candidates = input.pairs
    .map((pair) => transitionForPair(input, pair))
    .filter((transition): transition is SynthesisTransition => Boolean(transition));
  const prioritized = candidates.sort((a, b) => transitionPriority(b.type) - transitionPriority(a.type));
  const max = input.spread.spreadSize === 3 ? 2 : 3;
  return prioritized.slice(0, max).sort((a, b) => input.spread.forwardChain.cardIds.indexOf(a.cardIds[0]) - input.spread.forwardChain.cardIds.indexOf(b.cardIds[0]));
}

function resolveConditions(input: WholeLineSynthesisInput, units: SemanticUnit[]): SynthesisCondition[] {
  const conditions: SynthesisCondition[] = [];
  const add = (condition: SynthesisCondition) => {
    if (!conditions.some((item) => item.type === condition.type && item.concept === condition.concept)) conditions.push(condition);
  };

  const hasUncertainty = units.some((unit) => /uncertain|confusion|unclear|unknown|secret/.test(unit.concept) || unit.process === "hide");
  if (hasUncertainty) {
    add({
      type: input.question.domain === "relationship" ? "relationship_constraint" : "uncertainty",
      concept: input.question.domain === "relationship" ? "relationship definition unclear" : "information remains unclear",
      cardIds: cardsForModes(input, ["uncertainty", "confusion", "unknown_information", "secret_hidden"]),
      evidenceCodes: ["CONDITION_UNCERTAINTY"],
      confidence: "medium"
    });
  }

  for (const mirror of "mirrors" in input.spread ? input.spread.mirrors : []) {
    if (mirror.function === "qualify" || mirror.function === "contrast") {
      add({
        type: mirror.conflictsWithMainChain ? "uncertainty" : "other",
        concept: `mirror ${mirror.key} ${mirror.function}: ${mirror.relationSummary}`,
        cardIds: [mirror.leftCardId, mirror.rightCardId],
        evidenceCodes: [`MIRROR_${mirror.key}_${mirror.function.toUpperCase()}`],
        confidence: mirror.conflictsWithMainChain ? "low" : "medium"
      });
    }
  }

  return conditions;
}

function resolveClosingState(input: WholeLineSynthesisInput): ClosingState {
  const closingCard = input.resolvedCards.find((card) => card.cardId === input.spread.forwardChain.cardIds[input.spread.forwardChain.cardIds.length - 1]);
  const relation = input.spread.forwardChain.pairRelations[input.spread.forwardChain.pairRelations.length - 1];
  const type = closingType(input, relation, closingCard);
  return {
    type,
    cardIds: closingCard ? [closingCard.cardId] : [],
    evidence: [`CLOSING_${type.toUpperCase()}`, relation ? `RELATION_${relation.toUpperCase()}` : "CLOSING_UNKNOWN"],
    confidence: input.spread.forwardChain.coherence === "coherent" ? "high" : "medium"
  };
}

function resolveUnresolvedPoints(input: WholeLineSynthesisInput): UnresolvedPoint[] {
  const points: UnresolvedPoint[] = [];
  const unresolvedPairs = input.pairs.filter((pair) => pair.unresolved);
  if (unresolvedPairs.length) {
    points.push({
      type: "pair_unresolved",
      concept: "some pair modes remain close alternatives",
      cardIds: uniqueNumbers(unresolvedPairs.flatMap((pair) => [pair.leftCardId, pair.rightCardId])),
      evidenceCodes: unresolvedPairs.map((pair) => `PAIR_${pair.leftCardId}>${pair.rightCardId}_UNRESOLVED`),
      confidence: "medium"
    });
  }
  for (const conflict of input.spread.conflicts ?? []) {
    points.push({
      type: conflict.type === "mirror_chain_conflict" ? "mirror_conflict" : conflict.type === "person_mapping_conflict" ? "person_conflict" : "process_conflict",
      concept: conflict.type,
      cardIds: conflict.cardId ? [conflict.cardId] : input.spread.forwardChain.cardIds,
      evidenceCodes: [conflict.type.toUpperCase()],
      confidence: conflict.severity === "high" ? "high" : "medium"
    });
  }
  if (input.spread.warnings?.some((warning) => warning.type === "high_ambiguity")) {
    points.push({
      type: "high_ambiguity",
      concept: "high ambiguity survives synthesis",
      cardIds: input.spread.forwardChain.cardIds,
      evidenceCodes: ["WARNING_HIGH_AMBIGUITY"],
      confidence: "medium"
    });
  }
  return points;
}

function resolveSafetyFlags(input: WholeLineSynthesisInput): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const modes = input.resolvedCards.flatMap((card) => [card.primaryMode, card.secondaryMode ?? "", ...(card.unresolvedAlternatives ?? [])]);
  const add = (flag: SafetyFlag) => {
    if (!flags.some((item) => item.type === flag.type)) flags.push(flag);
  };
  if (modes.some((mode) => /third_party|deception|snake|crossroads/.test(mode))) {
    add({ type: "third_party_not_confirmed", concept: "third-party or deception signals remain non-factual", cardIds: input.spread.forwardChain.cardIds, evidenceCodes: ["SAFETY_NO_CONFIRMED_THIRD_PARTY"] });
  }
  if (input.question.primaryTopic === "children" || /怀孕|pregnan|生育/.test(input.question.object.label) || modes.some((mode) => /pregnancy|reproductive|child/.test(mode))) {
    add({ type: "pregnancy_not_confirmed", concept: "child or reproductive signals cannot confirm pregnancy", cardIds: input.spread.forwardChain.cardIds, evidenceCodes: ["SAFETY_NO_CONFIRMED_PREGNANCY"] });
  }
  if (input.question.primaryTopic === "wellbeing" || modes.some((mode) => /health/.test(mode))) {
    add({ type: "health_not_diagnosis", concept: "health signals are not diagnosis", cardIds: input.spread.forwardChain.cardIds, evidenceCodes: ["SAFETY_NO_MEDICAL_DIAGNOSIS"] });
  }
  if (input.question.primaryTopic === "investment") {
    add({ type: "investment_not_guaranteed", concept: "investment signals are not guarantees", cardIds: input.spread.forwardChain.cardIds, evidenceCodes: ["SAFETY_NO_INVESTMENT_GUARANTEE"] });
  }
  return flags;
}

function buildNarrativeUnits(
  input: WholeLineSynthesisInput,
  units: SemanticUnit[],
  coreTheme: SynthesisTheme,
  mainProcess: SynthesisMainProcess,
  transitions: SynthesisTransition[],
  conditions: SynthesisCondition[],
  closingState: ClosingState
): NarrativeUnit[] {
  const narrative: Omit<NarrativeUnit, "order">[] = [
    {
      function: "theme",
      concept: coreTheme.label,
      cardIds: uniqueNumbers([coreTheme.primaryCardId, ...coreTheme.supportingCardIds]),
      evidenceCodes: coreTheme.evidenceCodes,
      confidence: coreTheme.confidence
    },
    {
      function: "process",
      concept: mainProcess,
      cardIds: input.spread.forwardChain.cardIds,
      evidenceCodes: ["FORWARD_CHAIN", `PROCESS_${mainProcess.toUpperCase()}`],
      confidence: input.spread.forwardChain.coherence === "coherent" ? "high" : "medium"
    }
  ];

  const transition = transitions[0];
  if (transition) {
    narrative.push({
      function: "transition",
      concept: `${transition.fromConcept ?? "state"} -> ${transition.toConcept ?? transition.type}`,
      cardIds: transition.cardIds,
      evidenceCodes: transition.evidenceCodes,
      confidence: transition.confidence
    });
  }

  const condition = conditions[0];
  if (condition) {
    narrative.push({
      function: "condition",
      concept: condition.concept,
      cardIds: condition.cardIds,
      evidenceCodes: condition.evidenceCodes,
      confidence: condition.confidence
    });
  }

  narrative.push({
    function: "result",
    concept: closingState.type,
    cardIds: closingState.cardIds,
    evidenceCodes: closingState.evidence,
    confidence: closingState.confidence
  });

  const limit = input.spread.spreadSize === 3 ? 4 : 6;
  return narrative
    .filter((item, index, list) => list.findIndex((other) => other.function === item.function && other.concept === item.concept) === index)
    .slice(0, limit)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function buildConclusion(
  question: QuestionContext,
  coreTheme: SynthesisTheme,
  mainProcess: SynthesisMainProcess,
  transitions: SynthesisTransition[],
  conditions: SynthesisCondition[],
  closingState: ClosingState,
  unresolvedPoints: UnresolvedPoint[]
): SynthesisConclusion {
  const type = conclusionTypeForIntent(question.intent);
  const conditionConcepts = conditions.map((condition) => condition.concept);
  const summaryConcepts = uniqueStrings([coreTheme.label, mainProcess, closingState.type, ...transitions.map((transition) => transition.type)]);
  return {
    type,
    subject: subjectFor(question),
    summary: summaryConcepts.slice(0, 3).join(" | "),
    summaryConcepts,
    support: unresolvedPoints.some((point) => point.type === "mirror_conflict" || point.type === "process_conflict")
      ? "conditional"
      : unresolvedPoints.length
        ? "unclear"
        : "supported",
    conditions: conditionConcepts.length ? conditionConcepts : undefined,
    unresolved: unresolvedPoints.length ? true : undefined,
    evidenceCardIds: uniqueNumbers([coreTheme.primaryCardId, ...coreTheme.supportingCardIds, ...closingState.cardIds])
  };
}

function labelCoreTheme(question: QuestionContext, center: ResolvedCardMeaning, relationModes: string[], units: SemanticUnit[]) {
  const text = [center.primaryMode, ...relationModes, ...units.map((unit) => unit.concept)].join(" ");
  if (/uncertainty|confusion|hide|unclear/.test(text) && question.domain === "relationship") return "uncertainty around feelings/relationship";
  if (/project_case/.test(text) && /editing_revision_research|practice_discipline|revision|editing|repeat/.test(text)) return "project revision / repeated editing";
  if (/project_case/.test(text) && /long_term_growth|stability_security|persistence_duration/.test(text)) return "project long-term stabilization";
  if (/erosion|loss|diminish/.test(text) && /love|affection|attraction/.test(text)) return "persistent emotional erosion";
  if (/blockage_obstacle/.test(text) && /ending_closure/.test(text) && /success|clarity/.test(text)) return "obstacle ending into clearer state";
  if (question.domain === "relationship" && /commitment_bond|love_affection/.test(text) && /uncertainty|confusion/.test(text)) return "relationship uncertainty";
  if (question.domain === "relationship" && /loyalty_trust/.test(text) && /commitment_bond|love_affection|stability_security|persistence_duration/.test(text)) return "trust and bond persistence";
  if (question.domain === "relationship" && /commitment_bond|love_affection/.test(text) && /stability_security|persistence_duration|long_duration/.test(text)) return "trust and bond persistence";
  if (/blockage_obstacle/.test(text) && /stability_security|persistence_duration|long_term_growth/.test(text)) return "fixed obstacle / slow persistence";
  return center.primaryMode;
}

function transitionForPair(input: WholeLineSynthesisInput, pair: PairInterpretation): SynthesisTransition | undefined {
  const relation = pair.primaryRelation.relation;
  const type = transitionTypeForRelation(relation, pair.primaryRelation.semanticResult.stateChange);
  if (!type || !importantTransition(input, pair)) return undefined;
  return {
    type,
    fromConcept: pair.primaryRelation.subjectModeId,
    toConcept: pair.primaryRelation.operatorModeId,
    cardIds: [pair.leftCardId, pair.rightCardId],
    evidenceCodes: [`PAIR_${pair.leftCardId}>${pair.rightCardId}`, `RELATION_${relation.toUpperCase()}`],
    confidence: pair.primaryRelation.confidence
  };
}

function transitionTypeForRelation(relation: PairRelationType, stateChange: unknown): SynthesisTransitionType | undefined {
  if (relation === "sequence") return "change";
  if (relation === "end" || relation === "finalize" || stateChange === "end") return "end";
  if (relation === "erode") return "erode";
  if (relation === "block") return "block";
  if (relation === "hide") return "hide";
  if (relation === "confirm") return "confirm";
  if (relation === "clarify") return "clarify";
  if (relation === "communicate") return "communicate";
  if (relation === "unlock") return "resolve";
  if (relation === "bind") return "bind";
  if (relation === "stabilize") return "stabilize";
  if (relation === "repeat") return "repeat";
  if (relation === "publicize") return "publicize";
  if (relation === "modify" || relation === "change") return "change";
  if (relation === "cut") return "cut";
  if (relation === "burden") return "burden";
  return undefined;
}

function resolveConfidence(input: WholeLineSynthesisInput, unresolvedPoints: UnresolvedPoint[], safetyFlags: SafetyFlag[]) {
  if (input.spread.forwardChain.coherence === "conflicted" || unresolvedPoints.filter((point) => point.type !== "pair_unresolved").length > 2) return "low";
  if (unresolvedPoints.length || safetyFlags.length || input.spread.forwardChain.coherence === "mostly_coherent") return "medium";
  return "high";
}

function closingType(input: WholeLineSynthesisInput, relation: PairRelationType | undefined, closingCard?: ResolvedCardMeaning): ClosingStateType {
  if (input.spread.semanticFrame.closingEffect === "open") return "open";
  if (input.spread.semanticFrame.closingEffect === "unclear") return "unclear";
  if (relation === "confirm" || relation === "clarify") return "confirmed";
  if (relation === "block") return "blocked";
  if (relation === "end" || relation === "finalize" || relation === "cut") return "ended";
  if (relation === "sequence" || relation === "change" || relation === "modify") return "changed";
  if (relation === "repeat") return "repeating";
  if (relation === "erode") return "deteriorating";
  if (relation === "stabilize" && closingCard?.primaryMode.includes("stability")) return "stable";
  if (relation === "bind") return "open";
  return input.spread.semanticFrame.closingEffect === "neutral" ? "open" : "mixed";
}

function conclusionTypeForIntent(intent: QuestionContext["intent"]): SynthesisConclusionType {
  if (intent === "reason") return "cause";
  if (intent === "development") return "trajectory";
  if (intent === "outcome") return "result_tendency";
  if (intent === "action") return "action_tendency";
  if (intent === "timing") return "timing_signal";
  if (intent === "description" || intent === "feelings_attitude" || intent === "state") return "state";
  if (intent === "location") return "location";
  if (intent === "advice" || intent === "decision" || intent === "comparison" || intent === "obstacle") return "condition";
  return "state";
}

function conceptForPair(input: WholeLineSynthesisInput, pair: PairInterpretation) {
  const relation = pair.primaryRelation;
  if (relation.relation === "erode" && input.resolvedCards.some((card) => /heart|love|affection|attraction/.test(card.primaryMode))) return "emotional erosion";
  if (relation.relation === "stabilize" && input.resolvedCards.some((card) => /erosion|loss|stress/.test(card.primaryMode))) return "persistent emotional erosion";
  if (relation.relation === "sequence" && relation.subjectModeId.includes("ending")) return `ending-state followed by ${relation.operatorModeId ?? "next state"}`;
  if (relation.relation === "repeat" && /project|revision|editing/.test(`${relation.subjectModeId} ${relation.operatorModeId ?? ""}`)) return "project revision repetition";
  if (relation.relation === "modify" && relation.operatorModeId === "simplicity_reduction") return "revision changes toward simplification";
  return `${relation.subjectModeId} ${relation.relation} ${relation.operatorModeId ?? "adjacent theme"}`;
}

function centerMeaning(input: WholeLineSynthesisInput) {
  const centerCardId = input.spread.spreadSize === 3 ? input.spread.hingeCardId : input.spread.focusCardId;
  const center = input.resolvedCards.find((card) => card.cardId === centerCardId);
  if (!center) throw new Error(`Missing center card ${centerCardId}.`);
  return center;
}

function centerSource(spread: SpreadStructure) {
  return spread.spreadSize === 3 ? "hinge" : "focus";
}

function unit(
  id: string,
  type: SemanticUnitType,
  concept: string,
  cardIds: number[],
  modeIds: string[],
  source: SemanticUnit["source"],
  importance: SemanticUnit["importance"],
  confidence: SemanticUnit["confidence"],
  target?: string,
  process?: string
): SemanticUnit {
  return {
    id,
    type,
    concept,
    target,
    process,
    cardIds: uniqueNumbers(cardIds),
    modeIds: uniqueStrings(modeIds),
    source,
    evidenceRefs: [id.toUpperCase()],
    importance,
    confidence
  };
}

function centerModeUnitType(meaning: ResolvedCardMeaning): SemanticUnitType {
  if (meaning.role === "information") return "information";
  if (meaning.role === "action") return "action";
  if (meaning.role === "obstacle") return "block";
  if (meaning.role === "result") return "result";
  if (meaning.role === "person_anchor") return "person";
  return "theme";
}

function unitTypeForRelation(relation: PairRelationType): SemanticUnitType {
  if (relation === "block" || relation === "hide") return "block";
  if (relation === "end" || relation === "cut" || relation === "sequence" || relation === "change" || relation === "erode") return "change";
  if (relation === "communicate" || relation === "confirm" || relation === "clarify") return "information";
  if (relation === "repeat" || relation === "bind" || relation === "stabilize") return "state";
  return "theme";
}

function importantRelation(relation: PairRelationType) {
  return ["change", "cut", "end", "finalize", "block", "burden", "confirm", "bind", "stabilize", "erode", "clarify", "repeat", "sequence", "hide", "modify", "publicize", "unlock"].includes(relation);
}

function importantTransition(input: WholeLineSynthesisInput, pair: PairInterpretation) {
  const relation = pair.primaryRelation.relation;
  const semantic = pair.primaryRelation.semanticResult;
  if (importantRelation(relation)) return true;
  if (relation !== "communicate") return false;
  const modeText = [pair.primaryRelation.subjectModeId, pair.primaryRelation.operatorModeId, semantic.headConcept, ...(semantic.qualifiers ?? [])].join(" ");
  return (
    input.spread.semanticFrame.mainProcess === "clarifying" ||
    /uncertainty|confusion|unknown|secret|written_message|document|confirmation/.test(modeText) ||
    semantic.informationState !== undefined
  );
}

function processForRelation(relation: PairRelationType) {
  if (relation === "sequence") return "changing";
  if (relation === "end" || relation === "finalize") return "ending";
  if (relation === "erode") return "eroding";
  if (relation === "burden") return "blocked";
  return relation;
}

function processForPair(input: WholeLineSynthesisInput, pair: PairInterpretation) {
  const relation = pair.primaryRelation.relation;
  if (relation === "stabilize" && input.resolvedCards.some((card) => /erosion|loss|stress/.test(card.primaryMode))) return "eroding";
  return processForRelation(relation);
}

function processForMode(modeId: string) {
  if (/uncertain|confusion/.test(modeId)) return "uncertain";
  if (/revision|repeat|practice/.test(modeId)) return "repeating";
  if (/ending|closure/.test(modeId)) return "ending";
  if (/stability|persistence/.test(modeId)) return "stabilizing";
  return undefined;
}

function targetFor(question: QuestionContext) {
  if (question.actionFrame?.action) return question.actionFrame.action;
  if (question.perspective?.subjectPersonId || question.perspective?.objectPersonId) return [question.perspective.subjectPersonId, question.perspective.objectPersonId].filter(Boolean).join("->");
  return question.object.label || question.object.type;
}

function subjectFor(question: QuestionContext) {
  if (question.actionFrame?.actorPersonId) return question.actionFrame.actorPersonId;
  if (question.perspective?.subjectPersonId) return question.perspective.subjectPersonId;
  return question.object.label || question.object.type;
}

function cardsForModes(input: WholeLineSynthesisInput, modeIds: string[]) {
  const cards = input.resolvedCards
    .filter((card) => modeIds.includes(card.primaryMode) || (card.secondaryMode && modeIds.includes(card.secondaryMode)) || card.unresolvedAlternatives?.some((mode) => modeIds.includes(mode)))
    .map((card) => card.cardId);
  return cards.length ? cards : input.spread.forwardChain.cardIds;
}

function transitionPriority(type: SynthesisTransitionType) {
  const order: SynthesisTransitionType[] = ["erode", "block", "delay", "end", "cut", "change", "hide", "communicate", "clarify", "confirm", "resolve", "reveal", "bind", "stabilize", "repeat", "publicize", "continue", "approach", "begin", "improve", "worsen", "pluralize", "burden"];
  const index = order.indexOf(type);
  return index === -1 ? 0 : order.length - index;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values)).filter(Boolean);
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values));
}
