import { QuestionContext, Timeframe } from "./ontology";
import { ResolvedCardMeaning } from "./pair-types";
import { SpreadStructure } from "./spread-types";
import { SynthesisResult } from "./synthesis-types";

export const tempoCompatibilityValues = ["well_matched", "possible", "strained", "mismatched", "unknown"] as const;
export type TempoCompatibility = (typeof tempoCompatibilityValues)[number];

export const dominantTempos = [
  "sudden",
  "immediate",
  "fast",
  "soon",
  "moderate",
  "variable",
  "slow",
  "very_slow",
  "stationary",
  "mixed",
  "unknown"
] as const;
export type DominantTempo = (typeof dominantTempos)[number];

export const dominantDurations = ["brief", "short", "moderate", "extended", "persistent", "fixed", "mixed", "unknown"] as const;
export type DominantDuration = (typeof dominantDurations)[number];

export const blockingStates = ["none", "delayed", "blocked", "stopped", "cyclical", "unclear"] as const;
export type BlockingState = (typeof blockingStates)[number];

export const tempoEvidenceSources = ["card", "semantic_mode", "main_process", "transition", "closing_state", "timeframe"] as const;
export type TempoEvidenceSource = (typeof tempoEvidenceSources)[number];

export const tempoEvidenceStrengths = ["strong", "medium", "weak"] as const;
export type TempoEvidenceStrength = (typeof tempoEvidenceStrengths)[number];

export type TempoCompatibilityEvidence = {
  sourceType: TempoEvidenceSource;
  sourceRef: string;
  tempo: DominantTempo | "blocked" | "delayed" | "cyclical";
  strength: TempoEvidenceStrength;
  reasonCode: string;
  cardIds?: number[];
  detail?: string;
};

export type DurationEvidence = {
  sourceType: TempoEvidenceSource;
  sourceRef: string;
  duration: DominantDuration;
  strength: TempoEvidenceStrength;
  reasonCode: string;
  cardIds?: number[];
  detail?: string;
};

export type ProcessTimingAdjustment = {
  type: "transition_activated" | "process_blocked" | "process_delayed" | "process_stationary" | "process_variable" | "none";
  fromTempo?: DominantTempo;
  toTempo: DominantTempo;
  reasonCode: string;
};

export type TempoCondition = {
  type: "timeframe_tight" | "blocked_process" | "delayed_process" | "persistent_state" | "mixed_tempo" | "open_timeframe" | "timing_intent";
  concept: string;
  evidenceCodes: string[];
};

export type TempoWarning = {
  type: "open_timeframe" | "mixed_tempo_evidence" | "blocked_not_never" | "slow_not_no" | "sudden_not_soon" | "timing_intent_not_exact_date";
  detail?: string;
};

export type TempoDebugTrace = {
  compatibilityTarget: "semantic_process";
  timeframe: Timeframe;
  semanticModeTempo: TempoCompatibilityEvidence[];
  cardBaselineTempo: TempoCompatibilityEvidence[];
  processTempo: TempoCompatibilityEvidence[];
  transitionTempo: TempoCompatibilityEvidence[];
  durationEvidence: DurationEvidence[];
  dominantTempoDecision: string;
  dominantDurationDecision: string;
  compatibilityMatrixLookup: string;
  adjustments: ProcessTimingAdjustment[];
  conditions: TempoCondition[];
  confidenceReason: string;
};

export type TempoCompatibilityInput = {
  question: QuestionContext;
  resolvedCards: ResolvedCardMeaning[];
  spread: SpreadStructure;
  synthesis: SynthesisResult;
};

export type TempoCompatibilityResult = {
  compatibilityTarget: "semantic_process";
  timeframe: Timeframe;
  dominantTempo: DominantTempo;
  dominantDuration: DominantDuration;
  compatibility: TempoCompatibility;
  tempoEvidence: TempoCompatibilityEvidence[];
  durationEvidence: DurationEvidence[];
  processAdjustment?: ProcessTimingAdjustment;
  conditions?: TempoCondition[];
  confidence: "high" | "medium" | "low";
  warnings?: TempoWarning[];
  debugTrace?: TempoDebugTrace;
  engineVersion: string;
};
