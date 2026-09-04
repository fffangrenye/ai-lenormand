import { Intent, QuestionContext } from "./ontology";
import { PairInterpretation, ResolvedCardMeaning } from "./pair-types";
import { SpreadStructure } from "./spread-types";

export const synthesisMainProcesses = [
  "stable",
  "developing",
  "approaching",
  "changing",
  "improving",
  "deteriorating",
  "blocked",
  "delayed",
  "eroding",
  "ending",
  "cutting",
  "repeating",
  "clarifying",
  "confirming",
  "binding",
  "stabilizing",
  "uncertain",
  "mixed",
  "none"
] as const;
export type SynthesisMainProcess = (typeof synthesisMainProcesses)[number];

export const synthesisConfidences = ["high", "medium", "low"] as const;
export type SynthesisConfidence = (typeof synthesisConfidences)[number];

export const semanticUnitTypes = [
  "theme",
  "state",
  "action",
  "change",
  "block",
  "cause",
  "condition",
  "result",
  "person",
  "information",
  "timing",
  "advice_signal"
] as const;
export type SemanticUnitType = (typeof semanticUnitTypes)[number];

export const semanticUnitSources = ["card", "pair", "hinge", "focus", "mirror", "spread", "question"] as const;
export type SemanticUnitSource = (typeof semanticUnitSources)[number];

export const semanticUnitImportances = ["primary", "secondary", "supporting"] as const;
export type SemanticUnitImportance = (typeof semanticUnitImportances)[number];

export type SemanticUnit = {
  id: string;
  type: SemanticUnitType;
  concept: string;
  target?: string;
  process?: string;
  personId?: string;
  cardIds: number[];
  modeIds: string[];
  source: SemanticUnitSource;
  evidenceRefs: string[];
  importance: SemanticUnitImportance;
  confidence: SynthesisConfidence;
};

export type SynthesisTheme = {
  label: string;
  primaryCardId: number;
  primaryModeIds: string[];
  supportingCardIds: number[];
  evidenceCodes: string[];
  confidence: SynthesisConfidence;
};

export const narrativeFunctions = ["theme", "context", "process", "transition", "condition", "result", "uncertainty"] as const;
export type NarrativeFunction = (typeof narrativeFunctions)[number];

export type NarrativeUnit = {
  order: number;
  function: NarrativeFunction;
  concept: string;
  cardIds: number[];
  evidenceCodes: string[];
  confidence: SynthesisConfidence;
};

export const synthesisTransitionTypes = [
  "continue",
  "approach",
  "begin",
  "change",
  "improve",
  "worsen",
  "block",
  "delay",
  "erode",
  "end",
  "cut",
  "clarify",
  "confirm",
  "bind",
  "stabilize",
  "repeat",
  "publicize",
  "pluralize",
  "communicate",
  "hide",
  "reveal",
  "burden",
  "resolve"
] as const;
export type SynthesisTransitionType = (typeof synthesisTransitionTypes)[number];

export type SynthesisTransition = {
  type: SynthesisTransitionType;
  fromConcept?: string;
  toConcept?: string;
  cardIds: number[];
  evidenceCodes: string[];
  confidence: SynthesisConfidence;
};

export const synthesisConditionTypes = [
  "requires_action",
  "brief_window",
  "delay",
  "uncertainty",
  "external_obstacle",
  "internal_conflict",
  "information_missing",
  "multiple_options",
  "resource_constraint",
  "relationship_constraint",
  "other"
] as const;
export type SynthesisConditionType = (typeof synthesisConditionTypes)[number];

export type SynthesisCondition = {
  type: SynthesisConditionType;
  concept: string;
  cardIds: number[];
  evidenceCodes: string[];
  confidence: SynthesisConfidence;
};

export const closingStateTypes = [
  "open",
  "stable",
  "confirmed",
  "blocked",
  "delayed",
  "ended",
  "changed",
  "unclear",
  "burdened",
  "repeating",
  "improving",
  "deteriorating",
  "mixed"
] as const;
export type ClosingStateType = (typeof closingStateTypes)[number];

export type ClosingState = {
  type: ClosingStateType;
  cardIds: number[];
  evidence: string[];
  confidence: SynthesisConfidence;
};

export const conclusionTypes = [
  "state",
  "trajectory",
  "result_tendency",
  "cause",
  "action_tendency",
  "condition",
  "timing_signal",
  "description",
  "location"
] as const;
export type SynthesisConclusionType = (typeof conclusionTypes)[number];

export const conclusionSupports = ["clear", "supported", "conditional", "unclear"] as const;
export type SynthesisConclusionSupport = (typeof conclusionSupports)[number];

export type SynthesisConclusion = {
  type: SynthesisConclusionType;
  subject?: string;
  summary: string;
  summaryConcepts: string[];
  support: SynthesisConclusionSupport;
  conditions?: string[];
  unresolved?: boolean;
  evidenceCardIds: number[];
};

export const safetyFlagTypes = [
  "third_party_not_confirmed",
  "pregnancy_not_confirmed",
  "health_not_diagnosis",
  "crime_not_attributed",
  "investment_not_guaranteed",
  "legal_not_guaranteed",
  "fate_not_absolute"
] as const;
export type SafetyFlagType = (typeof safetyFlagTypes)[number];

export type SafetyFlag = {
  type: SafetyFlagType;
  concept: string;
  cardIds: number[];
  evidenceCodes: string[];
};

export const unresolvedPointTypes = [
  "semantic_mode_conflict",
  "process_conflict",
  "closing_conflict",
  "mirror_conflict",
  "person_conflict",
  "topic_conflict",
  "certainty_conflict",
  "pair_unresolved",
  "high_ambiguity"
] as const;
export type UnresolvedPointType = (typeof unresolvedPointTypes)[number];

export type UnresolvedPoint = {
  type: UnresolvedPointType;
  concept: string;
  cardIds: number[];
  evidenceCodes: string[];
  confidence: SynthesisConfidence;
};

export type WholeLineSynthesisInput = {
  question: QuestionContext;
  resolvedCards: ResolvedCardMeaning[];
  pairs: PairInterpretation[];
  spread: SpreadStructure;
};

export type SynthesisDebugTrace = {
  collectedUnits: SemanticUnit[];
  mergedUnits: SemanticUnit[];
  removedDuplicates: Array<{
    removedId: string;
    mergedIntoId: string;
    reason: string;
  }>;
  selectedCoreTheme: SynthesisTheme;
  selectedMainProcess: SynthesisMainProcess;
  appliedIntentProfile: Intent;
  appliedConditions: SynthesisCondition[];
  unresolvedConflicts: UnresolvedPoint[];
  conclusionEvidence: string[];
};

export type SynthesisResult = {
  coreTheme: SynthesisTheme;
  mainProcess: SynthesisMainProcess;
  narrativeUnits: NarrativeUnit[];
  keyTransitions: SynthesisTransition[];
  conditions?: SynthesisCondition[];
  closingState?: ClosingState;
  conclusion: SynthesisConclusion;
  unresolvedPoints?: UnresolvedPoint[];
  confidence: SynthesisConfidence;
  safetyFlags?: SafetyFlag[];
  debugTrace?: SynthesisDebugTrace;
  engineVersion: string;
};
