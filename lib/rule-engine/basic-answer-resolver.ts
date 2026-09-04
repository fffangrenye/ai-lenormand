import {
  AnswerBlocker,
  AnswerCondition,
  AnswerEvidence,
  AnswerProposition,
  AnswerUncertainty,
  BasicAnswerResolution,
  BasicAnswerResolutionLevel,
  BasicAnswerResolverInput,
  SemanticSupportSummary,
  TimingAnswerEffect
} from "./answer-types";
import { assertValidBasicAnswerResolverInput, assertValidBasicAnswerResolution } from "./answer-schema";
import { buildAnswerProposition } from "./proposition-builder";

const ENGINE_VERSION = "basic-answer-resolver-1.0.0";

export function resolveBasicAnswer(input: BasicAnswerResolverInput): BasicAnswerResolution {
  const validInput = assertValidBasicAnswerResolverInput(input);
  const proposition = buildAnswerProposition(validInput.question);
  const semantic = matchProposition(proposition, validInput);
  const conditions = collectConditions(validInput);
  const blockers = collectBlockers(proposition, validInput, semantic);
  const uncertainty = collectUncertainty(validInput);
  const timingEffect = resolveTimingEffect(proposition, validInput);
  const baseResolution = resolveLevel(validInput, proposition, semantic, conditions, blockers, uncertainty, timingEffect);
  const safetyApplied = applySafetyGuard(baseResolution, validInput);
  const confidence = resolveConfidence(validInput, semantic, conditions, blockers, uncertainty, timingEffect, safetyApplied);

  return assertValidBasicAnswerResolution({
    answerMode: validInput.question.answerMode,
    proposition,
    resolution: safetyApplied,
    semanticSupport: semantic.summary,
    supportEvidence: semantic.supportEvidence,
    opposingEvidence: semantic.opposingEvidence,
    conditions: conditions.length ? conditions : undefined,
    blockers: blockers.length ? blockers : undefined,
    uncertainty: uncertainty.length ? uncertainty : undefined,
    timingEffect,
    explanationCode: `ANSWER_${safetyApplied.toUpperCase()}_${semantic.summary.semanticDirection.toUpperCase()}`,
    confidence,
    safetyFlags: validInput.synthesis.safetyFlags?.length ? validInput.synthesis.safetyFlags : undefined,
    debugTrace: {
      proposition,
      candidateSemanticMatches: [...semantic.supportEvidence, ...semantic.opposingEvidence],
      supportEvidence: semantic.supportEvidence,
      opposingEvidence: semantic.opposingEvidence,
      conditions,
      blockers,
      uncertainty,
      timeframeEffect: timingEffect,
      unresolvedEffect: validInput.synthesis.unresolvedPoints?.length ? "unresolved reduced confidence" : undefined,
      safetyEffect: validInput.synthesis.safetyFlags?.length ? "safety guard applied" : undefined,
      finalResolution: safetyApplied,
      confidenceReason: confidence
    },
    engineVersion: ENGINE_VERSION
  });
}

type MatchResult = {
  summary: SemanticSupportSummary;
  supportEvidence: AnswerEvidence[];
  opposingEvidence: AnswerEvidence[];
};

function matchProposition(proposition: AnswerProposition, input: BasicAnswerResolverInput): MatchResult {
  const text = synthesisText(input);
  const support: AnswerEvidence[] = [];
  const oppose: AnswerEvidence[] = [];
  const missing: string[] = [];

  const addSupport = (type: AnswerEvidence["type"], concept: string, strength: AnswerEvidence["strength"], evidenceCodes: string[], cardIds?: number[]) => {
    support.push({ type, concept, strength, evidenceCodes, cardIds });
  };
  const addOppose = (type: AnswerEvidence["type"], concept: string, strength: AnswerEvidence["strength"], evidenceCodes: string[], cardIds?: number[]) => {
    oppose.push({ type, concept, strength, evidenceCodes, cardIds });
  };

  if (proposition.propositionType === "feeling") {
    if (/love_affection|attraction_passion|feelings|feeling|affection|attraction|heart/.test(text)) addSupport("feeling_match", "feeling/attraction evidence", "strong", ["MATCH_FEELING"]);
    if (/eroding|deteriorating|emotional erosion/.test(text)) addOppose("semantic_mismatch", "feeling is eroded or deteriorating", "medium", ["OPPOSE_FEELING_EROSION"]);
    if (!support.length) missing.push("feeling_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (isContactProposition(proposition)) {
    if (/communicate|written_message|oral_communication|incoming_news|message|contact/.test(text)) addSupport("action_match", "contact/communication evidence", "strong", ["MATCH_CONTACT"]);
    if (/blocked|blockage_obstacle|delayed/.test(text) && !/communicate|written_message|incoming_news/.test(text)) addOppose("semantic_mismatch", "action blocked without contact evidence", "medium", ["OPPOSE_ACTION_BLOCKED"]);
    if (!support.length) missing.push("contact_action_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (proposition.desiredState === "relationship_reconciliation") {
    if (/reconnection|reconciliation|returning bond|relationship_restoration/.test(text)) addSupport("state_match", "reconciliation evidence", "strong", ["MATCH_RECONCILIATION"]);
    if (/communicate|written_message|oral_communication|incoming_news/.test(text)) addSupport("action_match", "contact only, not reconciliation", "weak", ["CONTACT_NOT_RECONCILIATION"]);
    if (/block|erode|ending|cut/.test(text)) addOppose("semantic_mismatch", "relationship restoration is obstructed or ending", "medium", ["OPPOSE_RECONCILIATION"]);
    if (!support.some((item) => item.strength !== "weak")) missing.push("reconciliation_state_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (proposition.desiredState === "relationship_commitment") {
    if (/commitment_bond|bind|stabilize|stability_security|confirmed/.test(text)) addSupport("state_match", "commitment or stability evidence", "strong", ["MATCH_COMMITMENT"]);
    if (/uncertainty|confusion|unclear|hide/.test(text)) addOppose("semantic_mismatch", "relationship definition unclear", "medium", ["OPPOSE_COMMITMENT_UNCLEAR"]);
    if (!support.length) missing.push("commitment_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (proposition.desiredState === "resolved_or_successful_outcome" || /resolved|success|outcome/.test(proposition.desiredState ?? "")) {
    if (/obstacle ending|improving|changed|clarity|success_achievement|confirmed|resolve/.test(text)) addSupport("outcome_match", "obstacle shifts toward outcome", "strong", ["MATCH_OUTCOME_PROCESS"]);
    if (/blocked|stopped|eroding|deteriorating/.test(text) && !/ending into|improving|changed/.test(text)) addOppose("semantic_mismatch", "process blocks the desired outcome", "strong", ["OPPOSE_OUTCOME_BLOCKED"]);
    if (!support.length) missing.push("outcome_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (proposition.desiredState === "progress_or_change") {
    if (/improving|changing|developing|changed|change/.test(text)) addSupport("process_match", "change/progress process", "strong", ["MATCH_PROGRESS"]);
    if (/stabilizing|stable|fixed obstacle|slow persistence|persistent/.test(text)) addOppose("semantic_mismatch", "main process emphasizes persistence rather than change", "strong", ["OPPOSE_PROGRESS_PERSISTENCE"]);
    if (!support.length) missing.push("progress_or_change_evidence");
    return finish(proposition, support, oppose, missing, text);
  }

  if (proposition.propositionType === "development" || proposition.propositionType === "timing" || proposition.propositionType === "description" || proposition.propositionType === "location" || proposition.propositionType === "other") {
    addSupport("semantic_match", "open structural conclusion available", "weak", ["MATCH_OPEN_STRUCTURAL"]);
    return finish(proposition, support, oppose, [], text);
  }

  if (/supported|confirmed|improving|changed/.test(text)) addSupport("semantic_match", "general supportive semantic process", "medium", ["MATCH_GENERAL"]);
  if (/blocked|eroding|deteriorating|ended/.test(text)) addOppose("semantic_mismatch", "general opposing semantic process", "medium", ["OPPOSE_GENERAL"]);
  if (!support.length && !oppose.length) missing.push("direct_semantic_evidence");
  return finish(proposition, support, oppose, missing, text);
}

function finish(proposition: AnswerProposition, supportEvidence: AnswerEvidence[], opposingEvidence: AnswerEvidence[], missingComponents: string[], text: string): MatchResult {
  const strongSupport = supportEvidence.filter((item) => item.strength === "strong").length;
  const strongOppose = opposingEvidence.filter((item) => item.strength === "strong").length;
  const semanticDirection = strongSupport && strongOppose ? "mixed" : strongSupport ? "support" : strongOppose ? "oppose" : supportEvidence.length && opposingEvidence.length ? "mixed" : supportEvidence.length ? "support" : opposingEvidence.length ? "oppose" : "insufficient";
  return {
    summary: {
      propositionMatched: semanticDirection === "support" || semanticDirection === "mixed",
      supportingConcepts: supportEvidence.map((item) => item.concept),
      opposingConcepts: opposingEvidence.map((item) => item.concept),
      neutralConcepts: proposition.propositionType === "development" ? ["open trajectory question"] : undefined,
      missingComponents: missingComponents.length ? missingComponents : undefined,
      semanticDirection,
    },
    supportEvidence,
    opposingEvidence
  };
}

function collectConditions(input: BasicAnswerResolverInput): AnswerCondition[] {
  const conditions: AnswerCondition[] = [];
  for (const condition of input.synthesis.conditions ?? []) {
    conditions.push({
      type: /unclear|uncertainty|missing/.test(condition.concept) ? "clarity" : condition.type === "information_missing" ? "information_missing" : "other",
      concept: condition.concept,
      evidenceCardIds: condition.cardIds,
      importance: condition.confidence === "high" ? "primary" : "secondary"
    });
  }
  for (const condition of input.tempo?.conditions ?? []) {
    if (condition.type === "timeframe_tight") conditions.push({ type: "timing", concept: condition.concept, importance: "primary" });
    if (condition.type === "blocked_process") conditions.push({ type: "external_block", concept: condition.concept, importance: "primary" });
    if (condition.type === "open_timeframe") conditions.push({ type: "timing", concept: condition.concept, importance: "secondary" });
  }
  return uniqueBy(conditions, (item) => `${item.type}:${item.concept}`);
}

function collectBlockers(proposition: AnswerProposition, input: BasicAnswerResolverInput, semantic: MatchResult): AnswerBlocker[] {
  const blockers: AnswerBlocker[] = [];
  const text = synthesisText(input);
  if (/blocked|blockage_obstacle/.test(text) && !/ending into|improving/.test(text)) blockers.push({ type: "block", concept: "blocking process", severity: "high" });
  if (/delayed/.test(text) || input.tempo?.conditions?.some((condition) => condition.type === "timeframe_tight")) blockers.push({ type: "delay", concept: "timeframe or process delay", severity: "medium" });
  if (/eroding|deteriorating/.test(text)) blockers.push({ type: "erosion", concept: "erosion/deterioration process", severity: "medium" });
  if (/uncertainty|confusion|unclear|hide/.test(text)) blockers.push({ type: "confusion", concept: "unclear or hidden information", severity: "medium" });
  if (isContactProposition(proposition) && semantic.summary.missingComponents?.includes("contact_action_evidence")) blockers.push({ type: "lack_of_action", concept: "no contact/action evidence", severity: "high" });
  if (proposition.desiredState === "relationship_commitment" && semantic.summary.missingComponents?.includes("commitment_evidence")) blockers.push({ type: "lack_of_commitment", concept: "no commitment evidence", severity: "high" });
  return uniqueBy(blockers, (item) => `${item.type}:${item.concept}`);
}

function collectUncertainty(input: BasicAnswerResolverInput): AnswerUncertainty[] {
  const uncertainty: AnswerUncertainty[] = [];
  for (const point of input.synthesis.unresolvedPoints ?? []) {
    uncertainty.push({
      type: point.type === "mirror_conflict" || point.type === "process_conflict" ? "spread_conflict" : point.type === "person_conflict" ? "person_mapping" : point.type === "high_ambiguity" ? "semantic_ambiguity" : "semantic_ambiguity",
      concept: point.concept,
      severity: point.confidence === "high" ? "high" : "medium"
    });
  }
  if (input.tempo?.compatibility === "unknown" && input.tempo.timeframe.scope === "open") {
    uncertainty.push({ type: "timeframe", concept: "open timeframe", severity: "low" });
  }
  return uniqueBy(uncertainty, (item) => `${item.type}:${item.concept}`);
}

function resolveTimingEffect(proposition: AnswerProposition, input: BasicAnswerResolverInput): TimingAnswerEffect | undefined {
  if (!input.tempo || !proposition.timeframeBound) return undefined;
  if (input.tempo.compatibility === "well_matched") return { compatibility: input.tempo.compatibility, effect: "strengthen", reasonCode: "TIMEFRAME_WELL_MATCHED" };
  if (input.tempo.compatibility === "possible") return { compatibility: input.tempo.compatibility, effect: "none", reasonCode: "TIMEFRAME_POSSIBLE" };
  if (input.tempo.compatibility === "strained") return { compatibility: input.tempo.compatibility, effect: "qualify", reasonCode: "TIMEFRAME_STRAINED" };
  if (input.tempo.compatibility === "mismatched") return { compatibility: input.tempo.compatibility, effect: "weaken", reasonCode: "TIMEFRAME_MISMATCHED_NOT_FALSE" };
  return { compatibility: input.tempo.compatibility, effect: "uncertain", reasonCode: "TIMEFRAME_UNKNOWN" };
}

function resolveLevel(input: BasicAnswerResolverInput, proposition: AnswerProposition, semantic: MatchResult, conditions: AnswerCondition[], blockers: AnswerBlocker[], uncertainty: AnswerUncertainty[], timingEffect?: TimingAnswerEffect): BasicAnswerResolutionLevel {
  if (input.question.answerMode === "open" || ["development", "timing", "description", "location", "other"].includes(proposition.propositionType)) return "not_applicable";
  if (semantic.summary.semanticDirection === "oppose") return semantic.supportEvidence.length ? "weakly_supported" : "not_supported";
  if (semantic.summary.semanticDirection === "insufficient") return semantic.supportEvidence.length ? "weakly_supported" : "unclear";
  if (semantic.summary.semanticDirection === "mixed") return conditions.length || blockers.length ? "conditional" : "unclear";
  if (timingEffect?.effect === "weaken") return "weakly_supported";
  if (timingEffect?.effect === "qualify" || conditions.some((condition) => condition.importance === "primary") || blockers.some((blocker) => blocker.severity === "high")) return "conditional";
  if (!semantic.supportEvidence.some((evidence) => evidence.strength === "strong")) return "weakly_supported";
  if (semantic.supportEvidence.some((evidence) => evidence.strength === "strong") && input.synthesis.confidence === "high" && !uncertainty.some((item) => item.severity === "high")) return "strongly_supported";
  return "supported";
}

function applySafetyGuard(resolution: BasicAnswerResolutionLevel, input: BasicAnswerResolverInput): BasicAnswerResolutionLevel {
  if (!input.synthesis.safetyFlags?.length) return resolution;
  if (resolution === "strongly_supported" || resolution === "supported") return "conditional";
  if (resolution === "not_supported") return "unclear";
  return resolution;
}

function resolveConfidence(input: BasicAnswerResolverInput, semantic: MatchResult, conditions: AnswerCondition[], blockers: AnswerBlocker[], uncertainty: AnswerUncertainty[], timingEffect: TimingAnswerEffect | undefined, resolution: BasicAnswerResolutionLevel): "high" | "medium" | "low" {
  if (resolution === "not_applicable") return input.synthesis.confidence === "low" ? "low" : "medium";
  if (semantic.summary.semanticDirection === "insufficient" || uncertainty.some((item) => item.severity === "high") || blockers.some((item) => item.severity === "high" && semantic.summary.semanticDirection !== "support")) return "low";
  if (input.synthesis.confidence === "medium" || input.synthesis.unresolvedPoints?.length || conditions.length || blockers.length || timingEffect?.effect === "qualify" || timingEffect?.effect === "weaken") return "medium";
  return "high";
}

function isContactProposition(proposition: AnswerProposition) {
  return proposition.action === "contact" || proposition.desiredState === "receive_message_or_contact";
}

function synthesisText(input: BasicAnswerResolverInput) {
  return [
    input.synthesis.coreTheme.label,
    input.synthesis.mainProcess,
    input.synthesis.closingState?.type ?? "",
    ...input.synthesis.conclusion.summaryConcepts,
    ...input.synthesis.keyTransitions.flatMap((transition) => [transition.type, transition.fromConcept ?? "", transition.toConcept ?? ""]),
    ...(input.synthesis.conditions ?? []).map((condition) => condition.concept),
    ...(input.synthesis.unresolvedPoints ?? []).map((point) => point.concept)
  ].join(" ");
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
