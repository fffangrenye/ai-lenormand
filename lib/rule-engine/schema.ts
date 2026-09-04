import {
  AnswerMode,
  Domain,
  Intent,
  QuestionContext,
  TopicType,
  answerModes,
  domains,
  genderHints,
  horizonClasses,
  intents,
  knownStatuses,
  objectTypes,
  personRelations,
  personRoles,
  timeframeAnchors,
  timeframePrecisions,
  timeframeRelations,
  timeframeScopes,
  timeframeUnits,
  topicTypes
} from "./ontology";

export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalPositiveNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

function pushEnumIssue(issues: string[], path: string, value: unknown, allowed: readonly string[]) {
  issues.push(`${path} must be one of ${allowed.join(", ")}. Received ${String(value)}.`);
}

export function validateQuestionContext(value: unknown): ValidationResult<QuestionContext> {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return { success: false, issues: ["QuestionContext must be an object."] };
  }

  if (!isOneOf(value.domain, domains)) pushEnumIssue(issues, "domain", value.domain, domains);
  if (!isOneOf(value.primaryTopic, topicTypes)) pushEnumIssue(issues, "primaryTopic", value.primaryTopic, topicTypes);
  if (value.secondaryTopics !== undefined) {
    if (!Array.isArray(value.secondaryTopics)) {
      issues.push("secondaryTopics must be an array when provided.");
    } else {
      value.secondaryTopics.forEach((topic, index) => {
        if (!isOneOf(topic, topicTypes)) pushEnumIssue(issues, `secondaryTopics[${index}]`, topic, topicTypes);
      });
    }
  }

  if (!isRecord(value.object)) {
    issues.push("object must be an object.");
  } else {
    if (!isOneOf(value.object.type, objectTypes)) pushEnumIssue(issues, "object.type", value.object.type, objectTypes);
    if (typeof value.object.label !== "string") issues.push("object.label must be a string.");
  }

  if (!isOneOf(value.intent, intents)) pushEnumIssue(issues, "intent", value.intent, intents);
  if (value.secondaryIntent !== undefined && !isOneOf(value.secondaryIntent, intents)) {
    pushEnumIssue(issues, "secondaryIntent", value.secondaryIntent, intents);
  }

  validateTimeframe(value.timeframe, issues);
  validatePeople(value.people, issues);
  validatePerspective(value.perspective, issues);
  validateActionFrame(value.actionFrame, issues);

  if (!isOneOf(value.answerMode, answerModes)) pushEnumIssue(issues, "answerMode", value.answerMode, answerModes);
  validateConfidence(value.topicConfidence, "topicConfidence", issues);
  validateConfidence(value.intentConfidence, "intentConfidence", issues);
  validateConfidence(value.peopleConfidence, "peopleConfidence", issues);

  return {
    success: issues.length === 0,
    data: issues.length === 0 ? (value as QuestionContext) : undefined,
    issues
  };
}

export function assertQuestionContext(value: unknown): QuestionContext {
  const result = validateQuestionContext(value);
  if (!result.success || !result.data) {
    throw new Error(`Invalid QuestionContext:\n${result.issues.join("\n")}`);
  }
  return result.data;
}

export function isDomain(value: unknown): value is Domain {
  return isOneOf(value, domains);
}

export function isTopicType(value: unknown): value is TopicType {
  return isOneOf(value, topicTypes);
}

export function isIntent(value: unknown): value is Intent {
  return isOneOf(value, intents);
}

export function isAnswerMode(value: unknown): value is AnswerMode {
  return isOneOf(value, answerModes);
}

function validateTimeframe(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("timeframe must be an object.");
    return;
  }

  if (!isOneOf(value.scope, timeframeScopes)) pushEnumIssue(issues, "timeframe.scope", value.scope, timeframeScopes);
  if (value.relation !== undefined && !isOneOf(value.relation, timeframeRelations)) {
    pushEnumIssue(issues, "timeframe.relation", value.relation, timeframeRelations);
  }
  if (!isOptionalPositiveNumber(value.value)) issues.push("timeframe.value must be a positive number when provided.");
  if (value.unit !== undefined && !isOneOf(value.unit, timeframeUnits)) pushEnumIssue(issues, "timeframe.unit", value.unit, timeframeUnits);
  if (!isOptionalString(value.start)) issues.push("timeframe.start must be a string when provided.");
  if (!isOptionalString(value.end)) issues.push("timeframe.end must be a string when provided.");
  if (value.anchor !== undefined && !isOneOf(value.anchor, timeframeAnchors)) {
    pushEnumIssue(issues, "timeframe.anchor", value.anchor, timeframeAnchors);
  }
  if (!isOneOf(value.precision, timeframePrecisions)) {
    pushEnumIssue(issues, "timeframe.precision", value.precision, timeframePrecisions);
  }
  if (!isOptionalString(value.sourceText)) issues.push("timeframe.sourceText must be a string when provided.");

  if (value.normalized !== undefined) {
    if (!isRecord(value.normalized)) {
      issues.push("timeframe.normalized must be an object when provided.");
      return;
    }
    if (!isOneOf(value.normalized.horizonClass, horizonClasses)) {
      pushEnumIssue(issues, "timeframe.normalized.horizonClass", value.normalized.horizonClass, horizonClasses);
    }
    if (!isOptionalPositiveNumber(value.normalized.approximateDays)) {
      issues.push("timeframe.normalized.approximateDays must be a positive number when provided.");
    }
    if (!isOptionalString(value.normalized.startDate)) issues.push("timeframe.normalized.startDate must be a string when provided.");
    if (!isOptionalString(value.normalized.endDate)) issues.push("timeframe.normalized.endDate must be a string when provided.");
  }
}

function validatePeople(value: unknown, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push("people must be an array.");
    return;
  }

  value.forEach((person, index) => {
    if (!isRecord(person)) {
      issues.push(`people[${index}] must be an object.`);
      return;
    }
    if (typeof person.id !== "string" || !person.id) issues.push(`people[${index}].id must be a non-empty string.`);
    if (typeof person.label !== "string" || !person.label) issues.push(`people[${index}].label must be a non-empty string.`);
    if (!isOneOf(person.role, personRoles)) pushEnumIssue(issues, `people[${index}].role`, person.role, personRoles);
    if (!Array.isArray(person.relations)) {
      issues.push(`people[${index}].relations must be an array.`);
    } else {
      person.relations.forEach((relation, relationIndex) => {
        if (!isOneOf(relation, personRelations)) {
          pushEnumIssue(issues, `people[${index}].relations[${relationIndex}]`, relation, personRelations);
        }
      });
    }
    if (!isOneOf(person.genderHint, genderHints)) pushEnumIssue(issues, `people[${index}].genderHint`, person.genderHint, genderHints);
    if (!isOneOf(person.knownStatus, knownStatuses)) pushEnumIssue(issues, `people[${index}].knownStatus`, person.knownStatus, knownStatuses);
    if (typeof person.isPrimary !== "boolean") issues.push(`people[${index}].isPrimary must be a boolean.`);
    if (person.aliases !== undefined && (!Array.isArray(person.aliases) || person.aliases.some((alias) => typeof alias !== "string"))) {
      issues.push(`people[${index}].aliases must be a string array when provided.`);
    }
  });
}

function validatePerspective(value: unknown, issues: string[]) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push("perspective must be an object when provided.");
    return;
  }
  if (!isOptionalString(value.subjectPersonId)) issues.push("perspective.subjectPersonId must be a string when provided.");
  if (!isOptionalString(value.objectPersonId)) issues.push("perspective.objectPersonId must be a string when provided.");
}

function validateActionFrame(value: unknown, issues: string[]) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push("actionFrame must be an object when provided.");
    return;
  }
  if (!isOptionalString(value.actorPersonId)) issues.push("actionFrame.actorPersonId must be a string when provided.");
  if (!isOptionalString(value.recipientPersonId)) issues.push("actionFrame.recipientPersonId must be a string when provided.");
  if (!isOptionalString(value.action)) issues.push("actionFrame.action must be a string when provided.");
}

function validateConfidence(value: unknown, path: string, issues: string[]) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    issues.push(`${path} must be a number between 0 and 1.`);
  }
}
