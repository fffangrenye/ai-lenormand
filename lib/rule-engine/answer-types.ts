import { AnswerMode, QuestionContext, Timeframe } from "./ontology";
import { SafetyFlag, SynthesisResult } from "./synthesis-types";
import { TempoCompatibilityResult } from "./tempo-types";

export const answerPropositionTypes = ["state", "feeling", "action", "outcome", "development", "obstacle", "timing", "description", "location", "other"] as const;
export type AnswerPropositionType = (typeof answerPropositionTypes)[number];

export const propositionSources = ["action_frame", "question_object", "intent", "parser"] as const;
export type PropositionSource = (typeof propositionSources)[number];

export type AnswerProposition = {
  subject?: string;
  action?: string;
  object?: string;
  desiredState?: string;
  timeframeBound?: Timeframe;
  propositionType: AnswerPropositionType;
  source: PropositionSource;
};

export const answerResolutionLevels = ["strongly_supported", "supported", "conditional", "unclear", "weakly_supported", "not_supported", "not_applicable"] as const;
export type BasicAnswerResolutionLevel = (typeof answerResolutionLevels)[number];

export const answerEvidenceTypes = [
  "semantic_match",
  "semantic_mismatch",
  "action_match",
  "state_match",
  "feeling_match",
  "outcome_match",
  "process_match",
  "closing_state_match",
  "condition",
  "timeframe",
  "unresolved",
  "safety"
] as const;
export type AnswerEvidenceType = (typeof answerEvidenceTypes)[number];

export type AnswerEvidence = {
  type: AnswerEvidenceType;
  concept: string;
  evidenceCodes: string[];
  cardIds?: number[];
  strength: "strong" | "medium" | "weak";
};

export const semanticDirections = ["support", "oppose", "mixed", "insufficient"] as const;
export type SemanticDirection = (typeof semanticDirections)[number];

export type SemanticSupportSummary = {
  propositionMatched: boolean;
  supportingConcepts: string[];
  opposingConcepts: string[];
  neutralConcepts?: string[];
  missingComponents?: string[];
  semanticDirection: SemanticDirection;
};

export const answerConditionTypes = [
  "timing",
  "clarity",
  "external_block",
  "decision_required",
  "information_missing",
  "short_opportunity_window",
  "resource_required",
  "person_action_required",
  "multiple_options",
  "stability_not_yet_formed",
  "other"
] as const;
export type AnswerConditionType = (typeof answerConditionTypes)[number];

export type AnswerCondition = {
  type: AnswerConditionType;
  concept: string;
  evidenceCardIds?: number[];
  importance: "primary" | "secondary";
};

export const answerBlockerTypes = ["block", "delay", "ending", "erosion", "confusion", "lack_of_action", "lack_of_commitment", "missing_information", "opposing_choice", "other"] as const;
export type AnswerBlockerType = (typeof answerBlockerTypes)[number];

export type AnswerBlocker = {
  type: AnswerBlockerType;
  concept: string;
  severity: "low" | "medium" | "high";
};

export const answerUncertaintyTypes = ["semantic_ambiguity", "mixed_process", "hidden_information", "person_mapping", "timeframe", "multiple_options", "spread_conflict"] as const;
export type AnswerUncertaintyType = (typeof answerUncertaintyTypes)[number];

export type AnswerUncertainty = {
  type: AnswerUncertaintyType;
  concept: string;
  severity: "low" | "medium" | "high";
};

export const timingAnswerEffects = ["none", "strengthen", "qualify", "weaken", "prevent_timebounded_support", "uncertain"] as const;
export type TimingAnswerEffectType = (typeof timingAnswerEffects)[number];

export type TimingAnswerEffect = {
  compatibility: TempoCompatibilityResult["compatibility"];
  effect: TimingAnswerEffectType;
  reasonCode: string;
};

export type AnswerDebugTrace = {
  proposition: AnswerProposition;
  candidateSemanticMatches: AnswerEvidence[];
  supportEvidence: AnswerEvidence[];
  opposingEvidence: AnswerEvidence[];
  conditions: AnswerCondition[];
  blockers: AnswerBlocker[];
  uncertainty: AnswerUncertainty[];
  timeframeEffect?: TimingAnswerEffect;
  unresolvedEffect?: string;
  safetyEffect?: string;
  finalResolution: BasicAnswerResolutionLevel;
  confidenceReason: string;
};

export type BasicAnswerResolverInput = {
  question: QuestionContext;
  synthesis: SynthesisResult;
  tempo?: TempoCompatibilityResult;
};

export type BasicAnswerResolution = {
  answerMode: AnswerMode;
  proposition: AnswerProposition;
  resolution: BasicAnswerResolutionLevel;
  semanticSupport: SemanticSupportSummary;
  supportEvidence: AnswerEvidence[];
  opposingEvidence: AnswerEvidence[];
  conditions?: AnswerCondition[];
  blockers?: AnswerBlocker[];
  uncertainty?: AnswerUncertainty[];
  timingEffect?: TimingAnswerEffect;
  explanationCode: string;
  confidence: "high" | "medium" | "low";
  safetyFlags?: SafetyFlag[];
  debugTrace?: AnswerDebugTrace;
  engineVersion: string;
};
