import { getCardLexiconEntry } from "./lexicon";
import { SpreadInput, SpreadStructure } from "./spread-types";

export type SpreadValidationResult = {
  success: boolean;
  issues: string[];
};

export function validateSpreadInput(input: SpreadInput): SpreadValidationResult {
  const issues: string[] = [];
  if (input.spreadSize !== 3 && input.spreadSize !== 5) issues.push("spreadSize must be 3 or 5.");
  if (input.cards.length !== input.spreadSize) issues.push(`cards must contain exactly ${input.spreadSize} ids.`);
  if (new Set(input.cards).size !== input.cards.length) issues.push("cards must be unique.");
  for (const cardId of input.cards) {
    if (!getCardLexiconEntry(cardId)) issues.push(`cardId ${cardId} is not valid.`);
  }
  const expectedPairCount = input.spreadSize - 1;
  if (input.adjacentPairs.length !== expectedPairCount) issues.push(`adjacentPairs must contain exactly ${expectedPairCount} items.`);
  for (let index = 0; index < input.adjacentPairs.length; index += 1) {
    const pair = input.adjacentPairs[index];
    if (pair.leftCardId !== input.cards[index] || pair.rightCardId !== input.cards[index + 1]) {
      issues.push(`adjacentPairs[${index}] must match card order ${input.cards[index]}>${input.cards[index + 1]}.`);
    }
  }
  for (const cardId of input.cards) {
    if (!input.resolvedCards.some((meaning) => meaning.cardId === cardId)) issues.push(`resolvedCards missing card ${cardId}.`);
  }
  return { success: issues.length === 0, issues };
}

export function assertValidSpreadInput(input: SpreadInput) {
  const result = validateSpreadInput(input);
  if (!result.success) throw new Error(`Invalid SpreadInput:\n${result.issues.join("\n")}`);
  return input;
}

export function validateSpreadStructure(value: SpreadStructure): SpreadValidationResult {
  const issues: string[] = [];
  if (value.spreadSize === 3) {
    if (value.positions.length !== 3) issues.push("three-card positions must contain 3 items.");
    if (value.hingeCardId !== value.positions[1]?.cardId) issues.push("three-card hinge must be position B.");
  }
  if (value.spreadSize === 5) {
    if (value.positions.length !== 5) issues.push("five-card positions must contain 5 items.");
    if (value.focusCardId !== value.positions[2]?.cardId) issues.push("five-card focus must be position C.");
    const mirrorKeys = value.mirrors.map((mirror) => mirror.key).sort().join(",");
    if (mirrorKeys !== "AE,BD") issues.push("five-card mirrors must be AE and BD.");
  }
  if (value.forwardChain.cardIds.length !== value.spreadSize) issues.push("forwardChain cardIds must match spread size.");
  if (value.forwardChain.pairRelations.length !== value.spreadSize - 1) issues.push("forwardChain pairRelations count is invalid.");
  return { success: issues.length === 0, issues };
}

export function assertValidSpreadStructure<T extends SpreadStructure>(value: T): T {
  const result = validateSpreadStructure(value);
  if (!result.success) throw new Error(`Invalid SpreadStructure:\n${result.issues.join("\n")}`);
  return value;
}
