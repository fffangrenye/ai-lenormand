import { resolveBasicAnswer } from "./basic-answer-resolver";
import { resolvePairPipeline } from "./final-resolution";
import { renderFinalReading } from "./final-renderer";
import { getCardLexiconEntry } from "./lexicon";
import { QuestionContext } from "./ontology";
import { parseQuestionContext } from "./parser";
import { PairInput, PairInterpretation, ResolvedCardMeaning } from "./pair-types";
import { preselectCardMeaning } from "./preselection";
import { PreselectedCardMeaning } from "./preselection-types";
import { buildSpreadStructure } from "./spread-protocol";
import { SpreadStructure } from "./spread-types";
import { synthesizeWholeLine } from "./whole-line-synthesis";
import { evaluateTempoCompatibility } from "./tempo-compatibility";
import { SynthesisResult } from "./synthesis-types";
import { TempoCompatibilityResult } from "./tempo-types";
import { BasicAnswerResolution } from "./answer-types";
import { RenderedReading, RendererStyle } from "./renderer-types";
import { RULE_ENGINE_SCHEMA_VERSION, RULE_ENGINE_VERSION } from "./rule-engine-version";
import { RuleEngineError } from "./rule-engine-errors";
import { buildInterpretationPlan, InterpretationPlan } from "./interpretation-plan";

export type RuleEngineReadingInput = {
  question: string;
  cardIds: number[];
  spreadSize: 3 | 5;
  rendererStyle?: RendererStyle;
};

export type RuleEngineReadingResult = {
  questionContext: QuestionContext;
  preselection: PreselectedCardMeaning[];
  initialPairs: PairInterpretation[];
  resolvedCards: ResolvedCardMeaning[];
  refinedPairs: PairInterpretation[];
  spread: SpreadStructure;
  synthesis: SynthesisResult;
  tempo: TempoCompatibilityResult;
  answer: BasicAnswerResolution;
  rendered: RenderedReading;
  interpretationPlan: InterpretationPlan;
  refinementPasses: 0 | 1;
  metadata: {
    engineVersion: string;
    schemaVersion: string;
    source: "rule_engine";
    externalFallbackUsed: false;
  };
  engineVersion: string;
};

export function runRuleEngineReading(input: RuleEngineReadingInput): RuleEngineReadingResult {
  validatePipelineInput(input);
  const questionContext = stage("QUESTION_PARSE_FAILED", () => parseQuestionContext(input.question));
  const preselection = stage("PRESELECTION_FAILED", () => buildPreselection(questionContext, input.cardIds));
  const pairInputs = stage("PAIR_RESOLUTION_FAILED", () => buildPairInputs(questionContext, input.cardIds, preselection, input.spreadSize));
  const pairPipeline = stage("FINAL_RESOLUTION_FAILED", () => resolvePairPipeline(pairInputs));
  const spread = stage("SPREAD_FAILED", () =>
    buildSpreadStructure({
      question: questionContext,
      cards: input.cardIds,
      resolvedCards: pairPipeline.resolvedCards,
      adjacentPairs: pairPipeline.refinedPairs,
      spreadSize: input.spreadSize,
      preselectedCards: preselection
    })
  );
  const synthesis = stage("SYNTHESIS_FAILED", () =>
    synthesizeWholeLine({
      question: questionContext,
      resolvedCards: pairPipeline.resolvedCards,
      pairs: pairPipeline.refinedPairs,
      spread
    })
  );
  const tempo = stage("TEMPO_FAILED", () =>
    evaluateTempoCompatibility({
      question: questionContext,
      resolvedCards: pairPipeline.resolvedCards,
      spread,
      synthesis
    })
  );
  const answer = stage("ANSWER_FAILED", () => resolveBasicAnswer({ question: questionContext, synthesis, tempo }));
  const rendered = stage("RENDER_FAILED", () =>
    renderFinalReading({
      question: questionContext,
      synthesis,
      tempo,
      answer,
      style: input.rendererStyle ?? "standard"
    })
  );
  const interpretationPlan = stage("RENDER_FAILED", () =>
    buildInterpretationPlan({
      questionContext,
      preselection,
      initialPairs: pairPipeline.initialPairs,
      resolvedCards: pairPipeline.resolvedCards,
      refinedPairs: pairPipeline.refinedPairs,
      spread,
      synthesis,
      tempo,
      answer,
      rendered,
      refinementPasses: pairPipeline.refinementPasses,
      metadata: {
        engineVersion: RULE_ENGINE_VERSION,
        schemaVersion: RULE_ENGINE_SCHEMA_VERSION,
        source: "rule_engine",
        externalFallbackUsed: false
      },
      engineVersion: RULE_ENGINE_VERSION
    })
  );

  return {
    questionContext,
    preselection,
    initialPairs: pairPipeline.initialPairs,
    resolvedCards: pairPipeline.resolvedCards,
    refinedPairs: pairPipeline.refinedPairs,
    spread,
    synthesis,
    tempo,
    answer,
    rendered,
    interpretationPlan,
    refinementPasses: pairPipeline.refinementPasses,
    metadata: {
      engineVersion: RULE_ENGINE_VERSION,
      schemaVersion: RULE_ENGINE_SCHEMA_VERSION,
      source: "rule_engine",
      externalFallbackUsed: false
    },
    engineVersion: RULE_ENGINE_VERSION
  };
}

function validatePipelineInput(input: RuleEngineReadingInput) {
  if (input.spreadSize !== 3 && input.spreadSize !== 5) {
    throw new RuleEngineError("INVALID_SPREAD_SIZE", "Rule engine supports only 3-card and 5-card spreads.", { spreadSize: input.spreadSize });
  }
  if (typeof input.question !== "string" || !input.question.trim()) {
    throw new RuleEngineError("QUESTION_PARSE_FAILED", "Question must be a non-empty string.");
  }
  if (!Array.isArray(input.cardIds) || input.cardIds.length !== input.spreadSize) {
    throw new RuleEngineError("INVALID_CARD_IDS", `Expected exactly ${input.spreadSize} card ids.`, { cardIds: input.cardIds });
  }
  if (new Set(input.cardIds).size !== input.cardIds.length) {
    throw new RuleEngineError("INVALID_CARD_IDS", "Card ids must be unique.", { cardIds: input.cardIds });
  }
  for (const cardId of input.cardIds) {
    if (!Number.isInteger(cardId) || cardId < 1 || cardId > 36 || !getCardLexiconEntry(cardId)) {
      throw new RuleEngineError("INVALID_CARD_IDS", `Invalid Lenormand card id: ${String(cardId)}.`, { cardId });
    }
  }
}

function buildPreselection(question: QuestionContext, cardIds: number[]) {
  return cardIds.map((cardId) => {
    const card = getCardLexiconEntry(cardId);
    if (!card) throw new RuleEngineError("INVALID_CARD_IDS", `Invalid Lenormand card id: ${cardId}.`, { cardId });
    return preselectCardMeaning({ question, card }).meaning;
  });
}

function buildPairInputs(question: QuestionContext, cardIds: number[], preselection: PreselectedCardMeaning[], spreadSize: 3 | 5): PairInput[] {
  const inputs: PairInput[] = [];
  for (let index = 0; index < cardIds.length - 1; index += 1) {
    const leftCard = getCardLexiconEntry(cardIds[index]);
    const rightCard = getCardLexiconEntry(cardIds[index + 1]);
    const left = preselection.find((item) => item.cardId === cardIds[index]);
    const right = preselection.find((item) => item.cardId === cardIds[index + 1]);
    if (!leftCard || !rightCard || !left || !right) {
      throw new RuleEngineError("PAIR_RESOLUTION_FAILED", "Cannot build ordered pair input.", { index });
    }
    inputs.push({ left, right, leftCard, rightCard, question, pairIndex: index, spreadSize });
  }
  return inputs;
}

function stage<T>(code: RuleEngineError["code"], fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RuleEngineError) throw error;
    throw new RuleEngineError(code, error instanceof Error ? error.message : "Rule engine stage failed.", error);
  }
}
