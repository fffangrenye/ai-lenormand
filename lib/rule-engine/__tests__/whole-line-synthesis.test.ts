import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinalCardMeanings } from "../final-resolution";
import { getCardLexiconEntry } from "../lexicon";
import { QuestionContext } from "../ontology";
import { parseQuestionContext } from "../parser";
import { PairInput, PairInterpretation } from "../pair-types";
import { preselectCardMeaning } from "../preselection";
import { PreselectedCardMeaning } from "../preselection-types";
import { resolveOrderedPair } from "../pair-engine";
import { buildSpreadStructure } from "../spread-protocol";
import { validateSynthesisResult } from "../synthesis-schema";
import { SynthesisResult, WholeLineSynthesisInput } from "../synthesis-types";
import { synthesizeWholeLine } from "../whole-line-synthesis";

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

function buildInput(question: QuestionContext, cards: number[]): WholeLineSynthesisInput {
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
  return { question, resolvedCards, pairs, spread };
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

function synth(question: QuestionContext, cards: number[]): SynthesisResult {
  const result = synthesizeWholeLine(buildInput(question, cards));
  const validation = validateSynthesisResult(result);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return result;
}

function concepts(result: SynthesisResult) {
  return JSON.stringify({
    core: result.coreTheme,
    units: result.narrativeUnits,
    transitions: result.keyTransitions,
    conditions: result.conditions,
    conclusion: result.conclusion,
    safetyFlags: result.safetyFlags
  });
}

test("three-card feelings synthesis keeps uncertainty without automatic commitment or answer resolving", () => {
  const result = synth(
    context("他对我是什么感觉？", {
      domain: "relationship",
      primaryTopic: "feelings_attraction",
      intent: "feelings_attitude",
      object: { type: "relationship", label: "relationship/person" },
      answerMode: "open"
    }),
    [24, 6, 25]
  );

  assert.equal(result.coreTheme.label, "uncertainty around feelings/relationship");
  assert.equal(result.mainProcess, "uncertain");
  assert.equal(result.closingState?.type, "open");
  assert.equal(result.conclusion.type, "state");
  assert.ok(result.conditions?.some((condition) => condition.concept === "relationship definition unclear"));
  assert.ok(result.narrativeUnits.length >= 2);
  assert.ok(result.narrativeUnits.length <= 4);
  assert.ok(!concepts(result).includes("automatic commitment"));
  assert.ok(!concepts(result).includes("marriage"));
  assert.ok(!["supports", "opposes"].includes(result.conclusion.support));
});

test("three-card obstacle synthesis uses Coffin-left sequence and avoids valence voting", () => {
  const result = synth(
    context("这个问题能解决吗？", {
      domain: "general",
      primaryTopic: "conflict_obstacle",
      intent: "outcome",
      object: { type: "event", label: "这个问题" },
      answerMode: "yes_no"
    }),
    [21, 8, 31]
  );

  assert.equal(result.coreTheme.label, "obstacle ending into clearer state");
  assert.equal(result.mainProcess, "improving");
  assert.equal(result.closingState?.type, "changed");
  assert.equal(result.conclusion.type, "result_tendency");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "end"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "change"));
  assert.ok(result.conclusion.summaryConcepts.includes("improving"));
  assert.ok(!concepts(result).includes("bad+bad+good"));
});

test("three-card erosion synthesis deduplicates emotional loss and prevents Anchor from becoming improvement", () => {
  const result = synth(
    context("这段感情会稳定吗？", {
      domain: "relationship",
      primaryTopic: "relationship_state",
      intent: "development",
      object: { type: "relationship", label: "这段感情" }
    }),
    [24, 23, 35]
  );

  assert.equal(result.coreTheme.label, "persistent emotional erosion");
  assert.equal(result.mainProcess, "eroding");
  assert.equal(result.conclusion.type, "trajectory");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "erode"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "stabilize"));
  assert.ok(!result.conclusion.summaryConcepts.includes("improving"));
  assert.equal(result.debugTrace?.removedDuplicates.some((item) => item.reason.includes("same theme")), true);
  assert.ok(result.narrativeUnits.length <= 4);
});

test("three-card study synthesis compresses project revision into reason framing", () => {
  const result = synth(
    context("我的论文为什么一直写不完？", {
      domain: "study",
      primaryTopic: "academic_project",
      intent: "reason",
      object: { type: "project", label: "论文" }
    }),
    [26, 11, 13]
  );

  assert.equal(result.coreTheme.label, "project revision / repeated editing");
  assert.equal(result.mainProcess, "repeating");
  assert.equal(result.conclusion.type, "cause");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "repeat"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "change" && transition.toConcept === "simplicity_reduction"));
  assert.ok(concepts(result).includes("simpl"));
  assert.ok(!concepts(result).includes("sexuality"));
  assert.ok(result.narrativeUnits.length <= 4);
});

test("five-card relationship synthesis keeps focus uncertainty and mirror as condition, not main chain", () => {
  const result = synth(
    context("这段关系接下来会怎么发展？", {
      domain: "relationship",
      primaryTopic: "development",
      intent: "development",
      object: { type: "relationship", label: "这段关系" },
      answerMode: "open"
    }),
    [24, 25, 6, 27, 33]
  );

  assert.equal(result.coreTheme.label, "uncertainty around feelings/relationship");
  assert.equal(result.mainProcess, "clarifying");
  assert.equal(result.closingState?.type, "confirmed");
  assert.equal(result.conclusion.type, "trajectory");
  assert.ok(result.conditions?.some((condition) => condition.concept === "relationship definition unclear"));
  assert.ok(result.conditions?.some((condition) => condition.concept.includes("mirror AE")));
  assert.ok(result.unresolvedPoints?.some((point) => point.type === "mirror_conflict"));
  assert.equal(result.debugTrace?.selectedMainProcess, "clarifying");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "hide" && transition.fromConcept === "commitment_bond" && transition.toConcept === "uncertainty"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "communicate" && transition.fromConcept === "uncertainty" && transition.toConcept === "written_message"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "confirm" && transition.fromConcept === "written_message" && transition.toConcept === "confirmation_certainty"));
  assert.ok(result.narrativeUnits.length <= 6);
});

test("five-card study synthesis keeps Whip focus and project audience chain", () => {
  const result = synth(
    context("我的论文现在最大的问题是什么？", {
      domain: "study",
      primaryTopic: "academic_project",
      intent: "obstacle",
      object: { type: "project", label: "论文" },
      answerMode: "open"
    }),
    [34, 26, 11, 13, 20]
  );

  assert.equal(result.coreTheme.label, "project revision / repeated editing");
  assert.equal(result.mainProcess, "repeating");
  assert.equal(result.closingState?.type, "open");
  assert.equal(result.conclusion.type, "condition");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "repeat"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "change" && transition.toConcept === "simplicity_reduction"));
  assert.ok(result.closingState?.evidence.includes("RELATION_PUBLICIZE"));
  assert.equal(result.conditions?.some((condition) => condition.concept === "information remains unclear") ?? false, false);
  assert.ok(!concepts(result).includes("money_finance"));
});

test("five-card stable bond synthesis separates trust, bond, maturity, and persistence from marriage or positivity guarantees", () => {
  const result = synth(
    context("我们这段关系会稳定发展吗？", {
      domain: "relationship",
      primaryTopic: "commitment",
      intent: "development",
      object: { type: "relationship", label: "这段关系" }
    }),
    [18, 24, 25, 30, 35]
  );

  assert.equal(result.coreTheme.label, "trust and bond persistence");
  assert.ok(["binding", "stabilizing"].includes(result.mainProcess));
  assert.equal(result.conclusion.type, "trajectory");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "bind"));
  assert.ok(!concepts(result).includes("marriage"));
  assert.ok(!concepts(result).includes("guarantee"));
});

test("spread ending survives whole-line synthesis when pair evidence is generic but supported", () => {
  const result = synth(
    context("最近一个月感情运势", {
      domain: "relationship",
      primaryTopic: "relationship_state",
      intent: "state",
      object: { type: "relationship", label: "感情运势" },
      answerMode: "open"
    }),
    [32, 13, 36, 29, 4]
  );

  assert.equal(result.debugTrace?.mergedUnits.some((unit) => unit.id === "spread-process" && unit.concept === "ending"), true);
  assert.equal(result.mainProcess, "ending");
  assert.notEqual(result.mainProcess, "none");
  assert.ok(result.keyTransitions.some((transition) => transition.type === "end"));
  assert.ok(result.keyTransitions.some((transition) => transition.type === "burden"));
});

test("career Moon can still select vocation or recognition after relationship affinity fix", () => {
  const result = synth(
    context("未来职业方向如何？", {
      domain: "career",
      primaryTopic: "career_direction",
      intent: "development",
      object: { type: "job", label: "职业方向" },
      answerMode: "open"
    }),
    [32, 16, 3]
  );

  const moon = buildInput(
    context("未来职业方向如何？", {
      domain: "career",
      primaryTopic: "career_direction",
      intent: "development",
      object: { type: "job", label: "职业方向" },
      answerMode: "open"
    }),
    [32, 16, 3]
  ).resolvedCards.find((card) => card.cardId === 32);
  assert.ok(["career_vocation", "recognition_reputation"].includes(moon?.primaryMode ?? ""));
  assert.notEqual(result.mainProcess, "none");
});

test("general burden household transition renders as concrete structure instead of none", () => {
  const result = synth(
    context("这个状态接下来会怎么变化？", {
      domain: "general",
      primaryTopic: "general_development",
      intent: "development",
      object: { type: "event", label: "这个状态" },
      answerMode: "open"
    }),
    [13, 36, 4]
  );

  assert.notEqual(result.mainProcess, "none");
  assert.ok(["ending", "blocked", "mixed"].includes(result.mainProcess));
  assert.ok(concepts(result).includes("burden_hardship"));
  assert.ok(concepts(result).includes("household"));
});

test("five-card blocked information synthesis does not let Key or Anchor auto-resolve the spread", () => {
  const result = synth(
    context("这个消息阻碍后面能稳定解决吗？", {
      domain: "general",
      primaryTopic: "conflict_obstacle",
      intent: "outcome",
      object: { type: "event", label: "消息阻碍" },
      answerMode: "yes_no"
    }),
    [1, 27, 21, 33, 35]
  );

  assert.equal(result.mainProcess, "blocked");
  assert.equal(result.conclusion.type, "result_tendency");
  assert.notEqual(result.conclusion.support, "clear");
  assert.ok(result.conditions?.some((condition) => condition.concept.includes("mirror")));
  assert.ok(result.unresolvedPoints?.some((point) => point.type === "mirror_conflict"));
  assert.ok(!result.conclusion.summaryConcepts.includes("improving"));
  assert.ok(!concepts(result).includes("Yes"));
});

test("safety and special regressions stay structural instead of factualized", () => {
  const trust = synth(
    context("他是不是有第三方？", {
      domain: "relationship",
      primaryTopic: "trust_exclusivity",
      intent: "state",
      object: { type: "person", label: "第三方" }
    }),
    [7, 20, 22]
  );
  assert.ok(trust.safetyFlags?.some((flag) => flag.type === "third_party_not_confirmed"));
  assert.ok(!concepts(trust).includes("confirmed infidelity"));
  assert.ok(!concepts(trust).includes("cheating_confirmed"));

  const pregnancy = synth(
    context("我会怀孕吗？", {
      domain: "family",
      primaryTopic: "children",
      intent: "outcome",
      object: { type: "event", label: "怀孕" },
      answerMode: "yes_no"
    }),
    [17, 13, 24]
  );
  assert.ok(pregnancy.safetyFlags?.some((flag) => flag.type === "pregnancy_not_confirmed"));
  assert.ok(!concepts(pregnancy).includes("confirmed pregnancy"));

  const contact = synth(
    context("他三天内会主动联系我吗？"),
    [1, 12, 27]
  );
  assert.equal(contact.conclusion.type, "action_tendency");
  assert.ok(!concepts(contact).includes("reconciliation"));
});

test("synthesis result is deterministic", () => {
  const question = context("这段关系接下来会怎么发展？", {
    domain: "relationship",
    primaryTopic: "development",
    intent: "development",
    object: { type: "relationship", label: "这段关系" }
  });
  const baseline = JSON.stringify(synth(question, [24, 25, 6, 27, 33]));
  for (let index = 0; index < 100; index += 1) {
    assert.equal(JSON.stringify(synth(question, [24, 25, 6, 27, 33])), baseline);
  }
});
