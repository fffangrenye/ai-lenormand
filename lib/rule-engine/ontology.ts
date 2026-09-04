export const domains = [
  "relationship",
  "career",
  "study",
  "money",
  "family",
  "social",
  "home_property",
  "travel",
  "daily_life",
  "lost_item",
  "general"
] as const;

export type Domain = (typeof domains)[number];

export const objectTypes = [
  "person",
  "relationship",
  "message",
  "meeting",
  "job",
  "offer",
  "contract",
  "project",
  "exam",
  "application",
  "money",
  "payment",
  "property",
  "trip",
  "document",
  "item",
  "event",
  "alternatives",
  "other"
] as const;

export type ObjectType = (typeof objectTypes)[number];

export type QuestionObject = {
  type: ObjectType;
  label: string;
};

export const relationshipTopics = [
  "relationship_state",
  "feelings_attraction",
  "attitude_perception",
  "communication",
  "action_intention",
  "development",
  "commitment",
  "reconciliation",
  "conflict_obstacle",
  "trust_exclusivity",
  "intimacy",
  "friendship",
  "new_relationship"
] as const;

export const careerTopics = [
  "job_search",
  "current_job",
  "career_direction",
  "promotion_recognition",
  "workplace_relationship",
  "project_work",
  "contract_employment",
  "resignation_change",
  "business",
  "professional_reputation"
] as const;

export const studyTopics = ["exam", "application", "academic_project", "learning_progress", "result", "research"] as const;

export const moneyTopics = ["income", "assets", "cashflow", "expense", "transaction", "investment", "debt", "financial_agreement"] as const;

export const familyTopics = ["household", "parents", "children", "extended_family", "family_relationship", "family_event"] as const;

export const socialTopics = ["friendship", "group", "event", "networking", "public_reputation"] as const;

export const homePropertyTopics = ["residence", "move", "purchase", "sale", "rent", "renovation", "property_contract"] as const;

export const travelTopics = ["trip", "transport", "relocation", "overseas", "travel_outcome"] as const;

export const lostItemTopics = ["location", "condition", "recovery"] as const;

export const dailyLifeTopics = ["event", "meeting", "decision", "plan", "opportunity", "day_forecast"] as const;

export const generalTopics = ["general_state", "general_development", "general_advice", "wellbeing"] as const;

export const topicTypes = [
  ...relationshipTopics,
  ...careerTopics,
  ...studyTopics,
  ...moneyTopics,
  ...familyTopics,
  ...socialTopics,
  ...homePropertyTopics,
  ...travelTopics,
  ...lostItemTopics,
  ...dailyLifeTopics,
  ...generalTopics
] as const;

export type TopicType = (typeof topicTypes)[number];

export const intents = [
  "state",
  "feelings_attitude",
  "reason",
  "development",
  "outcome",
  "action",
  "obstacle",
  "advice",
  "decision",
  "comparison",
  "timing",
  "description",
  "location"
] as const;

export type Intent = (typeof intents)[number];

export const answerModes = ["open", "yes_no", "likelihood"] as const;

export type AnswerMode = (typeof answerModes)[number];

export const timeframeScopes = ["explicit", "implicit", "event_bounded", "open"] as const;
export type TimeframeScope = (typeof timeframeScopes)[number];

export const timeframeRelations = ["within", "before", "after", "during", "on", "around", "until", "since"] as const;
export type TimeframeRelation = (typeof timeframeRelations)[number];

export const timeframeUnits = ["hour", "day", "week", "month", "quarter", "year"] as const;
export type TimeframeUnit = (typeof timeframeUnits)[number];

export const timeframeAnchors = ["now", "calendar_period", "specific_date", "event", "process"] as const;
export type TimeframeAnchor = (typeof timeframeAnchors)[number];

export const timeframePrecisions = ["exact", "bounded", "approximate", "unspecified"] as const;
export type TimeframePrecision = (typeof timeframePrecisions)[number];

export const horizonClasses = ["immediate", "short", "near_term", "medium_term", "extended", "open"] as const;
export type HorizonClass = (typeof horizonClasses)[number];

export type Timeframe = {
  scope: TimeframeScope;
  relation?: TimeframeRelation;
  value?: number;
  unit?: TimeframeUnit;
  start?: string;
  end?: string;
  anchor?: TimeframeAnchor;
  precision: TimeframePrecision;
  sourceText?: string;
  normalized?: {
    horizonClass: HorizonClass;
    approximateDays?: number;
    startDate?: string;
    endDate?: string;
  };
};

export const personRoles = ["querent", "target", "counterparty", "third_party", "other"] as const;
export type PersonRole = (typeof personRoles)[number];

export const personRelations = [
  "self",
  "partner",
  "spouse",
  "dating_person",
  "crush",
  "ex",
  "friend",
  "coworker",
  "boss",
  "subordinate",
  "client",
  "teacher",
  "classmate",
  "parent",
  "child",
  "sibling",
  "relative",
  "roommate",
  "stranger",
  "unknown_person",
  "other"
] as const;

export type PersonRelation = (typeof personRelations)[number];

export const genderHints = ["male", "female", "nonbinary", "unknown"] as const;
export type GenderHint = (typeof genderHints)[number];

export const knownStatuses = ["known", "unknown", "unclear"] as const;
export type KnownStatus = (typeof knownStatuses)[number];

export type PersonContext = {
  id: string;
  label: string;
  role: PersonRole;
  relations: PersonRelation[];
  genderHint: GenderHint;
  knownStatus: KnownStatus;
  isPrimary: boolean;
  aliases?: string[];
};

export type Perspective = {
  subjectPersonId?: string;
  objectPersonId?: string;
};

export type ActionFrame = {
  actorPersonId?: string;
  recipientPersonId?: string;
  action?: string;
};

export type QuestionContext = {
  domain: Domain;
  primaryTopic: TopicType;
  secondaryTopics?: TopicType[];
  object: QuestionObject;
  intent: Intent;
  secondaryIntent?: Intent;
  timeframe: Timeframe;
  people: PersonContext[];
  perspective?: Perspective;
  actionFrame?: ActionFrame;
  answerMode: AnswerMode;
  topicConfidence: number;
  intentConfidence: number;
  peopleConfidence: number;
};
