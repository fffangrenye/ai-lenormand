import { QuestionContext } from "./ontology";
import { MeaningEvidence, PreselectedCardMeaning, RelevanceTier } from "./preselection-types";
import { CardLexiconEntry, InterpretationPlane, SemanticRole, SpecialBehavior } from "./semantic-types";

export const pairRelationTypes = [
  "describe",
  "modify",
  "act_on",
  "change",
  "block",
  "end",
  "cut",
  "erode",
  "confirm",
  "unlock",
  "bind",
  "stabilize",
  "publicize",
  "pluralize",
  "clarify",
  "hide",
  "communicate",
  "repeat",
  "intensify",
  "burden",
  "finalize",
  "sequence",
  "associate"
] as const;
export type PairRelationType = (typeof pairRelationTypes)[number];

export type PairInput = {
  left: PreselectedCardMeaning;
  right: PreselectedCardMeaning;
  leftCard: CardLexiconEntry;
  rightCard: CardLexiconEntry;
  question: QuestionContext;
  pairIndex: number;
  spreadSize: 3 | 5;
};

export type PairSemanticResult = {
  headConcept: string;
  qualifiers?: string[];
  action?: string;
  stateChange?: "increase" | "decrease" | "begin" | "continue" | "delay" | "block" | "end" | "change" | "confirm" | "unlock" | "stabilize" | "unclear";
  informationState?: "unknown" | "hidden" | "unclear" | "incoming" | "spoken" | "written" | "public" | "formal" | "confirmed";
  quantityEffect?: "smaller" | "larger" | "multiple" | "reduced" | "none";
  temporalEffect?: "faster" | "slower" | "shorter" | "longer" | "sudden" | "none";
  personEffect?: {
    personCardId?: number;
    descriptors?: string[];
  };
};

export type PairEvidence = {
  source: "cmse" | "card_order" | "semantic_agency" | "special_behavior" | "pair_override" | "topic" | "intent" | "object" | "people" | "role_compatibility";
  code: string;
  detail?: string;
};

export type PairRelationCandidate = {
  relation: PairRelationType;
  subjectCardId: number;
  operatorCardId?: number;
  subjectModeId: string;
  operatorModeId?: string;
  semanticResult: PairSemanticResult;
  confidence: "high" | "medium" | "low";
  evidence: PairEvidence[];
  requiresSpreadResolution?: boolean;
  internalScore: number;
};

export type NeighborEvidence = {
  sourceCardId: number;
  targetCardId: number;
  supportsModes?: string[];
  suppressesModes?: string[];
  suggestsRole?: SemanticRole;
  relationCandidate?: PairRelationType;
  confidence: "high" | "medium" | "low";
  evidenceCode: string;
};

export type ModePairCandidate = {
  leftModeId: string;
  rightModeId: string;
  leftTier: RelevanceTier;
  rightTier: RelevanceTier;
  compatibility: "strong" | "compatible" | "weak" | "conflicting";
  relationCandidates: PairRelationCandidate[];
  internalScore: number;
};

export type PairDebugTrace = {
  pair: [number, number];
  generatedModePairs: Array<{ leftModeId: string; rightModeId: string; score: number }>;
  appliedOverrides: string[];
  appliedBehaviors: SpecialBehavior[];
  relationCandidates: Array<{ relation: PairRelationType; score: number }>;
  selectedRelation: PairRelationType;
};

export type PairInterpretation = {
  leftCardId: number;
  rightCardId: number;
  direction: "left_to_right";
  primaryRelation: PairRelationCandidate;
  alternativeRelations?: PairRelationCandidate[];
  neighborEvidence: NeighborEvidence[];
  unresolved: boolean;
  debugTrace?: PairDebugTrace;
};

export type ResolvedCardMeaning = {
  cardId: number;
  primaryMode: string;
  secondaryMode?: string;
  role: SemanticRole;
  plane: InterpretationPlane;
  confidence: "high" | "medium" | "low";
  evidence: MeaningEvidence[];
  unresolvedAlternatives?: string[];
};

export function orderedPairKey(leftCardId: number, rightCardId: number) {
  return `${leftCardId}>${rightCardId}`;
}

export type PairOverride = {
  key: string;
  when?: Array<{ field: "domain" | "topic" | "intent" | "objectType"; equals: string }>;
  preferredRelations: Array<{
    leftModeId?: string;
    rightModeId?: string;
    relation: PairRelationType;
    semanticPatch?: Partial<PairSemanticResult>;
    supportsLeft?: string[];
    supportsRight?: string[];
    suppressesLeft?: string[];
    suppressesRight?: string[];
  }>;
  priority: "high" | "medium";
  code: string;
};

export type FinalResolutionInput = {
  preselected: PreselectedCardMeaning[];
  pairInterpretations: PairInterpretation[];
};

export type PairPipelineResult = {
  initialPairs: PairInterpretation[];
  resolvedCards: ResolvedCardMeaning[];
  refinedPairs: PairInterpretation[];
  refinementPasses: 0 | 1;
};
