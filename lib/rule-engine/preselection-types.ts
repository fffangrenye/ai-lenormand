import { AmbiguityLevel, InterpretationPlane, SemanticRole } from "./semantic-types";

export const relevanceTiers = ["dominant", "strong", "possible", "weak", "suppressed"] as const;
export type RelevanceTier = (typeof relevanceTiers)[number];

export const meaningEvidenceSources = [
  "default",
  "domain",
  "topic",
  "intent",
  "object",
  "people",
  "action_frame",
  "perspective",
  "timeframe",
  "override",
  "safety",
  "neighbor",
  "position"
] as const;
export type MeaningEvidenceSource = (typeof meaningEvidenceSources)[number];

export type MeaningEvidence = {
  source: MeaningEvidenceSource;
  code: string;
  detail?: string;
};

export type SemanticWarning = {
  code: string;
  detail?: string;
};

export type SemanticCandidate = {
  modeId: string;
  relevance: RelevanceTier;
  internalScore: number;
  roles: SemanticRole[];
  planes: InterpretationPlane[];
  evidence: MeaningEvidence[];
  conflicts?: string[];
  blocked?: boolean;
  requiresNeighborResolution?: boolean;
};

export type PreselectedCardMeaning = {
  cardId: number;
  preferredPlane: InterpretationPlane;
  candidates: SemanticCandidate[];
  unresolved: boolean;
  ambiguity: AmbiguityLevel;
  evidence: MeaningEvidence[];
  warnings?: SemanticWarning[];
};

export type PreselectionDebugTrace = {
  cardId: number;
  steps: Array<{
    stage: string;
    modeId: string;
    beforeScore: number;
    afterScore: number;
    evidenceCode?: string;
  }>;
};

export type PreselectionResult = {
  meaning: PreselectedCardMeaning;
  debugTrace: PreselectionDebugTrace;
};
