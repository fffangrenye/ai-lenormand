import assert from "node:assert/strict";
import test from "node:test";
import { resolveBasicAnswer } from "../basic-answer-resolver";
import { validateBasicAnswerResolution } from "../answer-schema";
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
  const synthesis = synthesizeWholeLine({ question, resolvedCards, pairs, spread });
  const tempo = evaluateTempoCompatibility({ question, resolvedCards, spread, synthesis });
  const answer = resolveBasicAnswer({ question, synthesis, tempo });
  const validation = validateBasicAnswerResolution(answer);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return { spread, synthesis, tempo, answer };
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

function serialized(value: unknown) {
  return JSON.stringify(value);
}

test("feelings question with Heart Clouds Ring supports feeling conditionally without commitment shortcut", () => {
  const q = context("他喜欢我吗？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    intent: "feelings_attitude",
    object: { type: "person", label: "他" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [24, 6, 25]);

  assert.equal(answer.proposition.propositionType, "feeling");
  assert.equal(answer.semanticSupport.semanticDirection, "support");
  assert.ok(["supported", "conditional"].includes(answer.resolution));
  assert.ok(answer.supportEvidence.some((item) => item.type === "feeling_match"));
  assert.equal(answer.proposition.desiredState, "affection_or_attraction");
  assert.equal(serialized(answer).includes("marriage"), false);
});

test("Feeling evidence does not satisfy a contact/action proposition", () => {
  const q = context("他会主动联系我吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "action",
    object: { type: "message", label: "联系" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [24, 25, 35]);

  assert.equal(answer.proposition.propositionType, "action");
  assert.equal(answer.proposition.action, "contact");
  assert.notEqual(answer.resolution, "supported");
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.ok(["unclear", "weakly_supported", "not_supported", "conditional"].includes(answer.resolution));
  assert.ok(answer.semanticSupport.missingComponents?.includes("contact_action_evidence"));
  assert.ok(answer.blockers?.some((item) => item.type === "lack_of_action"));
});

test("Contact does not become reconciliation support", () => {
  const q = context("我们会复合吗？", {
    domain: "relationship",
    primaryTopic: "reconciliation",
    intent: "outcome",
    object: { type: "relationship", label: "我们会复合吗？" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [1, 27, 12]);

  assert.equal(answer.proposition.desiredState, "relationship_reconciliation");
  assert.ok(["weakly_supported", "conditional", "unclear"].includes(answer.resolution));
  assert.notEqual(answer.resolution, "supported");
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.ok(answer.semanticSupport.missingComponents?.includes("reconciliation_state_evidence"));
  assert.ok(answer.supportEvidence.some((item) => item.concept === "contact only, not reconciliation"));
});

test("Commitment and stability do not become feeling support", () => {
  const q = context("他喜欢我吗？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    intent: "feelings_attitude",
    object: { type: "person", label: "他" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [25, 35, 19]);

  assert.equal(answer.proposition.propositionType, "feeling");
  assert.ok(["unclear", "weakly_supported", "not_supported", "conditional"].includes(answer.resolution));
  assert.notEqual(answer.resolution, "supported");
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.ok(answer.semanticSupport.missingComponents?.includes("feeling_evidence"));
});

test("Mountain Coffin Sun supports resolution by process, not Sun or Coffin shortcuts", () => {
  const q = context("这个问题能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    intent: "outcome",
    object: { type: "event", label: "这个问题能解决吗？" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [21, 8, 31]);

  assert.equal(answer.proposition.desiredState, "resolved_or_successful_outcome");
  assert.ok(["supported", "conditional", "strongly_supported"].includes(answer.resolution));
  assert.ok(answer.supportEvidence.some((item) => item.evidenceCodes.includes("MATCH_OUTCOME_PROCESS")));
  assert.equal(serialized(answer).includes("Sun=Yes"), false);
  assert.equal(serialized(answer).includes("Coffin=No"), false);
});

test("time-bound message receives support when semantic contact and tempo both match", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const { answer, tempo } = build(q, [1, 27, 33]);

  assert.equal(answer.proposition.desiredState, "receive_message_or_contact");
  assert.equal(tempo.compatibility, "well_matched");
  assert.ok(["supported", "strongly_supported"].includes(answer.resolution));
  assert.equal(answer.timingEffect?.effect, "strengthen");
  assert.equal(serialized(answer).includes("Key=Yes"), false);
});

test("slow one-week progress is weakened by semantic pace without becoming No", () => {
  const q = context("一周内能有明显进展吗？", {
    domain: "study",
    primaryTopic: "academic_project",
    intent: "outcome",
    object: { type: "project", label: "进展" },
    answerMode: "yes_no"
  });
  const { answer, tempo } = build(q, [26, 5, 35]);

  assert.equal(answer.proposition.desiredState, "progress_or_change");
  assert.equal(tempo.compatibility, "strained");
  assert.ok(["weakly_supported", "not_supported", "conditional"].includes(answer.resolution));
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.equal(answer.timingEffect?.effect, "qualify");
  assert.equal(serialized(answer).includes("Slow = No"), false);
});

test("well-matched extended tempo does not support a change proposition by itself", () => {
  const q = context("半年内这个状态会不会改变？", {
    domain: "general",
    primaryTopic: "general_development",
    intent: "outcome",
    object: { type: "event", label: "这个状态会不会改变" },
    answerMode: "yes_no",
    timeframe: timeframe("extended", 6, "month")
  });
  const { answer, tempo } = build(q, [21, 35, 5]);

  assert.equal(answer.proposition.desiredState, "progress_or_change");
  assert.equal(tempo.compatibility, "well_matched");
  assert.equal(tempo.compatibilityTarget, "semantic_process");
  assert.ok(["not_supported", "weakly_supported"].includes(answer.resolution));
  assert.ok(answer.opposingEvidence.some((item) => item.evidenceCodes.includes("OPPOSE_PROGRESS_PERSISTENCE")));
  assert.equal(answer.semanticSupport.semanticDirection, "oppose");
});

test("open development question is not applicable instead of forced yes/no", () => {
  const q = context("这段关系接下来怎么发展？", {
    domain: "relationship",
    primaryTopic: "development",
    intent: "development",
    object: { type: "relationship", label: "这段关系" },
    answerMode: "open"
  });
  const { answer } = build(q, [24, 25, 6, 27, 33]);

  assert.equal(answer.answerMode, "open");
  assert.equal(answer.resolution, "not_applicable");
  assert.equal(answer.proposition.propositionType, "development");
});

test("third-party factual safety prevents factual yes-style support", () => {
  const q = context("他是不是有第三方？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    intent: "state",
    object: { type: "person", label: "第三方" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [7, 20, 22]);

  assert.ok(answer.safetyFlags?.some((flag) => flag.type === "third_party_not_confirmed"));
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.notEqual(answer.resolution, "supported");
  assert.equal(serialized(answer).includes("confirmed infidelity"), false);
});

test("pregnancy factual safety prevents factual certainty", () => {
  const q = context("我会怀孕吗？", {
    domain: "family",
    primaryTopic: "children",
    intent: "outcome",
    object: { type: "event", label: "怀孕" },
    answerMode: "yes_no"
  });
  const { answer } = build(q, [17, 13, 24]);

  assert.ok(answer.safetyFlags?.some((flag) => flag.type === "pregnancy_not_confirmed"));
  assert.notEqual(answer.resolution, "strongly_supported");
  assert.equal(serialized(answer).includes("confirmed pregnancy"), false);
});

test("Basic Answer Resolver is deterministic", () => {
  const q = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    intent: "outcome",
    object: { type: "message", label: "消息" },
    answerMode: "yes_no"
  });
  const baseline = serialized(build(q, [1, 27, 33]).answer);
  for (let index = 0; index < 50; index += 1) {
    assert.equal(serialized(build(q, [1, 27, 33]).answer), baseline);
  }
});
