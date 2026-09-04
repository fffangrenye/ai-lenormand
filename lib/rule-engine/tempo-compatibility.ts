import { getCardLexiconEntry, getSemanticMode } from "./lexicon";
import { HorizonClass } from "./ontology";
import { Tempo as LexiconTempo, Duration as LexiconDuration } from "./semantic-types";
import { lookupTempoCompatibility } from "./tempo-matrix";
import { assertValidTempoCompatibilityInput, assertValidTempoCompatibilityResult } from "./tempo-schema";
import {
  DominantDuration,
  DominantTempo,
  DurationEvidence,
  ProcessTimingAdjustment,
  TempoCompatibilityEvidence,
  TempoCompatibilityInput,
  TempoCompatibilityResult,
  TempoCondition,
  TempoWarning
} from "./tempo-types";

const ENGINE_VERSION = "tempo-compatibility-1.0.0";

const cardTempoBaseline: Record<number, DominantTempo> = {
  1: "fast",
  2: "immediate",
  3: "slow",
  5: "slow",
  6: "variable",
  7: "very_slow",
  8: "stationary",
  10: "sudden",
  12: "immediate",
  13: "soon",
  17: "variable",
  18: "very_slow",
  20: "moderate",
  21: "stationary",
  23: "variable",
  24: "moderate",
  25: "stationary",
  26: "slow",
  27: "soon",
  30: "stationary",
  33: "moderate",
  34: "moderate",
  35: "very_slow"
};

const cardDurationBaseline: Record<number, DominantDuration> = {
  2: "brief",
  12: "short",
  13: "short",
  18: "persistent",
  21: "fixed",
  25: "persistent",
  30: "extended",
  35: "persistent",
  5: "extended",
  8: "fixed"
};

export function evaluateTempoCompatibility(input: TempoCompatibilityInput): TempoCompatibilityResult {
  const validInput = assertValidTempoCompatibilityInput(input);
  const timeframe = validInput.question.timeframe;
  const horizon = timeframe.normalized?.horizonClass ?? "open";
  const cardEvidence = collectCardTempoEvidence(validInput);
  const durationEvidence = [...collectDurationEvidence(validInput), ...collectTransitionDurationEvidence(validInput)];
  const processEvidence = collectProcessTempoEvidence(validInput);
  const transitionEvidence = collectTransitionTempoEvidence(validInput);
  const tempoEvidence = [...processEvidence, ...transitionEvidence, ...cardEvidence];
  const blockingState = resolveBlockingState(validInput, tempoEvidence);
  const processAdjustment = resolveProcessAdjustment(validInput, cardEvidence, processEvidence, transitionEvidence, blockingState);
  const dominantTempo = processAdjustment.toTempo;
  const dominantDuration = resolveDominantDuration(validInput, durationEvidence);
  const compatibility = adjustCompatibilityForBlocking(lookupTempoCompatibility(horizon, dominantTempo), horizon, blockingState);
  const conditions = buildConditions(validInput, horizon, blockingState, dominantDuration, dominantTempo, compatibility);
  const warnings = buildWarnings(validInput, horizon, blockingState, dominantTempo, conditions);
  const confidence = resolveConfidence(horizon, validInput, tempoEvidence, compatibility);

  return assertValidTempoCompatibilityResult({
    compatibilityTarget: "semantic_process",
    timeframe,
    dominantTempo,
    dominantDuration,
    compatibility,
    tempoEvidence,
    durationEvidence,
    processAdjustment: processAdjustment.type === "none" ? undefined : processAdjustment,
    conditions: conditions.length ? conditions : undefined,
    confidence,
    warnings: warnings.length ? warnings : undefined,
    debugTrace: {
      compatibilityTarget: "semantic_process",
      timeframe,
      semanticModeTempo: cardEvidence.filter((item) => item.sourceType === "semantic_mode"),
      cardBaselineTempo: cardEvidence.filter((item) => item.sourceType === "card"),
      processTempo: processEvidence,
      transitionTempo: transitionEvidence,
      durationEvidence,
      dominantTempoDecision: processAdjustment.reasonCode,
      dominantDurationDecision: `DURATION_${dominantDuration.toUpperCase()}`,
      compatibilityMatrixLookup: `${horizon}:${dominantTempo}->${compatibility}`,
      adjustments: processAdjustment.type === "none" ? [] : [processAdjustment],
      conditions,
      confidenceReason: confidence
    },
    engineVersion: ENGINE_VERSION
  });
}

function collectCardTempoEvidence(input: TempoCompatibilityInput): TempoCompatibilityEvidence[] {
  return input.resolvedCards
    .map((meaning): TempoCompatibilityEvidence | null => {
      const mode = getSemanticMode(meaning.cardId, meaning.primaryMode);
      const modeTempo = mode?.tempoOverride ? normalizeLexiconTempo(mode.tempoOverride) : undefined;
      if (modeTempo && modeTempo !== "unknown") {
        return {
          sourceType: "semantic_mode",
          sourceRef: `CARD_${meaning.cardId}.${meaning.primaryMode}`,
          tempo: modeTempo,
          strength: "strong",
          reasonCode: "SEMANTIC_MODE_TEMPO_OVERRIDE",
          cardIds: [meaning.cardId]
        };
      }
      const card = getCardLexiconEntry(meaning.cardId);
      const baseline = cardTempoBaseline[meaning.cardId] ?? normalizeLexiconTempo(card?.tempo);
      if (!baseline || baseline === "unknown") return null;
      return {
        sourceType: "card",
        sourceRef: `CARD_${meaning.cardId}`,
        tempo: baseline,
        strength: "weak",
        reasonCode: "CARD_BASELINE_TEMPO",
        cardIds: [meaning.cardId]
      };
    })
    .filter((item): item is TempoCompatibilityEvidence => Boolean(item));
}

function collectDurationEvidence(input: TempoCompatibilityInput): DurationEvidence[] {
  return input.resolvedCards
    .map((meaning): DurationEvidence | null => {
      const mode = getSemanticMode(meaning.cardId, meaning.primaryMode);
      const modeDuration = mode?.durationOverride ? normalizeLexiconDuration(mode.durationOverride) : undefined;
      if (modeDuration && modeDuration !== "unknown") {
        return {
          sourceType: "semantic_mode",
          sourceRef: `CARD_${meaning.cardId}.${meaning.primaryMode}`,
          duration: modeDuration,
          strength: "strong",
          reasonCode: "SEMANTIC_MODE_DURATION_OVERRIDE",
          cardIds: [meaning.cardId]
        };
      }
      const card = getCardLexiconEntry(meaning.cardId);
      const baseline = cardDurationBaseline[meaning.cardId] ?? normalizeLexiconDuration(card?.duration);
      if (!baseline || baseline === "unknown") return null;
      return {
        sourceType: "card",
        sourceRef: `CARD_${meaning.cardId}`,
        duration: baseline,
        strength: "weak",
        reasonCode: "CARD_BASELINE_DURATION",
        cardIds: [meaning.cardId]
      };
    })
    .filter((item): item is DurationEvidence => Boolean(item));
}

function collectProcessTempoEvidence(input: TempoCompatibilityInput): TempoCompatibilityEvidence[] {
  const process = input.synthesis.mainProcess;
  const tempo = processTempo(process);
  if (!tempo) return [];
  return [
    {
      sourceType: "main_process",
      sourceRef: "SYNTHESIS_MAIN_PROCESS",
      tempo,
      strength: "strong",
      reasonCode: `MAIN_PROCESS_${process.toUpperCase()}`,
      cardIds: input.spread.forwardChain.cardIds
    }
  ];
}

function collectTransitionTempoEvidence(input: TempoCompatibilityInput): TempoCompatibilityEvidence[] {
  return input.synthesis.keyTransitions
    .map((transition): TempoCompatibilityEvidence | null => {
      const tempo = transitionTempo(transition.type);
      if (!tempo) return null;
      return {
        sourceType: "transition",
        sourceRef: `TRANSITION_${transition.cardIds.join(">")}`,
        tempo,
        strength: ["block", "delay", "end", "cut", "resolve"].includes(transition.type) ? "strong" : "medium",
        reasonCode: `TRANSITION_${transition.type.toUpperCase()}`,
        cardIds: transition.cardIds
      };
    })
    .filter((item): item is TempoCompatibilityEvidence => Boolean(item));
}

function collectTransitionDurationEvidence(input: TempoCompatibilityInput): DurationEvidence[] {
  return input.synthesis.keyTransitions
    .map((transition): DurationEvidence | null => {
      if (transition.type === "stabilize") {
        return {
          sourceType: "transition",
          sourceRef: `TRANSITION_${transition.cardIds.join(">")}`,
          duration: "persistent",
          strength: "medium",
          reasonCode: "TRANSITION_STABILIZE_DURATION",
          cardIds: transition.cardIds
        };
      }
      if (transition.type === "repeat") {
        return {
          sourceType: "transition",
          sourceRef: `TRANSITION_${transition.cardIds.join(">")}`,
          duration: "persistent",
          strength: "medium",
          reasonCode: "TRANSITION_REPEAT_DURATION",
          cardIds: transition.cardIds
        };
      }
      return null;
    })
    .filter((item): item is DurationEvidence => Boolean(item));
}

function resolveBlockingState(input: TempoCompatibilityInput, evidence: TempoCompatibilityEvidence[]) {
  if (input.synthesis.mainProcess === "blocked" || input.synthesis.closingState?.type === "blocked") return "blocked";
  if (input.synthesis.mainProcess === "delayed" || input.synthesis.closingState?.type === "delayed") return "delayed";
  if (input.synthesis.mainProcess === "ending" || input.synthesis.closingState?.type === "ended") return "stopped";
  if (input.synthesis.mainProcess === "repeating" || input.synthesis.closingState?.type === "repeating") return "cyclical";
  if (evidence.some((item) => item.tempo === "blocked")) return "blocked";
  if (evidence.some((item) => item.tempo === "delayed")) return "delayed";
  return "none";
}

function resolveProcessAdjustment(
  input: TempoCompatibilityInput,
  cardEvidence: TempoCompatibilityEvidence[],
  processEvidence: TempoCompatibilityEvidence[],
  transitionEvidence: TempoCompatibilityEvidence[],
  blockingState: string
): ProcessTimingAdjustment {
  const fallback = strongestCardTempo(cardEvidence);
  const processTempoSignal = processEvidence[0]?.tempo;
  const transitionTempoSignal = dominantTransitionTempo(input, transitionEvidence);

  if (blockingState === "blocked") return adjustment("process_blocked", fallback, "stationary", "PROCESS_BLOCKING_PRIORITY");
  if (blockingState === "delayed") return adjustment("process_delayed", fallback, "slow", "PROCESS_DELAY_PRIORITY");
  if (blockingState === "stopped") return adjustment("process_stationary", fallback, "stationary", "PROCESS_STOPPED_PRIORITY");
  const communicationTempo = directCommunicationTempo(input, cardEvidence);
  if (communicationTempo) {
    return adjustment("transition_activated", fallback, communicationTempo, "COMMUNICATION_TOPIC_DIRECT_TEMPO");
  }
  if (input.synthesis.mainProcess === "developing" && transitionTempoSignal) {
    return adjustment("transition_activated", fallback, transitionTempoSignal, "DEVELOPING_PROCESS_USES_KEY_TRANSITION");
  }
  if (transitionTempoSignal && input.synthesis.mainProcess === "improving") {
    return adjustment("transition_activated", fallback, transitionTempoSignal, "TRANSITION_ACTIVATED_OVER_CARD_BASELINE");
  }
  if (processTempoSignal && processTempoSignal !== "blocked" && processTempoSignal !== "delayed" && processTempoSignal !== "cyclical") {
    return adjustment(processTempoSignal === "variable" ? "process_variable" : "none", fallback, processTempoSignal, "MAIN_PROCESS_PRIORITY");
  }
  if (transitionTempoSignal) return adjustment("transition_activated", fallback, transitionTempoSignal, "KEY_TRANSITION_PRIORITY");
  return adjustment("none", undefined, fallback, "CARD_BASELINE_FALLBACK");
}

function dominantTransitionTempo(input: TempoCompatibilityInput, evidence: TempoCompatibilityEvidence[]): DominantTempo | undefined {
  if (input.synthesis.keyTransitions.some((transition) => transition.type === "cut")) return "sudden";
  if (input.synthesis.keyTransitions.some((transition) => transition.type === "end") && input.synthesis.keyTransitions.some((transition) => ["change", "clarify", "confirm", "resolve"].includes(transition.type))) return "variable";
  if (evidence.some((item) => item.tempo === "sudden")) return "sudden";
  if (evidence.some((item) => item.tempo === "fast")) return "fast";
  if (input.question.primaryTopic === "communication" && input.spread.forwardChain.pairRelations.includes("communicate")) {
    return input.resolvedCards.some((card) => card.cardId === 1 || card.cardId === 12) ? "fast" : "soon";
  }
  if (evidence.some((item) => item.tempo === "soon")) return "soon";
  if (evidence.some((item) => item.tempo === "variable")) return "variable";
  return undefined;
}

function directCommunicationTempo(input: TempoCompatibilityInput, cardEvidence: TempoCompatibilityEvidence[]): DominantTempo | undefined {
  if (input.question.primaryTopic !== "communication") return undefined;
  if (!input.spread.forwardChain.pairRelations.includes("communicate")) return undefined;
  const signals = cardEvidence.map((item) => item.tempo);
  if (signals.includes("sudden")) return "sudden";
  if (signals.includes("immediate") || signals.includes("fast")) return "fast";
  if (signals.includes("soon")) return "soon";
  return undefined;
}

function resolveDominantDuration(input: TempoCompatibilityInput, evidence: DurationEvidence[]): DominantDuration {
  if (input.synthesis.mainProcess === "repeating") return "persistent";
  if (input.synthesis.mainProcess === "stabilizing" || input.synthesis.mainProcess === "stable") return "persistent";
  if (input.synthesis.closingState?.type === "blocked" || input.synthesis.closingState?.type === "ended") return "fixed";
  if (evidence.some((item) => item.duration === "fixed")) return "fixed";
  if (evidence.some((item) => item.duration === "persistent")) return "persistent";
  if (evidence.some((item) => item.duration === "extended")) return "extended";
  if (evidence.some((item) => item.duration === "brief")) return "brief";
  if (evidence.some((item) => item.duration === "short")) return "short";
  return evidence.length ? "moderate" : "unknown";
}

function buildConditions(
  input: TempoCompatibilityInput,
  horizon: HorizonClass,
  blockingState: string,
  duration: DominantDuration,
  tempo: DominantTempo,
  compatibility: string
): TempoCondition[] {
  const conditions: TempoCondition[] = [];
  if (horizon === "open") conditions.push({ type: "open_timeframe", concept: "timeframe unspecified", evidenceCodes: ["TIMEFRAME_OPEN"] });
  if (input.question.intent === "timing") conditions.push({ type: "timing_intent", concept: "timing question remains broad", evidenceCodes: ["TIMING_INTENT_NO_EXACT_DATE"] });
  if (blockingState === "blocked") conditions.push({ type: "blocked_process", concept: "process structurally blocked", evidenceCodes: ["BLOCKED_NOT_NEVER"] });
  if (blockingState === "delayed") conditions.push({ type: "delayed_process", concept: "process delayed rather than stopped", evidenceCodes: ["DELAYED_NOT_NEVER"] });
  if (duration === "persistent" || duration === "fixed" || duration === "extended") conditions.push({ type: "persistent_state", concept: `${duration} duration signal`, evidenceCodes: ["DURATION_NOT_EVENT_SPEED"] });
  if (tempo === "mixed" || tempo === "variable") conditions.push({ type: "mixed_tempo", concept: `${tempo} tempo evidence`, evidenceCodes: ["VARIABLE_NOT_EXACT_TIME"] });
  if (compatibility === "strained" || compatibility === "mismatched") conditions.push({ type: "timeframe_tight", concept: "question horizon does not strongly fit process pace", evidenceCodes: ["COMPATIBILITY_MATRIX"] });
  return conditions;
}

function buildWarnings(input: TempoCompatibilityInput, horizon: HorizonClass, blockingState: string, tempo: DominantTempo, conditions: TempoCondition[]): TempoWarning[] {
  const warnings: TempoWarning[] = [];
  if (horizon === "open") warnings.push({ type: "open_timeframe", detail: "No precise window is inferred." });
  if (conditions.some((condition) => condition.type === "mixed_tempo")) warnings.push({ type: "mixed_tempo_evidence" });
  if (blockingState === "blocked" || blockingState === "delayed") warnings.push({ type: "blocked_not_never" });
  if (["slow", "very_slow", "stationary"].includes(tempo)) warnings.push({ type: "slow_not_no" });
  if (tempo === "sudden") warnings.push({ type: "sudden_not_soon" });
  if (input.question.intent === "timing") warnings.push({ type: "timing_intent_not_exact_date" });
  return warnings;
}

function resolveConfidence(horizon: HorizonClass, input: TempoCompatibilityInput, evidence: TempoCompatibilityEvidence[], compatibility: string): "high" | "medium" | "low" {
  if (horizon === "open" && (compatibility === "unknown" || input.synthesis.mainProcess === "mixed")) return "low";
  if (input.synthesis.unresolvedPoints?.length || input.synthesis.mainProcess === "mixed" || evidence.some((item) => item.tempo === "mixed")) return "medium";
  return "high";
}

function adjustCompatibilityForBlocking(compatibility: string, horizon: HorizonClass, blockingState: string) {
  if (horizon === "open") return "unknown";
  if (blockingState === "blocked" && horizon === "immediate") return "mismatched";
  if (blockingState === "blocked" && (horizon === "short" || horizon === "near_term")) return "strained";
  return compatibility as TempoCompatibilityResult["compatibility"];
}

function processTempo(process: string): TempoCompatibilityEvidence["tempo"] | undefined {
  if (process === "approaching") return "fast";
  if (process === "changing" || process === "ending" || process === "eroding" || process === "uncertain") return "variable";
  if (process === "improving" || process === "clarifying" || process === "confirming" || process === "developing") return "moderate";
  if (process === "binding" || process === "stabilizing" || process === "stable") return "slow";
  if (process === "repeating") return "cyclical";
  if (process === "blocked") return "blocked";
  if (process === "delayed") return "delayed";
  if (process === "mixed") return "mixed";
  return undefined;
}

function transitionTempo(type: string): TempoCompatibilityEvidence["tempo"] | undefined {
  if (type === "cut") return "sudden";
  if (type === "approach") return "fast";
  if (type === "communicate") return "soon";
  if (["change", "end", "clarify", "confirm", "unlock", "resolve", "reveal"].includes(type)) return "variable";
  if (type === "block") return "blocked";
  if (type === "delay") return "delayed";
  if (type === "repeat") return "cyclical";
  if (type === "stabilize" || type === "bind") return "slow";
  return undefined;
}

function strongestCardTempo(evidence: TempoCompatibilityEvidence[]): DominantTempo {
  const signals = evidence.map((item) => item.tempo).filter((tempo): tempo is DominantTempo => !["blocked", "delayed", "cyclical"].includes(tempo));
  if (!signals.length) return "unknown";
  if (signals.includes("stationary")) return "stationary";
  if (signals.includes("very_slow")) return "very_slow";
  if (signals.includes("slow")) return "slow";
  if (signals.includes("sudden")) return "sudden";
  if (signals.includes("immediate")) return "immediate";
  if (signals.includes("fast")) return "fast";
  if (signals.includes("soon")) return "soon";
  if (signals.includes("variable")) return "variable";
  return "moderate";
}

function normalizeLexiconTempo(value?: LexiconTempo): DominantTempo | undefined {
  if (!value) return undefined;
  if (value === "very_fast") return "immediate";
  return value;
}

function normalizeLexiconDuration(value?: LexiconDuration): DominantDuration | undefined {
  if (!value) return undefined;
  if (value === "brief") return "brief";
  if (value === "short") return "short";
  if (value === "medium") return "moderate";
  if (value === "long") return "extended";
  if (value === "persistent") return "persistent";
  return "unknown";
}

function adjustment(type: ProcessTimingAdjustment["type"], fromTempo: DominantTempo | undefined, toTempo: DominantTempo, reasonCode: string): ProcessTimingAdjustment {
  return { type, fromTempo, toTempo, reasonCode };
}
