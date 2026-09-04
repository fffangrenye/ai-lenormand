import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinalCardMeanings } from "../final-resolution";
import { getCardLexiconEntry } from "../lexicon";
import { HorizonClass, QuestionContext, Timeframe } from "../ontology";
import { parseQuestionContext } from "../parser";
import { PairInput, PairInterpretation } from "../pair-types";
import { resolveOrderedPair } from "../pair-engine";
import { preselectCardMeaning } from "../preselection";
import { PreselectedCardMeaning } from "../preselection-types";
import { buildSpreadStructure } from "../spread-protocol";
import { SynthesisResult, WholeLineSynthesisInput } from "../synthesis-types";
import { synthesizeWholeLine } from "../whole-line-synthesis";
import { evaluateTempoCompatibility } from "../tempo-compatibility";
import { validateTempoCompatibilityResult } from "../tempo-schema";
import { TempoCompatibilityResult } from "../tempo-types";

function context(question: string, patch: Partial<QuestionContext> = {}): QuestionContext {
  const base = parseQuestionContext(question);
  return {
    ...base,
    ...patch,
    object: patch.object ?? base.object,
    timeframe: patch.timeframe ?? base.timeframe,
    people: patch.people ?? base.people
  };
}

function timeframe(horizonClass: HorizonClass, value?: number, unit: Timeframe["unit"] = "day"): Timeframe {
  return value
    ? { scope: "explicit", relation: "within", value, unit, anchor: "now", precision: "bounded", normalized: { horizonClass } }
    : { scope: "open", precision: "unspecified", normalized: { horizonClass } };
}

function build(question: QuestionContext, cards: number[]) {
  const preselectedCards = cards.map((cardId) => {
    const card = getCardLexiconEntry(cardId);
    assert.ok(card, `Missing card ${cardId}`);
    return preselectCardMeaning({ question, card }).meaning;
  });
  const pairs: PairInterpretation[] = [];
  for (let index = 0; index < cards.length - 1; index += 1) {
    pairs.push(resolveOrderedPair(pairInput(question, cards[index], cards[index + 1], preselectedCards, index, cards.length as 3 | 5)));
  }
  const resolvedCards = resolveFinalCardMeanings({ preselected: preselectedCards, pairInterpretations: pairs });
  const spread = buildSpreadStructure({ question, cards, resolvedCards, adjacentPairs: pairs, spreadSize: cards.length as 3 | 5, preselectedCards });
  const synthesisInput: WholeLineSynthesisInput = { question, resolvedCards, pairs, spread };
  const synthesis: SynthesisResult = synthesizeWholeLine(synthesisInput);
  const tempo = evaluateTempoCompatibility({ question, resolvedCards, spread, synthesis });
  const validation = validateTempoCompatibilityResult(tempo);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return { spread, synthesis, tempo };
}

function pairInput(question: QuestionContext, leftId: number, rightId: number, preselected: PreselectedCardMeaning[], pairIndex: number, spreadSize: 3 | 5): PairInput {
  const leftCard = getCardLexiconEntry(leftId);
  const rightCard = getCardLexiconEntry(rightId);
  assert.ok(leftCard);
  assert.ok(rightCard);
  const left = preselected.find((item) => item.cardId === leftId);
  const right = preselected.find((item) => item.cardId === rightId);
  assert.ok(left);
  assert.ok(right);
  return { left, right, leftCard, rightCard, question, pairIndex, spreadSize };
}

function noAnswerResolver(result: TempoCompatibilityResult) {
  const text = JSON.stringify(result);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "answer"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "probability"), false);
  assert.equal(/\d+天后|周[一二三四五六日天]|月\d+日/.test(text), false);
}

test("Rider Letter Key in a three-day message question is fast or soon without Key auto-yes", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const { tempo } = build(q, [1, 27, 33]);

  assert.ok(["fast", "soon"].includes(tempo.dominantTempo));
  assert.equal(tempo.compatibilityTarget, "semantic_process");
  assert.ok(["well_matched", "possible"].includes(tempo.compatibility));
  assert.ok(tempo.tempoEvidence.some((item) => item.sourceType === "semantic_mode" && item.reasonCode === "SEMANTIC_MODE_TEMPO_OVERRIDE"));
  assert.equal(tempo.timeframe.normalized?.horizonClass, "short");
  noAnswerResolver(tempo);
});

test("Tree Anchor Ring strains a three-day stabilization window but does not answer no", () => {
  const q = context("三天内会稳定下来吗？", {
    domain: "relationship",
    primaryTopic: "commitment",
    intent: "outcome",
    object: { type: "relationship", label: "关系稳定" },
    answerMode: "yes_no"
  });
  const { tempo } = build(q, [5, 35, 25]);

  assert.ok(["slow", "very_slow", "stationary"].includes(tempo.dominantTempo));
  assert.ok(["persistent", "fixed", "extended"].includes(tempo.dominantDuration));
  assert.ok(["strained", "mismatched"].includes(tempo.compatibility));
  assert.ok(tempo.conditions?.some((condition) => condition.type === "timeframe_tight"));
  noAnswerResolver(tempo);
});

test("Mountain Coffin Sun uses transition activation instead of Mountain-only very slow", () => {
  const q = context("一个月内这个问题会有变化吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    intent: "outcome",
    object: { type: "event", label: "这个问题" },
    answerMode: "yes_no"
  });
  const { synthesis, tempo } = build(q, [21, 8, 31]);

  assert.ok(synthesis.keyTransitions.some((transition) => transition.type === "end"));
  assert.ok(synthesis.keyTransitions.some((transition) => transition.type === "change"));
  assert.notEqual(tempo.dominantTempo, "very_slow");
  assert.equal(tempo.processAdjustment?.type, "transition_activated");
  assert.equal(tempo.compatibility, "possible");
});

test("Heart Clouds Ring stays uncertain or variable and Ring persistence does not become a slow answer", () => {
  const q = context("一周内关系会明确吗？", {
    domain: "relationship",
    primaryTopic: "development",
    intent: "outcome",
    object: { type: "relationship", label: "关系" },
    answerMode: "yes_no"
  });
  const { tempo } = build(q, [24, 6, 25]);

  assert.ok(["variable", "moderate"].includes(tempo.dominantTempo));
  assert.notEqual(tempo.dominantTempo, "slow");
  assert.ok(["possible", "strained"].includes(tempo.compatibility));
  assert.ok(tempo.conditions?.some((condition) => condition.type === "mixed_tempo") || tempo.tempoEvidence.some((item) => item.reasonCode === "MAIN_PROCESS_UNCERTAIN"));
});

test("Scythe Letter Rider with immediate horizon is sudden or fast and never exact dating", () => {
  const q = context("今天会突然收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no",
    timeframe: timeframe("immediate", 1, "day")
  });
  const { tempo } = build(q, [10, 27, 1]);

  assert.ok(["sudden", "fast"].includes(tempo.dominantTempo));
  assert.equal(tempo.compatibility, "well_matched");
  assert.ok(tempo.warnings?.some((warning) => warning.type === "sudden_not_soon") || tempo.tempoEvidence.some((item) => item.tempo === "fast"));
  noAnswerResolver(tempo);
});

test("Book Tree Anchor strains a one-week progress window with slow persistent process", () => {
  const q = context("一周内能有明显进展吗？", {
    domain: "study",
    primaryTopic: "academic_project",
    intent: "outcome",
    object: { type: "project", label: "进展" },
    answerMode: "yes_no"
  });
  const { synthesis, tempo } = build(q, [26, 5, 35]);

  assert.ok(["slow", "very_slow", "stationary"].includes(tempo.dominantTempo));
  assert.ok(["persistent", "extended", "fixed"].includes(tempo.dominantDuration));
  assert.equal(tempo.compatibility, "strained");
  assert.ok(tempo.warnings?.some((warning) => warning.type === "slow_not_no"));
  assert.notEqual(synthesis.coreTheme.label, "project revision / repeated editing");
  assert.equal(JSON.stringify(synthesis).includes("editing_revision_research"), false);
  assert.equal(JSON.stringify(synthesis).includes("Whip"), false);
  assert.equal(JSON.stringify(synthesis).includes("Child"), false);
  assert.equal(JSON.stringify(synthesis).includes("Garden"), false);
});

test("Clover Birds Rider fits a two-day contact horizon", () => {
  const q = context("这两天会有联系吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "联系" },
    answerMode: "yes_no"
  });
  const { tempo } = build(q, [2, 12, 1]);

  assert.equal(tempo.timeframe.normalized?.horizonClass, "immediate");
  assert.ok(["immediate", "fast"].includes(tempo.dominantTempo));
  assert.equal(tempo.compatibility, "well_matched");
  assert.ok(tempo.durationEvidence.some((item) => item.duration === "brief" || item.duration === "short"));
});

test("Mountain Anchor Tree across an extended horizon is possible, not never", () => {
  const q = context("半年内这个状态会不会改变？", {
    domain: "general",
    primaryTopic: "general_development",
    intent: "outcome",
    object: { type: "event", label: "这个状态" },
    answerMode: "yes_no",
    timeframe: timeframe("extended", 6, "month")
  });
  const { synthesis, tempo } = build(q, [21, 35, 5]);

  assert.ok(["very_slow", "stationary", "slow"].includes(tempo.dominantTempo));
  assert.ok(["well_matched", "possible"].includes(tempo.compatibility));
  assert.ok(tempo.warnings?.some((warning) => warning.type === "blocked_not_never" || warning.type === "slow_not_no"));
  assert.notEqual(synthesis.coreTheme.label, "trust and bond persistence");
  assert.equal(JSON.stringify(synthesis).includes("loyalty_trust"), false);
  assert.equal(JSON.stringify(synthesis).includes("commitment_bond"), false);
  assert.equal(JSON.stringify(synthesis).includes("love_affection"), false);
  noAnswerResolver(tempo);
});

test("open timeframe remains unknown while still reporting tempo and duration", () => {
  const q = context("这段关系接下来会怎么发展？", {
    domain: "relationship",
    primaryTopic: "development",
    intent: "development",
    object: { type: "relationship", label: "这段关系" },
    answerMode: "open"
  });
  const { tempo } = build(q, [24, 25, 6, 27, 33]);

  assert.equal(tempo.timeframe.normalized?.horizonClass, "open");
  assert.equal(tempo.compatibility, "unknown");
  assert.notEqual(tempo.dominantTempo, "unknown");
  assert.ok(tempo.conditions?.some((condition) => condition.type === "open_timeframe"));
});

test("timing intent reports broad pace only and no exact date", () => {
  const q = context("什么时候联系？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "timing",
    object: { type: "message", label: "联系" },
    answerMode: "open"
  });
  const { tempo } = build(q, [1, 12, 27]);

  assert.equal(tempo.compatibility, "unknown");
  assert.ok(["fast", "soon"].includes(tempo.dominantTempo));
  assert.ok(tempo.conditions?.some((condition) => condition.type === "timing_intent"));
  assert.ok(tempo.warnings?.some((warning) => warning.type === "timing_intent_not_exact_date"));
  noAnswerResolver(tempo);
});

test("tempo compatibility is deterministic", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const baseline = JSON.stringify(build(q, [1, 27, 33]).tempo);
  for (let index = 0; index < 50; index += 1) {
    assert.equal(JSON.stringify(build(q, [1, 27, 33]).tempo), baseline);
  }
});

test("Phase 7.1 frozen tempo baselines are restored before semantic overrides", () => {
  const q = context("这个状态后续如何？", {
    domain: "general",
    primaryTopic: "general_development",
    intent: "development",
    object: { type: "event", label: "这个状态" }
  });
  const { tempo: letterTempo } = build(q, [27, 24, 33]);
  const { tempo: treeTempo } = build(q, [26, 5, 33]);
  const { tempo: mountainTempo } = build(q, [21, 8, 31]);

  assert.ok(letterTempo.tempoEvidence.some((item) => item.sourceRef === "CARD_27" && item.tempo === "soon"));
  assert.ok(treeTempo.tempoEvidence.some((item) => item.sourceRef === "CARD_5" && item.tempo === "slow"));
  assert.ok(mountainTempo.tempoEvidence.some((item) => item.sourceRef === "CARD_21" && item.tempo === "stationary"));
});

test("Phase 7.1 stabilize transition is slow with persistent duration, not cyclical tempo", () => {
  const q = context("一周内能有明显进展吗？", {
    domain: "study",
    primaryTopic: "academic_project",
    intent: "outcome",
    object: { type: "project", label: "进展" },
    answerMode: "yes_no"
  });
  const { tempo } = build(q, [26, 5, 35]);

  const stabilizeTempo = tempo.tempoEvidence.filter((item) => item.reasonCode === "TRANSITION_STABILIZE");
  assert.ok(stabilizeTempo.length >= 1);
  assert.equal(stabilizeTempo.every((item) => item.tempo !== "cyclical"), true);
  assert.equal(stabilizeTempo.every((item) => item.tempo === "slow"), true);
  assert.ok(tempo.durationEvidence.some((item) => item.reasonCode === "TRANSITION_STABILIZE_DURATION" && item.duration === "persistent"));
});

test("Phase 7.1 sequential synthesis and tempo runs are isolated across fixtures", () => {
  const a = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const b = context("一周内能有明显进展吗？", {
    domain: "study",
    primaryTopic: "academic_project",
    intent: "outcome",
    object: { type: "project", label: "进展" },
    answerMode: "yes_no"
  });
  const c = context("半年内这个状态会不会改变？", {
    domain: "general",
    primaryTopic: "general_development",
    intent: "outcome",
    object: { type: "event", label: "这个状态" },
    answerMode: "yes_no",
    timeframe: timeframe("extended", 6, "month")
  });

  const firstA = build(a, [1, 27, 33]);
  const resultB = build(b, [26, 5, 35]);
  const resultC = build(c, [21, 35, 5]);
  const secondA = build(a, [1, 27, 33]);

  assert.equal(JSON.stringify(firstA.synthesis), JSON.stringify(secondA.synthesis));
  assert.equal(JSON.stringify(firstA.tempo), JSON.stringify(secondA.tempo));
  assert.equal(resultB.synthesis.coreTheme.label.includes("project revision / repeated editing"), false);
  assert.equal(JSON.stringify(resultB.synthesis).includes("editing_revision_research"), false);
  assert.equal(JSON.stringify(resultC.synthesis).includes("trust and bond persistence"), false);
  assert.equal(JSON.stringify(resultC.synthesis).includes("commitment_bond"), false);
  assert.notEqual(resultB.synthesis.coreTheme.label, resultC.synthesis.coreTheme.label);
});
