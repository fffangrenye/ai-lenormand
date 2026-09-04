import { QuestionContext } from "./ontology";
import { assertValidPreselectedCardMeaning } from "./preselection-schema";
import {
  MeaningEvidence,
  PreselectedCardMeaning,
  PreselectionDebugTrace,
  PreselectionResult,
  RelevanceTier,
  SemanticCandidate
} from "./preselection-types";
import { CardLexiconEntry, ContextPredicate, InterpretationPlane, SemanticMode } from "./semantic-types";

type MutableCandidate = SemanticCandidate & {
  mode: SemanticMode;
  modeOrder: number;
  defaultPriorityScore: number;
  preferredPlaneMatch?: boolean;
  topicMatch?: boolean;
  objectMatch?: boolean;
};

const DEFAULT_PRIORITY_SCORE = {
  primary: 2,
  secondary: 1,
  rare: 0
} as const;

const RELEVANCE_SCORE = {
  suppressed: 0,
  weak: 1,
  possible: 2,
  strong: 3,
  dominant: 4
} as const;

const POSSIBLE_MAX_SCORE = 2;

export function preselectCardMeaning(input: { question: QuestionContext; card: CardLexiconEntry }): PreselectionResult {
  const { question, card } = input;
  const debugTrace: PreselectionDebugTrace = { cardId: card.id, steps: [] };

  let candidates = generateCandidates(card, debugTrace);
  candidates = applySafetyAndLogicalBlocks(candidates, question, card, debugTrace);
  candidates = applyActivationGates(candidates, question, debugTrace);

  const preferredPlane = selectPreferredPlane(question);
  candidates = applyPreferredPlane(candidates, preferredPlane, debugTrace);
  candidates = applyDefaultPriorityEvidence(candidates);
  candidates = applyDomainAndTopicAffinity(candidates, question, debugTrace);
  candidates = applyObjectAffinity(candidates, question, debugTrace);
  candidates = applyIntentAffinity(candidates, question, debugTrace);
  candidates = applyPeopleAffinity(candidates, question, debugTrace);
  candidates = applyPerspectiveAndActionFrameAffinity(candidates, question, debugTrace);
  candidates = applyTimeframeAdjustment(candidates, question, debugTrace);
  candidates = applyCardContextOverrides(candidates, card, question, debugTrace);
  candidates = applySuppressionAndConflict(candidates, card);
  candidates = preserveCoreModes(candidates, card, debugTrace);
  candidates = normalizeCandidates(candidates);
  candidates = rankCandidates(candidates);

  const selected = selectTopCandidates(candidates, card);
  const meaning: PreselectedCardMeaning = {
    cardId: card.id,
    preferredPlane,
    candidates: selected.map(stripMode),
    unresolved: determineUnresolved(selected, card),
    ambiguity: card.ambiguityLevel,
    evidence: collectGlobalEvidence(selected),
    warnings: selected.some((candidate) => candidate.requiresNeighborResolution)
      ? [{ code: "NEIGHBOR_RESOLUTION_REQUIRED", detail: "A neighbor-supported mode is pending Pair Engine evidence." }]
      : undefined
  };

  return {
    meaning: assertValidPreselectedCardMeaning(meaning),
    debugTrace
  };
}

function generateCandidates(card: CardLexiconEntry, trace: PreselectionDebugTrace): MutableCandidate[] {
  return card.semanticModes.map((mode, modeOrder) => {
    const score = DEFAULT_PRIORITY_SCORE[mode.defaultPriority];
    const candidate: MutableCandidate = {
      mode,
      modeOrder,
      defaultPriorityScore: score,
      modeId: mode.id,
      relevance: scoreToTier(score),
      internalScore: score,
      roles: mode.roles,
      planes: mode.planes,
      evidence: [{ source: "default", code: `DEFAULT_${mode.defaultPriority.toUpperCase()}` }]
    };
    traceStep(trace, "generate_candidates", candidate, score, score, `DEFAULT_${mode.defaultPriority.toUpperCase()}`);
    return candidate;
  });
}

function applySafetyAndLogicalBlocks(
  candidates: MutableCandidate[],
  question: QuestionContext,
  card: CardLexiconEntry,
  trace: PreselectionDebugTrace
) {
  return candidates.map((candidate) => {
    if (candidate.mode.safetyTag === "sexuality" && !matchesModeActivation(candidate.mode, question)) {
      return adjust(candidate, -8, { source: "safety", code: "MODE_BLOCKED_SAFETY", detail: "Sexuality mode requires explicit intimacy context." }, "safety_logical_blocks", trace, true);
    }
    if ((candidate.mode.safetyTag === "pregnancy" || candidate.mode.safetyTag === "health") && !matchesModeActivation(candidate.mode, question)) {
      return adjust(candidate, -8, { source: "safety", code: "MODE_BLOCKED_SAFETY", detail: `${candidate.mode.safetyTag} mode requires explicit context.` }, "safety_logical_blocks", trace, true);
    }
    if ((card.id === 28 || card.id === 29) && card.semanticAgency === "passive_anchor") {
      candidate.evidence.push({ source: "people", code: "PASSIVE_PERSON_ANCHOR" });
    }
    return candidate;
  });
}

function applyActivationGates(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    if (!matchesModeActivation(candidate.mode, question)) {
      return adjust(candidate, -8, { source: "safety", code: "ACTIVATION_NOT_MET" }, "activation_gates", trace, true);
    }
    if (candidate.mode.activation?.neighborSupportRequired) {
      candidate.requiresNeighborResolution = true;
      candidate.evidence.push({ source: "neighbor", code: "ACTIVATION_NEIGHBOR_REQUIRED" });
      const before = candidate.internalScore;
      candidate.internalScore = Math.max(candidate.internalScore, POSSIBLE_MAX_SCORE);
      traceStep(trace, "activation_gates", candidate, before, candidate.internalScore, "ACTIVATION_NEIGHBOR_REQUIRED");
    }
    return candidate;
  });
}

function selectPreferredPlane(question: QuestionContext): InterpretationPlane {
  if (question.intent === "location" || question.domain === "lost_item" || question.primaryTopic === "location") return "location";
  if (question.intent === "description" && question.object.type === "person") return "person";
  if (question.intent === "action" || question.intent === "advice" || question.intent === "decision") return "action";
  if (question.primaryTopic === "communication" || question.object.type === "message" || question.object.type === "document") return "information";
  return "abstract";
}

function applyPreferredPlane(candidates: MutableCandidate[], preferredPlane: InterpretationPlane, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    if (candidate.planes.includes(preferredPlane)) {
      candidate.preferredPlaneMatch = true;
      return adjust(candidate, 1, { source: "default", code: "PREFERRED_PLANE_MATCH", detail: preferredPlane }, "preferred_plane", trace);
    }
    if (preferredPlane === "location" || preferredPlane === "person") {
      return adjust(candidate, -1, { source: "default", code: "PREFERRED_PLANE_MISMATCH", detail: preferredPlane }, "preferred_plane", trace);
    }
    return candidate;
  });
}

function applyDefaultPriorityEvidence(candidates: MutableCandidate[]) {
  return candidates;
}

function applyDomainAndTopicAffinity(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    let next = candidate;
    if (candidate.mode.affinities?.domains?.includes(question.domain)) {
      next = adjust(next, 1, { source: "domain", code: "DOMAIN_MATCH", detail: question.domain }, "domain_topic_affinity", trace);
    }
    if (candidate.mode.affinities?.topics?.includes(question.primaryTopic)) {
      next.topicMatch = true;
      next = adjust(next, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: question.primaryTopic }, "domain_topic_affinity", trace);
    }
    if (question.secondaryTopics?.some((topic) => candidate.mode.affinities?.topics?.includes(topic))) {
      next = adjust(next, 1, { source: "topic", code: "TOPIC_MATCH_SECONDARY" }, "domain_topic_affinity", trace);
    }
    return applyHeuristicTopicAffinity(next, question, trace);
  });
}

function applyObjectAffinity(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    if (candidate.mode.affinities?.objectTypes?.includes(question.object.type)) {
      candidate.objectMatch = true;
      return adjust(candidate, 2, { source: "object", code: "OBJECT_TYPE_MATCH", detail: question.object.type }, "object_affinity", trace);
    }
    if (modeMatchesObject(candidate.mode, question)) {
      candidate.objectMatch = true;
      return adjust(candidate, 2, { source: "object", code: "OBJECT_TYPE_MATCH", detail: question.object.type }, "object_affinity", trace);
    }
    return candidate;
  });
}

function applyIntentAffinity(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    let next = candidate;
    if (candidate.mode.affinities?.intents?.includes(question.intent) || modeMatchesIntent(candidate.mode, question.intent)) {
      next = adjust(next, 2, { source: "intent", code: "INTENT_MATCH", detail: question.intent }, "intent_affinity", trace);
    }
    if (question.secondaryIntent && candidate.mode.affinities?.intents?.includes(question.secondaryIntent)) {
      next = adjust(next, 1, { source: "intent", code: "SECONDARY_INTENT_MATCH", detail: question.secondaryIntent }, "intent_affinity", trace);
    }
    return next;
  });
}

function applyPeopleAffinity(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    let next = candidate;
    const relations = question.people.flatMap((person) => person.relations);
    if (relations.some((relation) => candidate.mode.affinities?.personRelations?.includes(relation)) || modeMatchesPeople(candidate.mode, question)) {
      next = adjust(next, 2, { source: "people", code: "PEOPLE_RELATION_MATCH" }, "people_role_affinity", trace);
    }
    if (question.people.some((person) => person.knownStatus === "known") && modeMatchesKnownStatus(candidate.mode)) {
      next = adjust(next, 1, { source: "people", code: "KNOWN_STATUS_MATCH" }, "people_role_affinity", trace);
    }
    return next;
  });
}

function applyPerspectiveAndActionFrameAffinity(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  return candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    let next = candidate;
    if (question.perspective && (candidate.roles.includes("person_anchor") || candidate.roles.includes("state") || candidate.roles.includes("information"))) {
      next = adjust(next, 1, { source: "perspective", code: "PERSPECTIVE_MATCH" }, "perspective_action_affinity", trace);
    }
    if (question.actionFrame && modeMatchesActionFrame(candidate.mode, question)) {
      next = adjust(next, 2, { source: "action_frame", code: "ACTION_FRAME_MATCH", detail: question.actionFrame.action }, "perspective_action_affinity", trace);
    }
    return next;
  });
}

function applyTimeframeAdjustment(candidates: MutableCandidate[], question: QuestionContext, trace: PreselectionDebugTrace) {
  const horizon = question.timeframe.normalized?.horizonClass;
  return candidates.map((candidate) => {
    if (candidate.blocked || !horizon) return candidate;
    if ((horizon === "immediate" || horizon === "short") && candidate.mode.timeframeBehavior?.shortHorizonBoost?.includes(candidate.modeId)) {
      return adjust(candidate, 1, { source: "timeframe", code: "TIMEFRAME_SHORT_BOOST", detail: horizon }, "timeframe_adjustment", trace);
    }
    if ((horizon === "medium_term" || horizon === "extended") && candidate.mode.timeframeBehavior?.longHorizonBoost?.includes(candidate.modeId)) {
      return adjust(candidate, 1, { source: "timeframe", code: "TIMEFRAME_LONG_BOOST", detail: horizon }, "timeframe_adjustment", trace);
    }
    return candidate;
  });
}

function applyCardContextOverrides(candidates: MutableCandidate[], card: CardLexiconEntry, question: QuestionContext, trace: PreselectionDebugTrace) {
  let next = candidates.map((candidate) => {
    if (candidate.blocked) return candidate;
    const matchingOverrides = (card.contextOverrides ?? []).filter((override) => override.modeId === candidate.modeId && override.when.every((predicate) => matchesPredicate(predicate, question)));
    return matchingOverrides.reduce((current, override) => {
      const amount = override.adjustment === "strong_boost" ? 3 : override.adjustment === "boost" ? 1 : override.adjustment === "suppress" ? -2 : -8;
      return adjust(
        current,
        amount,
        { source: "override", code: `CONTEXT_OVERRIDE_${card.name.toUpperCase()}_${override.modeId.toUpperCase()}`, detail: override.adjustment },
        "context_overrides",
        trace,
        override.adjustment === "block"
      );
    }, candidate);
  });

  next = applyNamedContextSwitches(next, card, question, trace);
  return next;
}

function applyNamedContextSwitches(candidates: MutableCandidate[], card: CardLexiconEntry, question: QuestionContext, trace: PreselectionDebugTrace) {
  if (card.name === "Fish" && isStudyProjectContext(question)) {
    return candidates.map((candidate) => {
      if (["abundance_quantity", "depth", "cashflow_circulation"].includes(candidate.modeId)) {
        return adjust(candidate, candidate.modeId === "cashflow_circulation" ? 1 : 3, { source: "override", code: "CONTEXT_OVERRIDE_FISH_STUDY_PROJECT_FLOW" }, "context_overrides", trace);
      }
      if (candidate.modeId === "money_finance" || candidate.modeId === "business_transaction") {
        return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_FISH_FINANCE_STUDY_PROJECT" }, "context_overrides", trace);
      }
      return candidate;
    });
  }

  if (card.name === "Child" && isStudyProjectContext(question)) {
    return candidates.map((candidate) => {
      if (candidate.modeId === "simplicity_reduction") {
        return adjust(candidate, 4, { source: "override", code: "CONTEXT_OVERRIDE_CHILD_STUDY_PROJECT_SIMPLIFY" }, "context_overrides", trace);
      }
      return candidate;
    });
  }

  if (card.name === "Garden" && isStudyProjectContext(question)) {
    return candidates.map((candidate) => {
      if (candidate.modeId === "public_open") {
        const adjusted = adjust(candidate, 1, { source: "override", code: "CONTEXT_OVERRIDE_GARDEN_STUDY_PUBLIC_ABSTRACT" }, "context_overrides", trace);
        return { ...adjusted, roles: ["information"] as MutableCandidate["roles"], planes: ["abstract", "information"] as MutableCandidate["planes"] };
      }
      if (candidate.modeId === "social_group" || candidate.modeId === "network_audience" || candidate.modeId === "publicity_visibility") {
        const adjusted = adjust(candidate, 2, { source: "override", code: "CONTEXT_OVERRIDE_GARDEN_STUDY_AUDIENCE" }, "context_overrides", trace);
        return {
          ...adjusted,
          roles: (candidate.modeId === "social_group" ? ["quantity"] : ["information"]) as MutableCandidate["roles"],
          planes: ["abstract", "information"] as MutableCandidate["planes"]
        };
      }
      if (candidate.modeId === "outdoor_public_place") {
        return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_GARDEN_LOCATION_STUDY_PROJECT" }, "context_overrides", trace);
      }
      return candidate;
    });
  }

  if (card.name === "Fox" && question.domain === "relationship" && question.primaryTopic === "trust_exclusivity") {
    return candidates.map((candidate) => {
      if (candidate.modeId === "employment") return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_FOX_EMPLOYMENT" }, "context_overrides", trace);
      if (candidate.modeId === "deception_suspicion" || candidate.modeId === "wrong_warning") {
        return adjust(candidate, 2, { source: "override", code: "CONTEXT_OVERRIDE_FOX_TRUST_WARNING" }, "context_overrides", trace);
      }
      return candidate;
    });
  }

  if (card.name === "Fox" && question.domain === "career") {
    return candidates.map((candidate) => {
      if (candidate.modeId === "deception_suspicion") return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_FOX_DECEPTION_CAREER" }, "context_overrides", trace);
      return candidate;
    });
  }

  if (card.name === "Moon") {
    return candidates.map((candidate) => {
      if (question.domain === "career" && candidate.modeId === "emotion_attraction") {
        return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_MOON_EMOTION_CAREER" }, "context_overrides", trace);
      }
      if (question.domain === "relationship" && question.primaryTopic === "feelings_attraction" && candidate.modeId === "career_vocation") {
        return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_MOON_CAREER_FEELINGS" }, "context_overrides", trace);
      }
      if (question.intent === "timing" && (candidate.modeId === "career_vocation" || candidate.modeId === "emotion_attraction")) {
        return adjust(candidate, -2, { source: "override", code: "CONTEXT_SUPPRESS_MOON_NON_TIMING" }, "context_overrides", trace);
      }
      return candidate;
    });
  }

  return candidates;
}

function isStudyProjectContext(question: QuestionContext) {
  return question.domain === "study" && (question.primaryTopic === "academic_project" || question.primaryTopic === "research" || question.object.type === "project");
}

function applySuppressionAndConflict(candidates: MutableCandidate[], card: CardLexiconEntry) {
  if (card.name === "Fox") {
    return candidates.map((candidate) =>
      candidate.modeId === "employment" ? { ...candidate, conflicts: ["wrong_warning", "deception_suspicion"] } : candidate
    );
  }
  if (card.name === "Ring") {
    return candidates.map((candidate) =>
      candidate.modeId === "cycle_repetition" ? { ...candidate, conflicts: ["commitment_bond", "agreement_contract"] } : candidate
    );
  }
  return candidates;
}

function preserveCoreModes(candidates: MutableCandidate[], card: CardLexiconEntry, trace: PreselectionDebugTrace) {
  const survivingCore = candidates.filter((candidate) => card.coreModes.includes(candidate.modeId) && !candidate.blocked);
  if (survivingCore.length) return candidates;

  const restorable = candidates.find((candidate) => card.coreModes.includes(candidate.modeId));
  if (!restorable) return candidates;
  restorable.blocked = false;
  const before = restorable.internalScore;
  restorable.internalScore = Math.max(restorable.internalScore, 1);
  restorable.evidence.push({ source: "default", code: "CORE_MODE_PRESERVED" });
  traceStep(trace, "core_preservation", restorable, before, restorable.internalScore, "CORE_MODE_PRESERVED");
  return candidates;
}

function normalizeCandidates(candidates: MutableCandidate[]) {
  return candidates.map((candidate) => {
    let score = clamp(candidate.internalScore, 0, 8);
    if (candidate.requiresNeighborResolution) score = Math.min(score, POSSIBLE_MAX_SCORE);
    return {
      ...candidate,
      internalScore: score,
      relevance: scoreToTier(score)
    };
  });
}

function rankCandidates(candidates: MutableCandidate[]) {
  return [...candidates].sort((a, b) => {
    if (b.internalScore !== a.internalScore) return b.internalScore - a.internalScore;
    if (b.defaultPriorityScore !== a.defaultPriorityScore) return b.defaultPriorityScore - a.defaultPriorityScore;
    if (Number(b.preferredPlaneMatch ?? false) !== Number(a.preferredPlaneMatch ?? false)) {
      return Number(b.preferredPlaneMatch ?? false) - Number(a.preferredPlaneMatch ?? false);
    }
    if (Number(b.objectMatch ?? false) !== Number(a.objectMatch ?? false)) return Number(b.objectMatch ?? false) - Number(a.objectMatch ?? false);
    if (Number(b.topicMatch ?? false) !== Number(a.topicMatch ?? false)) return Number(b.topicMatch ?? false) - Number(a.topicMatch ?? false);
    return a.modeOrder - b.modeOrder;
  });
}

function selectTopCandidates(candidates: MutableCandidate[], card: CardLexiconEntry) {
  const max = card.ambiguityLevel === "high" ? 3 : 2;
  const active = candidates.filter((candidate) => !candidate.blocked);
  const selected: MutableCandidate[] = [];
  const add = (candidate: MutableCandidate | undefined) => {
    if (candidate && !selected.some((item) => item.modeId === candidate.modeId)) selected.push(candidate);
  };

  add(active.find((candidate) => card.coreModes.includes(candidate.modeId)));
  add(active.find((candidate) => candidate.requiresNeighborResolution));
  add(active[0]);

  for (const candidate of active) {
    if (selected.length >= max) break;
    add(candidate);
  }

  return rankCandidates(selected).slice(0, max);
}

function determineUnresolved(candidates: MutableCandidate[], card: CardLexiconEntry) {
  if (candidates.some((candidate) => candidate.requiresNeighborResolution)) return true;
  const [top, second, third] = candidates;
  if (!top) return true;
  if (!second) return top.relevance !== "dominant";
  if (top.relevance === second.relevance && haveDifferentSemanticDirection(top, second)) return true;
  if (card.ambiguityLevel === "high" && [top, second, third].filter((candidate) => candidate && RELEVANCE_SCORE[candidate.relevance] >= RELEVANCE_SCORE.strong).length >= 2) {
    return true;
  }
  return top.relevance !== "dominant" && card.ambiguityLevel === "high";
}

function collectGlobalEvidence(candidates: MutableCandidate[]): MeaningEvidence[] {
  const seen = new Set<string>();
  const evidence: MeaningEvidence[] = [];
  for (const candidate of candidates) {
    for (const item of candidate.evidence) {
      const key = `${item.source}:${item.code}:${item.detail ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push(item);
    }
  }
  return evidence;
}

function stripMode(candidate: MutableCandidate): SemanticCandidate {
  const { mode, modeOrder, defaultPriorityScore, preferredPlaneMatch, topicMatch, objectMatch, ...publicCandidate } = candidate;
  return publicCandidate;
}

function matchesModeActivation(mode: SemanticMode, question: QuestionContext) {
  if (!mode.activation) return true;
  const anyOk = !mode.activation.anyOf || mode.activation.anyOf.some((predicate) => matchesPredicate(predicate, question));
  const allOk = !mode.activation.allOf || mode.activation.allOf.every((predicate) => matchesPredicate(predicate, question));
  return anyOk && allOk;
}

function matchesPredicate(predicate: ContextPredicate, question: QuestionContext) {
  const values = predicate.in ?? (predicate.equals !== undefined ? [predicate.equals] : []);
  if (!values.length) return false;
  switch (predicate.field) {
    case "domain":
      return values.includes(question.domain);
    case "topic":
      return values.includes(question.primaryTopic) || Boolean(question.secondaryTopics?.some((topic) => values.includes(topic)));
    case "intent":
      return values.includes(question.intent) || Boolean(question.secondaryIntent && values.includes(question.secondaryIntent));
    case "objectType":
      return values.includes(question.object.type);
    case "personRelation":
      return question.people.some((person) => person.relations.some((relation) => values.includes(relation)));
    case "knownStatus":
      return question.people.some((person) => values.includes(person.knownStatus));
    case "answerMode":
      return values.includes(question.answerMode);
    case "timeframeUnit":
      return Boolean(question.timeframe.unit && values.includes(question.timeframe.unit));
    case "horizonClass":
      return Boolean(question.timeframe.normalized?.horizonClass && values.includes(question.timeframe.normalized.horizonClass));
    default:
      return false;
  }
}

function modeMatchesObject(mode: SemanticMode, question: QuestionContext) {
  const id = mode.id;
  const objectType = question.object.type;
  if (objectType === "message") return ["incoming_news", "written_message", "oral_communication", "call_live_contact"].includes(id);
  if (objectType === "document") return id.includes("document") || id.includes("paperwork") || id.includes("record") || id.includes("research");
  if (objectType === "person") return mode.planes.includes("person") || mode.roles.includes("person_anchor");
  if (objectType === "money" || objectType === "payment") return id.includes("money") || id.includes("cashflow") || id.includes("financial") || id.includes("assets") || id.includes("transaction");
  if (objectType === "job" || objectType === "offer" || objectType === "contract") return id.includes("employment") || id.includes("contract") || id.includes("career") || id.includes("job");
  if (objectType === "project") return id.includes("project") || id.includes("research") || id.includes("early_stage") || id.includes("new_beginning");
  if (objectType === "item") return mode.planes.includes("location") || mode.planes.includes("literal");
  if (objectType === "alternatives") return id.includes("choice") || id.includes("alternative") || id.includes("split");
  if (id === "cycle_repetition" && /重复|循环|一直|反复/.test(question.object.label)) return true;
  return false;
}

function modeMatchesIntent(mode: SemanticMode, intent: QuestionContext["intent"]) {
  const id = mode.id;
  if (intent === "timing") return id.includes("cycle") || id.includes("night_month") || mode.roles.includes("duration");
  if (intent === "reason") return id.includes("cause") || id.includes("reason") || id.includes("unknown") || id.includes("research");
  if (intent === "action" || intent === "advice" || intent === "decision") return mode.planes.includes("action") || mode.roles.includes("action");
  if (intent === "feelings_attitude") return id.includes("emotion") || id.includes("attraction") || id.includes("attitude") || id.includes("feeling") || mode.roles.includes("state");
  if (intent === "location") return mode.planes.includes("location");
  if (intent === "comparison") return id.includes("choice") || id.includes("alternative");
  return false;
}

function modeMatchesPeople(mode: SemanticMode, question: QuestionContext) {
  const id = mode.id;
  const hasBoss = question.people.some((person) => person.relations.includes("boss") || person.id === "boss");
  if (hasBoss && (id === "authority_leader" || id === "power_strength" || id === "official_person" || id === "authority_hierarchy")) return true;
  const hasParent = question.people.some((person) => person.relations.includes("parent"));
  if (hasParent && (id === "mother_maternal" || id === "father_older_man")) return true;
  return false;
}

function modeMatchesKnownStatus(mode: SemanticMode) {
  return ["friend_known_person", "familiarity", "loyalty_trust", "support_help"].includes(mode.id);
}

function modeMatchesActionFrame(mode: SemanticMode, question: QuestionContext) {
  if (question.actionFrame?.action !== "contact") return false;
  return ["incoming_news", "arrival_approach", "oral_communication", "discussion_negotiation", "call_live_contact", "written_message"].includes(mode.id);
}

function applyHeuristicTopicAffinity(candidate: MutableCandidate, question: QuestionContext, trace: PreselectionDebugTrace) {
  const id = candidate.modeId;
  const topic = question.primaryTopic;
  const domain = question.domain;

  if (domain === "study" && ["knowledge_learning", "project_case", "research_investigation", "editing_revision_research", "practice_discipline"].includes(id)) {
    return adjust(candidate, topic === "research" || topic === "academic_project" ? 2 : 1, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "intimacy" && id === "sexuality") {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "commitment" && id === "commitment_bond") {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "financial_agreement" && id === "agreement_contract") {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "assets" && ["financial_assets", "money_finance", "abundance_quantity"].includes(id)) {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "new_relationship" && ["friend_known_person", "familiarity", "partner_companion"].includes(id)) {
    return adjust(candidate, 1, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "conflict_obstacle" && ["conflict_argument", "complication", "blockage_obstacle", "fixed_stagnation"].includes(id)) {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "communication" && ["oral_communication", "written_message", "incoming_news", "call_live_contact"].includes(id)) {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (topic === "trust_exclusivity" && ["unknown_information", "secret_hidden", "deception_suspicion", "wrong_warning"].includes(id)) {
    return adjust(candidate, 2, { source: "topic", code: "TOPIC_MATCH_PRIMARY", detail: topic }, "domain_topic_affinity", trace);
  }
  if (domain === "career" && ["career_vocation", "recognition_reputation", "employment", "authority_leader"].includes(id)) {
    return adjust(candidate, 1, { source: "domain", code: "DOMAIN_MATCH", detail: domain }, "domain_topic_affinity", trace);
  }
  if (domain === "money" && ["financial_assets", "money_finance", "cashflow_circulation", "business_transaction"].includes(id)) {
    return adjust(candidate, 1, { source: "domain", code: "DOMAIN_MATCH", detail: domain }, "domain_topic_affinity", trace);
  }
  return candidate;
}

function adjust(
  candidate: MutableCandidate,
  amount: number,
  evidence: MeaningEvidence,
  stage: string,
  trace: PreselectionDebugTrace,
  blocked = false
): MutableCandidate {
  const before = candidate.internalScore;
  const after = blocked ? 0 : candidate.internalScore + amount;
  candidate.internalScore = after;
  if (blocked) candidate.blocked = true;
  candidate.evidence.push(evidence);
  traceStep(trace, stage, candidate, before, after, evidence.code);
  return candidate;
}

function traceStep(trace: PreselectionDebugTrace, stage: string, candidate: MutableCandidate, beforeScore: number, afterScore: number, evidenceCode?: string) {
  trace.steps.push({ stage, modeId: candidate.modeId, beforeScore, afterScore, evidenceCode });
}

function scoreToTier(score: number): RelevanceTier {
  if (score >= 6) return "dominant";
  if (score >= 4) return "strong";
  if (score >= 2) return "possible";
  if (score >= 1) return "weak";
  return "suppressed";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function haveDifferentSemanticDirection(a: MutableCandidate, b: MutableCandidate) {
  if (a.conflicts?.includes(b.modeId) || b.conflicts?.includes(a.modeId)) return true;
  return a.roles.some((role) => !b.roles.includes(role)) || a.planes.some((plane) => !b.planes.includes(plane));
}
