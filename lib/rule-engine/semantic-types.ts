import { Domain, Intent, TimeframeUnit, TopicType } from "./ontology";

export const interpretationPlanes = ["abstract", "action", "information", "person", "literal", "location"] as const;
export type InterpretationPlane = (typeof interpretationPlanes)[number];

export const semanticRoles = [
  "core_theme",
  "modifier",
  "state",
  "action",
  "result",
  "obstacle",
  "resource",
  "information",
  "person_anchor",
  "location",
  "tempo",
  "duration",
  "quantity",
  "safety"
] as const;
export type SemanticRole = (typeof semanticRoles)[number];

export const specialBehaviors = [
  "reduce_scale",
  "amplify_scale",
  "mark_early_stage",
  "shorten_duration",
  "reduce_clarity",
  "clarify_adjacent_theme",
  "change_adjacent_theme",
  "end_adjacent_theme",
  "cut_adjacent_theme",
  "repeat_adjacent_theme",
  "improve_tone",
  "diminish_adjacent_theme",
  "prefer_known_person",
  "signal_loyalty",
  "spread_or_connect_adjacent_theme",
  "formalize_adjacent_theme",
  "create_boundary",
  "publicize_adjacent_theme",
  "pluralize_adjacent_theme",
  "block_adjacent_theme",
  "delay_adjacent_theme",
  "open_alternatives",
  "split_adjacent_theme",
  "erode_adjacent_theme",
  "drain_resource",
  "emotionally_charge_adjacent_theme",
  "bind_adjacent_theme",
  "cycle_adjacent_theme",
  "hide_adjacent_theme",
  "mark_unknown",
  "document_adjacent_theme",
  "communicate_adjacent_theme",
  "anchor_person",
  "receive_neighbor_description",
  "extend_duration",
  "mature_adjacent_theme",
  "calm_adjacent_theme",
  "illuminate_adjacent_theme",
  "energize_adjacent_theme",
  "relieve_difficulty",
  "increase_visibility",
  "confirm_adjacent_theme",
  "mark_importance",
  "unlock_adjacent_theme",
  "make_theme_flow",
  "increase_quantity",
  "stabilize_adjacent_theme",
  "fix_adjacent_theme",
  "burden_adjacent_theme",
  "emphasize_following_theme",
  "finalize_previous_theme",
  "increase_cost"
] as const;
export type SpecialBehavior = (typeof specialBehaviors)[number];

export const safetyTags = ["health", "pregnancy", "sexuality", "legal", "financial", "high_risk_claim", "fate_absolute"] as const;
export type SafetyTag = (typeof safetyTags)[number];

export const semanticAgencies = ["active", "passive_anchor", "mixed"] as const;
export type SemanticAgency = (typeof semanticAgencies)[number];

export const tempos = ["very_fast", "fast", "moderate", "slow", "very_slow", "sudden", "unknown"] as const;
export type Tempo = (typeof tempos)[number];

export const durations = ["brief", "short", "medium", "long", "persistent", "unknown"] as const;
export type Duration = (typeof durations)[number];

export const orientations = ["favorable", "neutral", "challenging", "contextual"] as const;
export type Orientation = (typeof orientations)[number];

export const ambiguityLevels = ["low", "medium", "high"] as const;
export type AmbiguityLevel = (typeof ambiguityLevels)[number];

export const defaultPriorities = ["primary", "secondary", "rare"] as const;
export type DefaultPriority = (typeof defaultPriorities)[number];

export type ContextPredicate = {
  field: "domain" | "topic" | "intent" | "objectType" | "personRelation" | "knownStatus" | "answerMode" | "timeframeUnit" | "horizonClass";
  equals?: Domain | TopicType | Intent | string | TimeframeUnit;
  in?: Array<Domain | TopicType | Intent | string | TimeframeUnit>;
};

export type SemanticAffinities = {
  domains?: Domain[];
  topics?: TopicType[];
  intents?: Intent[];
  objectTypes?: string[];
  personRelations?: string[];
};

export type SemanticMode = {
  id: string;
  meanings: string[];
  defaultPriority: DefaultPriority;
  roles: SemanticRole[];
  planes: InterpretationPlane[];
  affinities?: SemanticAffinities;
  requiresContext?: boolean;
  activation?: {
    anyOf?: ContextPredicate[];
    allOf?: ContextPredicate[];
    neighborSupportRequired?: boolean;
  };
  timeframeBehavior?: {
    shortHorizonBoost?: string[];
    longHorizonBoost?: string[];
  };
  tempoOverride?: Tempo;
  durationOverride?: Duration;
  safetyTag?: SafetyTag;
  notes?: string;
};

export type ContextOverride = {
  modeId: string;
  adjustment: "strong_boost" | "boost" | "suppress" | "block";
  when: ContextPredicate[];
  notes?: string;
};

export type CardLexiconEntry = {
  id: number;
  name: string;
  primaryMeanings: string[];
  secondaryMeanings: string[];
  coreModes: string[];
  semanticModes: SemanticMode[];
  roles: SemanticRole[];
  orientation: Orientation;
  tempo?: Tempo;
  duration?: Duration;
  ambiguityLevel: AmbiguityLevel;
  contextOverrides?: ContextOverride[];
  specialBehaviors?: SpecialBehavior[];
  literalMeanings?: string[];
  personMeanings?: string[];
  contrasts?: number[];
  semanticAgency?: SemanticAgency;
};
