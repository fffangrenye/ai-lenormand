import assert from "node:assert/strict";
import test from "node:test";
import { resolveBasicAnswer } from "../basic-answer-resolver";
import { validateRenderedReading } from "../renderer-schema";
import { renderFinalReading } from "../final-renderer";
import { resolveFinalCardMeanings } from "../final-resolution";
import { getCardLexiconEntry } from "../lexicon";
import { HorizonClass, QuestionContext, Timeframe } from "../ontology";
import { parseQuestionContext } from "../parser";
import { PairInput, PairInterpretation } from "../pair-types";
import { resolveOrderedPair } from "../pair-engine";
import { preselectCardMeaning } from "../preselection";
import { PreselectedCardMeaning } from "../preselection-types";
import { buildSpreadStructure } from "../spread-protocol";
import { synthesizeWholeLine } from "../whole-line-synthesis";
import { evaluateTempoCompatibility } from "../tempo-compatibility";
import { RendererStyle, rendererStyles } from "../renderer-types";
import { BasicAnswerResolution } from "../answer-types";
import { SynthesisResult } from "../synthesis-types";

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

function build(question: QuestionContext, cards: number[], style: RendererStyle = "standard") {
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
  const synthesis = synthesizeWholeLine({ question, resolvedCards, pairs, spread });
  const tempo = evaluateTempoCompatibility({ question, resolvedCards, spread, synthesis });
  const answer = resolveBasicAnswer({ question, synthesis, tempo });
  const reading = renderFinalReading({ question, synthesis, tempo, answer, style });
  const validation = validateRenderedReading(reading);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return { synthesis, tempo, answer, reading };
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

function textOf(value: unknown) {
  return JSON.stringify(value);
}

function assertNoForbiddenText(text: string) {
  assert.equal(/YES|NO|百分百|100%|一定|绝对|永远不会|他肯定|牌明确证实|宇宙告诉你|命运注定|灵魂契约|高维能量|显化|\d+%|internalScore|score=\d/.test(text), false);
  assert.equal(/\d+天后|周[一二三四五六日天]|月\d+日/.test(text), false);
}

function visibleText(reading: ReturnType<typeof renderFinalReading>) {
  return [
    reading.headline,
    reading.answerLead,
    reading.body,
    reading.conclusion,
    reading.timingNote,
    reading.safetyNote,
    reading.learningDetails?.synthesisReasoning,
    ...(reading.learningDetails?.pairExplanations?.map((item) => item.explanation) ?? []),
    ...(reading.learningDetails?.mirrorExplanations?.map((item) => item.explanation) ?? [])
  ].filter(Boolean).join("\n");
}

function assertNoInternalTokens(reading: ReturnType<typeof renderFinalReading>) {
  const text = visibleText(reading);
  assert.doesNotMatch(
    text,
    /attraction_passion|attraction passion|uncertainty|commitment_bond|pair_unresolved|high_ambiguity|some pair modes remain close alternatives|OVERRIDE_|PAIR_|CARD_|TRANSITION_|internalScore/
  );
  assert.doesNotMatch(text, /\b(?:[a-z]+_){1,}[a-z0-9]+\b/);
  assert.doesNotMatch(text, /\b[a-z]+(?:-[a-z0-9]+)+\b/);
  assert.doesNotMatch(text, /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/);
  assert.doesNotMatch(text, /\b[A-Z]{2,}_[A-Z0-9_]+\b/);
}

test("standard feelings rendering preserves uncertainty without upgrading to commitment", () => {
  const q = context("他喜欢我吗？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    intent: "feelings_attitude",
    object: { type: "person", label: "他" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [24, 6, 25]);
  const text = textOf(reading);

  assert.ok(reading.answerLead);
  assert.ok(text.includes("感情") || text.includes("吸引"));
  assert.ok(text.includes("不确定") || text.includes("不够清楚") || text.includes("定义"));
  assert.equal(text.includes("确定关系"), false);
  assert.equal(text.includes("婚姻"), false);
  assertNoForbiddenText(text);
});

test("action rendering does not turn feeling or bond into contact", () => {
  const q = context("他会主动联系我吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "action",
    object: { type: "message", label: "联系" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [24, 25, 35]);
  const text = textOf(reading);

  assert.ok(reading.answerLead?.includes("支持力度偏弱") || reading.answerLead?.includes("不能形成明确结论") || reading.answerLead?.includes("有条件"));
  assert.equal(text.includes("所以会联系"), false);
  assert.equal(text.includes("因为他有感情，所以会联系"), false);
  assertNoForbiddenText(text);
});

test("reconciliation rendering keeps contact separate from getting back together", () => {
  const q = context("我们会复合吗？", {
    domain: "relationship",
    primaryTopic: "reconciliation",
    intent: "outcome",
    object: { type: "relationship", label: "我们会复合吗？" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [1, 27, 12], "learning");
  const text = textOf(reading);

  assert.ok(text.includes("联系") || text.includes("沟通"));
  assert.ok(text.includes("不能直接升级") || text.includes("不能直接等同"));
  assert.equal(text.includes("复合得到支持"), false);
  assert.ok(reading.learningDetails?.synthesisReasoning);
  assertNoForbiddenText(text);
});

test("outcome rendering supports obstacle-ending process without Sun yes shortcut", () => {
  const q = context("这个问题能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    intent: "outcome",
    object: { type: "event", label: "这个问题能解决吗？" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [21, 8, 31]);
  const text = textOf(reading);

  assert.ok(text.includes("阻碍") && (text.includes("收束") || text.includes("更清楚")));
  assert.equal(text.includes("Sun=Yes"), false);
  assert.equal(text.includes("太阳牌说明是"), false);
  assertNoForbiddenText(text);
});

test("time-bound message rendering shows matched window without certainty", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [1, 27, 33]);
  const text = textOf(reading);

  assert.ok(reading.answerLead?.includes("支持"));
  assert.ok(reading.timingNote?.includes("匹配"));
  assert.equal(text.includes("会发生"), false);
  assert.equal(text.includes("Key=Yes"), false);
  assertNoForbiddenText(text);
});

test("slow short-window rendering qualifies timing without writing no", () => {
  const q = context("一周内能有明显进展吗？", {
    domain: "study",
    primaryTopic: "academic_project",
    intent: "outcome",
    object: { type: "project", label: "进展" },
    answerMode: "yes_no"
  });
  const { reading } = build(q, [26, 5, 35]);
  const text = textOf(reading);

  assert.ok(reading.timingNote?.includes("时间窗口比较紧"));
  assert.ok(text.includes("偏慢") || text.includes("固定") || text.includes("长期"));
  assert.equal(text.includes("不会"), false);
  assertNoForbiddenText(text);
});

test("well-matched tempo does not render change proposition as supported", () => {
  const q = context("半年内这个状态会不会改变？", {
    domain: "general",
    primaryTopic: "general_development",
    intent: "outcome",
    object: { type: "event", label: "这个状态会不会改变" },
    answerMode: "yes_no",
    timeframe: timeframe("extended", 6, "month")
  });
  const { answer, tempo, reading } = build(q, [21, 35, 5]);
  const text = textOf(reading);

  assert.equal(tempo.compatibility, "well_matched");
  assert.ok(["not_supported", "weakly_supported"].includes(answer.resolution));
  assert.ok(reading.answerLead?.includes("不支持") || reading.answerLead?.includes("支持力度偏弱"));
  assert.equal(text.includes("改变得到支持"), false);
  assertNoForbiddenText(text);
});

test("open development standard rendering has no direct yes/no answer", () => {
  const q = context("这段关系接下来怎么发展？", {
    domain: "relationship",
    primaryTopic: "development",
    intent: "development",
    object: { type: "relationship", label: "这段关系" },
    answerMode: "open"
  });
  const { reading } = build(q, [24, 25, 6, 27, 33]);
  const text = textOf(reading);

  assert.equal(reading.answerLead, undefined);
  assert.equal(reading.timingNote, undefined);
  assert.ok(text.includes("不确定") || text.includes("沟通") || text.includes("清楚"));
  assertNoForbiddenText(text);
});

test("concise, standard, and learning styles are valid and distinct", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const concise = build(q, [1, 27, 33], "concise").reading;
  const standard = build(q, [1, 27, 33], "standard").reading;
  const learning = build(q, [1, 27, 33], "learning").reading;

  assert.equal(concise.style, "concise");
  assert.equal(standard.style, "standard");
  assert.equal(learning.style, "learning");
  assert.ok(concise.body.length <= standard.body.length);
  assert.ok(learning.learningDetails);
  assert.equal(standard.metadata.source, "rule_engine");
});

test("safety rendering blocks third-party and pregnancy factual claims", () => {
  const thirdParty = build(context("他是不是有第三方？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    intent: "state",
    object: { type: "person", label: "第三方" },
    answerMode: "yes_no"
  }), [7, 20, 22]).reading;
  assert.ok(thirdParty.safetyNote?.includes("不能据此确认第三者"));
  assert.equal(textOf(thirdParty).includes("他有第三者"), false);

  const pregnancy = build(context("我会怀孕吗？", {
    domain: "family",
    primaryTopic: "children",
    intent: "outcome",
    object: { type: "event", label: "怀孕" },
    answerMode: "yes_no"
  }), [17, 13, 24]).reading;
  assert.ok(pregnancy.safetyNote?.includes("不能替代实际检测"));
  assert.equal(textOf(pregnancy).includes("你怀孕了"), false);
});

test("renderer output is deterministic", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const baseline = textOf(build(q, [1, 27, 33], "learning").reading);
  for (let index = 0; index < 50; index += 1) {
    assert.equal(textOf(build(q, [1, 27, 33], "learning").reading), baseline);
  }
});

test("Stage 1.1 smoke fixture renders Heart Clouds Ring without internal semantic labels", () => {
  const q = context("他对我是什么感觉？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    intent: "feelings_attitude",
    object: { type: "person", label: "他" },
    answerMode: "open"
  });

  for (const style of rendererStyles) {
    const { reading } = build(q, [24, 6, 25], style);
    const text = visibleText(reading);

    assertNoInternalTokens(reading);
    assert.ok(text.includes("吸引") || text.includes("感情"));
    assert.ok(text.includes("不确定") || text.includes("不够清楚") || text.includes("不明确"));
    assert.ok(text.includes("关系") && (text.includes("定义") || text.includes("承诺") || text.includes("绑定")));
    assert.equal(text.includes("明确承诺"), false);
    assert.equal(text.includes("主动联系"), false);
  }
});

test("Stage 1.1 unknown internal codes fail closed in user-facing renderer output", () => {
  const q = context("这件事怎么看？", {
    domain: "general",
    primaryTopic: "general_state",
    intent: "description",
    object: { type: "event", label: "这件事" },
    answerMode: "open"
  });
  const synthesis: SynthesisResult = {
    coreTheme: {
      label: "SOME_NEW_INTERNAL_THEME",
      primaryCardId: 1,
      primaryModeIds: ["UNKNOWN_MODE_CODE"],
      supportingCardIds: [2],
      evidenceCodes: ["CARD_01_INTERNAL"],
      confidence: "medium"
    },
    mainProcess: "uncertain",
    narrativeUnits: [],
    keyTransitions: [
      {
        type: "communicate",
        fromConcept: "UNKNOWN_fromConceptCode",
        toConcept: "SOME_NEW_SEMANTIC_MODE",
        cardIds: [1, 2],
        evidenceCodes: ["TRANSITION_X"],
        confidence: "medium"
      }
    ],
    conditions: [
      {
        type: "other",
        concept: "SOME_NEW_INTERNAL_CONDITION",
        cardIds: [2],
        evidenceCodes: ["PAIR_12"],
        confidence: "medium"
      }
    ],
    closingState: { type: "unclear", cardIds: [3], evidence: ["CARD_03"], confidence: "medium" },
    conclusion: {
      type: "description",
      summary: "SOME_NEW_INTERNAL_SUMMARY",
      summaryConcepts: ["SOME_NEW_INTERNAL_SUMMARY"],
      support: "unclear",
      conditions: ["SOME_NEW_INTERNAL_CONDITION"],
      unresolved: true,
      evidenceCardIds: [1, 2, 3]
    },
    unresolvedPoints: [
      {
        type: "high_ambiguity",
        concept: "some pair modes remain close alternatives",
        cardIds: [1, 2],
        evidenceCodes: ["OVERRIDE_DEBUG"],
        confidence: "medium"
      }
    ],
    confidence: "medium",
    engineVersion: "test"
  };
  const answer: BasicAnswerResolution = {
    answerMode: "open",
    proposition: { propositionType: "description", source: "intent" },
    resolution: "not_applicable",
    semanticSupport: { propositionMatched: false, supportingConcepts: [], opposingConcepts: [], semanticDirection: "insufficient" },
    supportEvidence: [],
    opposingEvidence: [],
    conditions: [{ type: "other", concept: "SOME_NEW_INTERNAL_CONDITION", importance: "primary" }],
    uncertainty: [{ type: "semantic_ambiguity", concept: "UNKNOWN_UNRESOLVED_REASON", severity: "medium" }],
    explanationCode: "TEST_INTERNAL_CODE",
    confidence: "medium",
    engineVersion: "test"
  };

  for (const style of rendererStyles) {
    const reading = renderFinalReading({ question: q, synthesis, answer, style });
    const text = visibleText(reading);

    assertNoInternalTokens(reading);
    assert.doesNotMatch(text, /SOME_NEW_INTERNAL|UNKNOWN_|fromConceptCode|OVERRIDE_DEBUG|TRANSITION_X|PAIR_12|CARD_03|TEST_INTERNAL_CODE/);
    assert.ok(text.includes("当前主题") || text.includes("未定因素") || text.includes("不确定"));
  }
});
