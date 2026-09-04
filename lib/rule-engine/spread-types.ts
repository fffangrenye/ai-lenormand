import { QuestionContext } from "./ontology";
import { PairInterpretation, PairRelationType, ResolvedCardMeaning } from "./pair-types";
import { PreselectedCardMeaning } from "./preselection-types";

export const structuralPositions = ["opening", "hinge", "focus", "development", "closing"] as const;
export type StructuralPosition = (typeof structuralPositions)[number];

export const spreadCoherences = ["coherent", "mostly_coherent", "mixed", "conflicted", "unclear"] as const;
export type SpreadCoherence = (typeof spreadCoherences)[number];

export const endpointRelationHints = ["consistent", "improving", "worsening", "shifted", "contrasting", "unclear"] as const;
export type EndpointRelationHintType = (typeof endpointRelationHints)[number];

export const mirrorFunctions = ["confirm", "qualify", "contrast", "subtext", "irrelevant"] as const;
export type MirrorFunction = (typeof mirrorFunctions)[number];

export const focusThematicRoles = ["topic", "pivot", "state", "operator", "person_anchor", "information_hub", "unclear"] as const;
export type FocusThematicRole = (typeof focusThematicRoles)[number];

export const spreadConflictTypes = [
  "center_mode_conflict",
  "pair_direction_conflict",
  "mirror_chain_conflict",
  "multiple_theme_conflict",
  "person_mapping_conflict"
] as const;
export type SpreadConflictType = (typeof spreadConflictTypes)[number];

export const spreadWarningTypes = [
  "multiple_primary_people",
  "topic_drift",
  "center_mode_conflict",
  "mirror_conflict",
  "high_ambiguity",
  "horizon_too_long_for_small_spread"
] as const;
export type SpreadWarningType = (typeof spreadWarningTypes)[number];

export const mainProcesses = [
  "stable",
  "developing",
  "changing",
  "blocked",
  "eroding",
  "ending",
  "repeating",
  "clarifying",
  "uncertain",
  "mixed"
] as const;
export type MainProcess = (typeof mainProcesses)[number];

export const closingEffects = ["open", "resolved", "confirmed", "blocked", "ended", "stabilized", "burdened", "changed", "neutral", "unclear"] as const;
export type ClosingEffect = (typeof closingEffects)[number];

export const tempoSignals = ["fast", "slow", "sudden", "persistent", "short_lived", "delayed", "blocked", "cyclical", "variable"] as const;
export type TempoSignal = (typeof tempoSignals)[number];

export type SpreadInput = {
  question: QuestionContext;
  cards: number[];
  resolvedCards: ResolvedCardMeaning[];
  adjacentPairs: PairInterpretation[];
  spreadSize: 3 | 5;
  preselectedCards?: PreselectedCardMeaning[];
};

export type SpreadPosition = {
  label: "A" | "B" | "C" | "D" | "E";
  index: number;
  cardId: number;
  structuralRole: StructuralPosition;
  resolvedMeaning: ResolvedCardMeaning;
  importance: "primary" | "supporting";
};

export type SpreadTransition = {
  fromCardId: number;
  toCardId: number;
  relation: PairRelationType;
  semanticEffect?: PairInterpretation["primaryRelation"]["semanticResult"];
  narrativeFunction: "introduce" | "develop" | "shift" | "block" | "change" | "resolve" | "close" | "qualify";
};

export type ForwardChain = {
  cardIds: number[];
  pairRelations: PairRelationType[];
  transitions: SpreadTransition[];
  coherence: SpreadCoherence;
};

export type HingeEvidence = {
  cardId: number;
  leftRelation?: PairRelationType;
  rightRelation?: PairRelationType;
  reinforcedModes?: string[];
  conflictingModes?: string[];
  confidence: "high" | "medium" | "low";
};

export type FocusEvidence = {
  cardId: number;
  leftSupport?: string[];
  rightSupport?: string[];
  reinforcedModes?: string[];
  conflictingModes?: string[];
  thematicRole: FocusThematicRole;
  confidence: "high" | "medium" | "low";
};

export type EndpointRelationHint = {
  openingCardId: number;
  closingCardId: number;
  relation: EndpointRelationHintType;
};

export type MirrorEvidence = {
  key: "AE" | "BD";
  leftCardId: number;
  rightCardId: number;
  function: MirrorFunction;
  relevance: "high" | "medium" | "low";
  relationSummary: PairRelationType;
  forwardRelation: PairInterpretation;
  reverseRelation: PairInterpretation;
  conflictsWithMainChain?: boolean;
};

export type StructuralEvidence = {
  source: "position" | "adjacent_pair" | "hinge" | "focus" | "mirror" | "intent" | "tempo" | "person";
  code: string;
  cardIds?: number[];
  pairKey?: string;
  detail?: string;
};

export type SpreadConflict = {
  type: SpreadConflictType;
  cardId?: number;
  leftEvidence?: string[];
  rightEvidence?: string[];
  severity: "low" | "medium" | "high";
};

export type SpreadWarning = {
  type: SpreadWarningType;
  detail?: string;
};

export type SpreadSemanticFrame = {
  coreTheme?: string;
  mainProcess?: MainProcess;
  keyTransitions?: SpreadTransition[];
  closingEffect?: ClosingEffect;
  conditions?: string[];
  unresolved?: boolean;
};

export type TempoEvidence = {
  cardId?: number;
  pair?: [number, number];
  signal: TempoSignal;
};

export type SpreadDebugTrace = {
  spreadSize: 3 | 5;
  positions: Array<{ label: string; cardId: number; structuralRole: StructuralPosition }>;
  adjacentPairs: string[];
  hingeCardId?: number;
  focusCardId?: number;
  mirrorKeys?: Array<"AE" | "BD">;
  coherence: SpreadCoherence;
  structuralEvidence: string[];
  conflicts: SpreadConflictType[];
  warnings: SpreadWarningType[];
  semanticFrame: SpreadSemanticFrame;
};

export type ThreeCardSpreadStructure = {
  type: "three_card";
  spreadSize: 3;
  positions: SpreadPosition[];
  adjacentPairs: {
    ab: PairInterpretation;
    bc: PairInterpretation;
  };
  hingeCardId: number;
  hingeEvidence: HingeEvidence;
  endpointHint: EndpointRelationHint;
  forwardChain: ForwardChain;
  semanticFrame: SpreadSemanticFrame;
  structuralEvidence: StructuralEvidence[];
  tempoEvidence: TempoEvidence[];
  conflicts?: SpreadConflict[];
  warnings?: SpreadWarning[];
  debugTrace: SpreadDebugTrace;
};

export type FiveCardSpreadStructure = {
  type: "five_card";
  spreadSize: 5;
  positions: SpreadPosition[];
  adjacentPairs: {
    ab: PairInterpretation;
    bc: PairInterpretation;
    cd: PairInterpretation;
    de: PairInterpretation;
  };
  focusCardId: number;
  focusEvidence: FocusEvidence;
  forwardChain: ForwardChain;
  mirrors: MirrorEvidence[];
  semanticFrame: SpreadSemanticFrame;
  structuralEvidence: StructuralEvidence[];
  tempoEvidence: TempoEvidence[];
  conflicts?: SpreadConflict[];
  warnings?: SpreadWarning[];
  debugTrace: SpreadDebugTrace;
};

export type SpreadStructure = ThreeCardSpreadStructure | FiveCardSpreadStructure;
