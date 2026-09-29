import { DeepReadingResult } from "./deep-reading-result";
import { LenormandCard, lenormandCards } from "./lenormand-cards";
import { RuleEngineError, runRuleEngineReading, RuleEngineReadingResult } from "./rule-engine";
import { spreadSizeForSpreadType } from "./reading-source";
import { conditionPhrase, unresolvedPhrase } from "./rule-engine/renderer-phrases";

export type ProductionReadingCard = {
  cardNumber: number;
  cardSlug: string;
  nameEn: string;
  nameZh: string;
};

export type ProductionSpreadType = "three_card" | "five_card_linear";

export type ProductionRuleEngineResult = {
  deepReadingResult: DeepReadingResult;
  ruleEngineResult: RuleEnginePersistenceResult;
  ruleEngineVersion: string;
  ruleEngineSchemaVersion: string;
};

export type RuleEnginePersistenceResult = {
  questionContext: RuleEngineReadingResult["questionContext"];
  resolvedCards: RuleEngineReadingResult["resolvedCards"];
  spread: {
    type: RuleEngineReadingResult["spread"]["type"];
    spreadSize: RuleEngineReadingResult["spread"]["spreadSize"];
    forwardChain: RuleEngineReadingResult["spread"]["forwardChain"];
    semanticFrame: RuleEngineReadingResult["spread"]["semanticFrame"];
    conflicts?: RuleEngineReadingResult["spread"]["conflicts"];
    warnings?: RuleEngineReadingResult["spread"]["warnings"];
  };
  synthesis: Omit<RuleEngineReadingResult["synthesis"], "debugTrace">;
  tempo: Omit<RuleEngineReadingResult["tempo"], "debugTrace">;
  answer: Omit<RuleEngineReadingResult["answer"], "debugTrace">;
  rendered: RuleEngineReadingResult["rendered"];
  interpretationPlan: RuleEngineReadingResult["interpretationPlan"];
  verbalization?: {
    source: "ai" | "deterministic_fallback";
    attempts: number;
    validationIssues?: string[];
  };
  versions: RuleEngineReadingResult["metadata"];
};

export function generateRuleEngineReading(input: {
  question: string;
  cards: ProductionReadingCard[];
  spreadType: ProductionSpreadType;
  verbalizedResult?: DeepReadingResult;
  verbalization?: RuleEnginePersistenceResult["verbalization"];
}): ProductionRuleEngineResult {
  const spreadSize = spreadSizeForSpreadType(input.spreadType);
  const result = runRuleEngineReading({
    question: input.question,
    cardIds: cardIdsFromReadingCards(input.cards),
    spreadSize: spreadSize as 3 | 5,
    rendererStyle: "standard"
  });

  return {
    deepReadingResult: input.verbalizedResult ?? mapRuleEngineRenderedOutput(result),
    ruleEngineResult: toRuleEnginePersistenceResult(result, input.verbalization),
    ruleEngineVersion: result.metadata.engineVersion,
    ruleEngineSchemaVersion: result.metadata.schemaVersion
  };
}

export function cardIdsFromReadingCards(cards: ProductionReadingCard[]) {
  return [...cards].sort((a, b) => a.cardNumber - b.cardNumber).map((card) => cardNumberFromStoredCard(card.cardSlug, card.nameEn, card.nameZh));
}

export function mapRuleEngineRenderedOutput(result: RuleEngineReadingResult): DeepReadingResult {
  return {
    core_conclusion: result.rendered.answerLead || result.rendered.headline || result.synthesis.conclusion.summary,
    interpretation: [result.rendered.body, result.rendered.conclusion].filter(Boolean).join("\n\n"),
    time_window: result.rendered.timingNote ?? null,
    uncertainty: [
      result.rendered.safetyNote,
      ...(result.answer.uncertainty ?? []).map((item) => unresolvedPhrase(item.type, item.concept)),
      ...(result.answer.conditions ?? []).map((item) => conditionPhrase(item.concept))
    ]
      .filter(Boolean)
      .join("；")
  };
}

export function toRuleEnginePersistenceResult(result: RuleEngineReadingResult, verbalization?: RuleEnginePersistenceResult["verbalization"]): RuleEnginePersistenceResult {
  const { debugTrace: synthesisDebugTrace, ...synthesis } = result.synthesis;
  const { debugTrace: tempoDebugTrace, ...tempo } = result.tempo;
  const { debugTrace: answerDebugTrace, ...answer } = result.answer;
  return {
    questionContext: result.questionContext,
    resolvedCards: result.resolvedCards,
    spread: {
      type: result.spread.type,
      spreadSize: result.spread.spreadSize,
      forwardChain: result.spread.forwardChain,
      semanticFrame: result.spread.semanticFrame,
      conflicts: result.spread.conflicts,
      warnings: result.spread.warnings
    },
    synthesis,
    tempo,
    answer,
    rendered: result.rendered,
    interpretationPlan: result.interpretationPlan,
    verbalization,
    versions: result.metadata
  };
}

export function ruleEngineFailureCode(error: unknown) {
  if (error instanceof RuleEngineError) return `RULE_ENGINE_${error.code}`;
  return "RULE_ENGINE_GENERATION_FAILED";
}

function cardNumberFromStoredCard(slug: string, nameEn: string, nameZh: string) {
  const card = findStoredCard(slug, nameEn, nameZh);
  if (!card) throw new Error(`Unsupported Lenormand card: ${slug || nameEn || nameZh}`);
  return card.number;
}

function findStoredCard(slug: string, nameEn: string, nameZh: string): LenormandCard | undefined {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedNameEn = nameEn.trim().toLowerCase();
  return lenormandCards.find((card) => card.slug === normalizedSlug || card.nameEn.toLowerCase() === normalizedNameEn || card.nameZh === nameZh.trim());
}
