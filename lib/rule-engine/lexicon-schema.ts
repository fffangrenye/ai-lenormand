import { topicTypes } from "./ontology";
import {
  CardLexiconEntry,
  SemanticMode,
  ambiguityLevels,
  defaultPriorities,
  durations,
  interpretationPlanes,
  orientations,
  safetyTags,
  semanticAgencies,
  semanticRoles,
  specialBehaviors,
  tempos
} from "./semantic-types";

export type LexiconValidationResult = {
  success: boolean;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function hasStringArray(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}

export function validateLexicon(cards: CardLexiconEntry[]): LexiconValidationResult {
  const issues: string[] = [];

  if (cards.length !== 36) issues.push(`Lexicon must contain exactly 36 cards. Received ${cards.length}.`);

  const ids = new Set<number>();
  const names = new Set<string>();
  for (let expectedId = 1; expectedId <= 36; expectedId += 1) {
    if (!cards.some((card) => card.id === expectedId)) issues.push(`Missing card id ${expectedId}.`);
  }

  for (const card of cards) {
    validateCard(card, issues);
    if (ids.has(card.id)) issues.push(`Duplicate card id ${card.id}.`);
    ids.add(card.id);
    if (names.has(card.name)) issues.push(`Duplicate card name ${card.name}.`);
    names.add(card.name);

    const modeIds = new Set<string>();
    for (const mode of card.semanticModes) {
      if (modeIds.has(mode.id)) issues.push(`${card.name}: duplicate mode id ${mode.id}.`);
      modeIds.add(mode.id);
      validateMode(card, mode, issues);
    }

    for (const coreMode of card.coreModes) {
      if (!modeIds.has(coreMode)) issues.push(`${card.name}: coreMode ${coreMode} does not exist in semanticModes.`);
    }

    for (const override of card.contextOverrides ?? []) {
      if (!modeIds.has(override.modeId)) issues.push(`${card.name}: context override references missing mode ${override.modeId}.`);
    }

    for (const contrast of card.contrasts ?? []) {
      if (!Number.isInteger(contrast) || contrast < 1 || contrast > 36) issues.push(`${card.name}: invalid contrast card id ${contrast}.`);
    }

    if ((card.id === 28 || card.id === 29) && card.semanticAgency !== "passive_anchor") {
      issues.push(`${card.name}: Man/Woman must use passive_anchor semanticAgency.`);
    }
    if (card.id !== 28 && card.id !== 29 && card.semanticAgency !== "mixed") {
      issues.push(`${card.name}: non-person-anchor cards must use mixed semanticAgency.`);
    }

    if (!card.semanticModes.some((mode) => mode.defaultPriority === "primary")) {
      issues.push(`${card.name}: must have at least one primary semantic mode.`);
    }
  }

  validateGoldenSafety(cards, issues);

  return { success: issues.length === 0, issues };
}

export function assertValidLexicon(cards: CardLexiconEntry[]) {
  const result = validateLexicon(cards);
  if (!result.success) {
    throw new Error(`Invalid Lenormand lexicon:\n${result.issues.join("\n")}`);
  }
  return cards;
}

function validateCard(card: CardLexiconEntry, issues: string[]) {
  if (!Number.isInteger(card.id)) issues.push(`Card id must be an integer. Received ${String(card.id)}.`);
  if (typeof card.name !== "string" || !card.name) issues.push(`Card ${card.id}: name must be a non-empty string.`);
  if (!hasStringArray(card.primaryMeanings)) issues.push(`${card.name}: primaryMeanings must be a non-empty string array.`);
  if (!Array.isArray(card.secondaryMeanings)) issues.push(`${card.name}: secondaryMeanings must be an array.`);
  if (!hasStringArray(card.coreModes)) issues.push(`${card.name}: coreModes must be a non-empty string array.`);
  if (!Array.isArray(card.semanticModes) || card.semanticModes.length === 0) issues.push(`${card.name}: semanticModes must be non-empty.`);
  if (!Array.isArray(card.roles) || card.roles.some((role) => !isOneOf(role, semanticRoles))) issues.push(`${card.name}: roles contains invalid values.`);
  if (!isOneOf(card.orientation, orientations)) issues.push(`${card.name}: invalid orientation.`);
  if (card.tempo !== undefined && !isOneOf(card.tempo, tempos)) issues.push(`${card.name}: invalid tempo.`);
  if (card.duration !== undefined && !isOneOf(card.duration, durations)) issues.push(`${card.name}: invalid duration.`);
  if (!isOneOf(card.ambiguityLevel, ambiguityLevels)) issues.push(`${card.name}: invalid ambiguityLevel.`);
  if (card.specialBehaviors?.some((behavior) => !isOneOf(behavior, specialBehaviors))) issues.push(`${card.name}: invalid specialBehavior.`);
  if (card.semanticAgency !== undefined && !isOneOf(card.semanticAgency, semanticAgencies)) issues.push(`${card.name}: invalid semanticAgency.`);
}

function validateMode(card: CardLexiconEntry, mode: SemanticMode, issues: string[]) {
  if (typeof mode.id !== "string" || !mode.id) issues.push(`${card.name}: mode id must be a non-empty string.`);
  if (!hasStringArray(mode.meanings)) issues.push(`${card.name}.${mode.id}: meanings must be a non-empty string array.`);
  if (!isOneOf(mode.defaultPriority, defaultPriorities)) issues.push(`${card.name}.${mode.id}: invalid defaultPriority.`);
  if (!Array.isArray(mode.roles) || mode.roles.some((role) => !isOneOf(role, semanticRoles))) issues.push(`${card.name}.${mode.id}: invalid roles.`);
  if (!Array.isArray(mode.planes) || mode.planes.some((plane) => !isOneOf(plane, interpretationPlanes))) issues.push(`${card.name}.${mode.id}: invalid planes.`);
  if (mode.tempoOverride !== undefined && !isOneOf(mode.tempoOverride, tempos)) issues.push(`${card.name}.${mode.id}: invalid tempoOverride.`);
  if (mode.durationOverride !== undefined && !isOneOf(mode.durationOverride, durations)) issues.push(`${card.name}.${mode.id}: invalid durationOverride.`);
  if (mode.safetyTag !== undefined && !isOneOf(mode.safetyTag, safetyTags)) issues.push(`${card.name}.${mode.id}: invalid safetyTag.`);
  validatePredicates(card, mode, issues);
}

function validatePredicates(card: CardLexiconEntry, mode: SemanticMode, issues: string[]) {
  for (const group of [mode.activation?.anyOf, mode.activation?.allOf]) {
    for (const predicate of group ?? []) {
      if (!isRecord(predicate)) {
        issues.push(`${card.name}.${mode.id}: activation predicate must be an object.`);
        continue;
      }
      if (predicate.field === "topic") {
        const values = predicate.in ?? (predicate.equals ? [predicate.equals] : []);
        for (const value of values) {
          if (!isOneOf(value, topicTypes)) issues.push(`${card.name}.${mode.id}: unknown topic predicate ${String(value)}.`);
        }
      }
    }
  }
}

function validateGoldenSafety(cards: CardLexiconEntry[], issues: string[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const mode = (cardId: number, modeId: string) => byId.get(cardId)?.semanticModes.find((item) => item.id === modeId);

  const snakeThirdParty = mode(7, "third_party_factor");
  if (!snakeThirdParty?.activation?.neighborSupportRequired) issues.push("Snake.third_party_factor must require neighbor support.");

  const crossroadsThirdParty = mode(22, "third_party_or_multiple_interest");
  if (!crossroadsThirdParty?.activation?.neighborSupportRequired) issues.push("Crossroads.third_party_or_multiple_interest must require neighbor support.");

  for (const [cardId, modeId, safetyTag] of [
    [5, "health_wellbeing", "health"],
    [17, "reproductive_change", "pregnancy"],
    [11, "sexuality", "sexuality"],
    [30, "sexuality", "sexuality"]
  ] as const) {
    const targetMode = mode(cardId, modeId);
    if (targetMode?.safetyTag !== safetyTag) issues.push(`${byId.get(cardId)?.name}.${modeId} must carry ${safetyTag} safetyTag.`);
    if (!targetMode?.requiresContext) issues.push(`${byId.get(cardId)?.name}.${modeId} must be context-gated.`);
  }
}
