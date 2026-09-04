import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinalCardMeanings } from "../final-resolution";
import { getCardLexiconEntry } from "../lexicon";
import { QuestionContext } from "../ontology";
import { parseQuestionContext } from "../parser";
import { resolveOrderedPair } from "../pair-engine";
import { PairInput, PairInterpretation } from "../pair-types";
import { preselectCardMeaning } from "../preselection";
import { PreselectedCardMeaning } from "../preselection-types";
import { validateSpreadInput, validateSpreadStructure } from "../spread-schema";
import { buildSpreadStructure } from "../spread-protocol";
import { FiveCardSpreadStructure, SpreadInput, ThreeCardSpreadStructure } from "../spread-types";

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

function buildInput(question: QuestionContext, cards: number[]): SpreadInput {
  const preselectedCards = cards.map((cardId) => {
    const card = getCardLexiconEntry(cardId);
    assert.ok(card, `Missing card ${cardId}`);
    return preselectCardMeaning({ question, card }).meaning;
  });
  const adjacentPairs: PairInterpretation[] = [];
  for (let index = 0; index < cards.length - 1; index += 1) {
    adjacentPairs.push(resolveOrderedPair(pairInput(question, cards[index], cards[index + 1], preselectedCards, index, cards.length as 3 | 5)));
  }
  const resolvedCards = resolveFinalCardMeanings({ preselected: preselectedCards, pairInterpretations: adjacentPairs });
  return { question, cards, resolvedCards, adjacentPairs, spreadSize: cards.length as 3 | 5, preselectedCards };
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

function three(question: QuestionContext, cards: [number, number, number]) {
  const input = buildInput(question, cards);
  const inputValidation = validateSpreadInput(input);
  assert.equal(inputValidation.success, true, inputValidation.issues.join("\n"));
  const spread = buildSpreadStructure(input) as ThreeCardSpreadStructure;
  const validation = validateSpreadStructure(spread);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return spread;
}

function five(question: QuestionContext, cards: [number, number, number, number, number]) {
  const input = buildInput(question, cards);
  const inputValidation = validateSpreadInput(input);
  assert.equal(inputValidation.success, true, inputValidation.issues.join("\n"));
  const spread = buildSpreadStructure(input) as FiveCardSpreadStructure;
  const validation = validateSpreadStructure(spread);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return spread;
}

test("three-card protocol builds AB/BC, hinge, forward chain, endpoint hints, and semantic frames", () => {
  const communication = context("他三天内会主动联系我吗？");
  const riderBirdsLetter = three(communication, [1, 12, 27]);
  assert.equal(riderBirdsLetter.spreadSize, 3);
  assert.equal(riderBirdsLetter.hingeCardId, 12);
  assert.equal(riderBirdsLetter.positions[1].structuralRole, "hinge");
  assert.deepEqual(riderBirdsLetter.forwardChain.cardIds, [1, 12, 27]);
  assert.deepEqual(riderBirdsLetter.forwardChain.pairRelations, ["communicate", "communicate"]);
  assert.equal(riderBirdsLetter.forwardChain.coherence, "coherent");
  assert.equal(riderBirdsLetter.semanticFrame.mainProcess, "developing");
  assert.ok(riderBirdsLetter.hingeEvidence.reinforcedModes?.includes("oral_communication"));
  assert.equal(riderBirdsLetter.endpointHint.openingCardId, 1);
  assert.equal(riderBirdsLetter.endpointHint.closingCardId, 27);

  const blockedMessage = three(communication, [1, 21, 27]);
  assert.equal(blockedMessage.hingeCardId, 21);
  assert.equal(blockedMessage.forwardChain.pairRelations.includes("block"), true);
  assert.ok(["blocked", "mixed"].includes(blockedMessage.semanticFrame.mainProcess ?? ""));
  assert.equal(blockedMessage.positions.some((position) => ["past", "present", "future"].includes(position.structuralRole)), false);

  const uncertainBond = three(context("我们会确定关系吗？"), [24, 6, 25]);
  assert.equal(uncertainBond.hingeCardId, 6);
  assert.equal(uncertainBond.positions[1].cardId, 6);
  assert.ok(uncertainBond.hingeEvidence.reinforcedModes?.includes("uncertainty") || uncertainBond.hingeEvidence.conflictingModes?.includes("uncertainty"));
  assert.ok(uncertainBond.conflicts?.some((conflict) => conflict.type === "center_mode_conflict") || uncertainBond.warnings?.some((warning) => warning.type === "high_ambiguity"));

  const obstacleEnding = three(context("这个阻碍会结束并清晰吗？", { primaryTopic: "conflict_obstacle", object: { type: "event", label: "这个阻碍" }, intent: "outcome" }), [21, 8, 31]);
  assert.equal(obstacleEnding.hingeCardId, 8);
  assert.ok(["changing", "clarifying"].includes(obstacleEnding.semanticFrame.mainProcess ?? ""));
  assert.notEqual(obstacleEnding.semanticFrame.mainProcess, "mixed");

  const erosionPersists = three(context("这段关系的消耗会持续吗？", { domain: "relationship", primaryTopic: "commitment", object: { type: "relationship", label: "这段关系" }, intent: "development" }), [24, 23, 35]);
  assert.equal(erosionPersists.hingeCardId, 23);
  assert.equal(erosionPersists.semanticFrame.mainProcess, "eroding");
  assert.ok(erosionPersists.forwardChain.pairRelations.includes("erode"));

  const projectRevision = three(context("我的论文为什么一直写不完？", { domain: "study", primaryTopic: "academic_project", object: { type: "project", label: "论文" }, intent: "reason" }), [26, 11, 13]);
  assert.equal(projectRevision.hingeCardId, 11);
  assert.ok(projectRevision.hingeEvidence.reinforcedModes?.includes("editing_revision_research") || projectRevision.hingeEvidence.reinforcedModes?.includes("practice_discipline"));
  assert.ok(["repeating", "mixed", "developing"].includes(projectRevision.semanticFrame.mainProcess ?? ""));
});

test("five-card protocol builds focus, priorities, mirrors, conflicts, warnings, and semantic frames", () => {
  const relationship = context("我们这段关系会稳定发展吗？", {
    domain: "relationship",
    primaryTopic: "commitment",
    object: { type: "relationship", label: "这段关系" },
    intent: "development"
  });
  const supportiveBond = five(relationship, [18, 24, 25, 30, 35]);
  assert.equal(supportiveBond.focusCardId, 25);
  assert.equal(supportiveBond.positions[2].structuralRole, "focus");
  assert.equal(supportiveBond.focusEvidence.thematicRole, "topic");
  assert.deepEqual(supportiveBond.forwardChain.cardIds, [18, 24, 25, 30, 35]);
  assert.equal(Object.keys(supportiveBond.adjacentPairs).join(","), "ab,bc,cd,de");
  assert.deepEqual(supportiveBond.mirrors.map((mirror) => mirror.key), ["AE", "BD"]);
  assert.equal(supportiveBond.mirrors.some((mirror) => mirror.function === "confirm" || mirror.function === "qualify"), true);
  assert.equal(supportiveBond.semanticFrame.mainProcess, "stable");

  const uncertaintyToClarity = five(relationship, [24, 25, 6, 27, 33]);
  assert.equal(uncertaintyToClarity.focusCardId, 6);
  assert.equal(uncertaintyToClarity.focusEvidence.thematicRole, "state");
  assert.equal(uncertaintyToClarity.semanticFrame.mainProcess, "clarifying");
  assert.ok(uncertaintyToClarity.forwardChain.pairRelations.includes("communicate") || uncertaintyToClarity.forwardChain.pairRelations.includes("unlock"));
  assert.ok(uncertaintyToClarity.positions.every((position) => !["past", "present", "future"].includes(position.structuralRole)));

  const revisionAudience = five(context("我的论文修改后给导师和公开展示会怎样？", { domain: "study", primaryTopic: "academic_project", object: { type: "project", label: "论文" }, intent: "development" }), [34, 26, 11, 13, 20]);
  assert.equal(revisionAudience.focusCardId, 11);
  assert.equal(revisionAudience.focusEvidence.thematicRole, "operator");
  assert.ok(["repeating", "developing", "blocked", "mixed"].includes(revisionAudience.semanticFrame.mainProcess ?? ""));
  assert.equal(revisionAudience.positions[4].structuralRole, "closing");

  const blockedLine = five(context("这个消息阻碍后面能稳定解决吗？", { primaryTopic: "conflict_obstacle", object: { type: "event", label: "消息阻碍" }, intent: "outcome" }), [1, 27, 21, 33, 35]);
  assert.equal(blockedLine.focusCardId, 21);
  assert.equal(blockedLine.focusEvidence.thematicRole, "operator");
  assert.equal(blockedLine.forwardChain.pairRelations.includes("block"), true);
  assert.notEqual(blockedLine.semanticFrame.closingEffect, "confirmed");
  assert.ok(blockedLine.conflicts?.some((conflict) => conflict.type === "mirror_chain_conflict") || blockedLine.forwardChain.coherence !== "coherent");

  const personInfoUnclear = five(context("这个男人对外说的信息到底清不清楚？", { domain: "relationship", primaryTopic: "trust_exclusivity", object: { type: "person", label: "这个男人" }, intent: "description" }), [26, 28, 6, 27, 20]);
  assert.equal(personInfoUnclear.focusCardId, 6);
  assert.equal(personInfoUnclear.focusEvidence.thematicRole, "state");
  assert.equal(personInfoUnclear.mirrors.length, 2);
  assert.ok(personInfoUnclear.mirrors.every((mirror) => ["confirm", "qualify", "contrast", "subtext", "irrelevant"].includes(mirror.function)));
  assert.equal(Boolean(personInfoUnclear.warnings?.some((warning) => warning.type === "multiple_primary_people")), false);
});

test("mirror evidence reuses pair engine and cannot overturn a clear main chain", () => {
  const q = context("这件事后续如何？", { intent: "development", object: { type: "event", label: "这件事" } });
  const confirmMirror = five(q, [1, 12, 27, 26, 33]);
  assert.equal(confirmMirror.mirrors[0].key, "AE");
  assert.ok(["confirm", "qualify", "subtext", "contrast"].includes(confirmMirror.mirrors[0].function));
  assert.equal(confirmMirror.mirrors[0].forwardRelation.leftCardId, 1);
  assert.equal(confirmMirror.mirrors[0].reverseRelation.leftCardId, 33);
  assert.ok(confirmMirror.mirrors[0].relationSummary);

  const qualifyMirror = five(q, [24, 25, 6, 27, 33]);
  assert.ok(qualifyMirror.mirrors.some((mirror) => mirror.function === "qualify" || mirror.function === "contrast"));
  assert.ok(qualifyMirror.mirrors.some((mirror) => mirror.relevance === "high" || mirror.relevance === "medium"));

  const contrastMirror = five(q, [21, 27, 26, 31, 33]);
  assert.ok(contrastMirror.mirrors.some((mirror) => mirror.conflictsWithMainChain || mirror.function === "contrast" || mirror.function === "qualify"));

  const subtextMirror = five(q, [18, 24, 25, 30, 35]);
  assert.ok(subtextMirror.mirrors.some((mirror) => mirror.function === "subtext" || mirror.function === "confirm" || mirror.function === "qualify"));

  const subtextSpecific = five(q, [3, 7, 4, 11, 34]);
  assert.ok(subtextSpecific.mirrors.some((mirror) => mirror.function === "subtext"));

  const irrelevantMirror = five(context("我的耳机在哪里？"), [10, 15, 4, 29, 3]);
  assert.ok(irrelevantMirror.mirrors.some((mirror) => mirror.function === "irrelevant" && mirror.relevance === "low"));

  const blockedMain = five(q, [1, 27, 21, 33, 35]);
  assert.equal(blockedMain.forwardChain.pairRelations.includes("block"), true);
  assert.notEqual(blockedMain.semanticFrame.mainProcess, "clarifying");
  assert.ok(blockedMain.mirrors.every((mirror) => mirror.function !== "confirm" || !mirror.conflictsWithMainChain));
});

test("Phase 5.1 structural semantic regressions from audit", () => {
  const uncertainBond = three(context("他对我是什么感觉？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    object: { type: "relationship", label: "relationship/person" },
    intent: "feelings_attitude",
    answerMode: "open"
  }), [24, 6, 25]);
  assert.equal(uncertainBond.semanticFrame.coreTheme, "uncertainty");
  assert.ok(["uncertain", "mixed"].includes(uncertainBond.semanticFrame.mainProcess ?? ""));
  assert.notEqual(uncertainBond.semanticFrame.mainProcess, "blocked");
  assert.ok(["open", "unclear"].includes(uncertainBond.semanticFrame.closingEffect ?? ""));
  assert.notEqual(uncertainBond.semanticFrame.closingEffect, "stabilized");

  const obstacleEnding = three(context("这个问题能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "这个问题" },
    intent: "outcome",
    answerMode: "yes_no"
  }), [21, 8, 31]);
  assert.equal(obstacleEnding.adjacentPairs.bc.primaryRelation.relation, "sequence");
  assert.equal(obstacleEnding.adjacentPairs.bc.primaryRelation.subjectCardId, 8);
  assert.notEqual(obstacleEnding.adjacentPairs.bc.primaryRelation.semanticResult.headConcept, "success_achievement");
  assert.ok(["changing", "clarifying"].includes(obstacleEnding.semanticFrame.mainProcess ?? ""));

  const uncertaintyToClarity = five(context("这段关系接下来会怎么发展？", {
    domain: "relationship",
    primaryTopic: "development",
    object: { type: "relationship", label: "这段关系" },
    intent: "development",
    answerMode: "open"
  }), [24, 25, 6, 27, 33]);
  assert.equal(uncertaintyToClarity.forwardChain.coherence, "mostly_coherent");
  assert.ok(uncertaintyToClarity.conflicts?.some((conflict) => conflict.type === "mirror_chain_conflict"));
  assert.notEqual(uncertaintyToClarity.forwardChain.coherence, "conflicted");
  assert.notEqual(uncertaintyToClarity.semanticFrame.mainProcess, "blocked");

  const projectRevision = five(context("我的论文现在最大的问题是什么？", {
    domain: "study",
    primaryTopic: "academic_project",
    object: { type: "project", label: "论文" },
    intent: "obstacle",
    answerMode: "open"
  }), [34, 26, 11, 13, 20]);
  const fish = projectRevision.positions.find((position) => position.cardId === 34)?.resolvedMeaning;
  const child = projectRevision.positions.find((position) => position.cardId === 13)?.resolvedMeaning;
  const garden = projectRevision.positions.find((position) => position.cardId === 20)?.resolvedMeaning;
  assert.ok(fish);
  assert.notEqual(fish.primaryMode, "money_finance");
  assert.ok(child);
  assert.equal(child.primaryMode, "simplicity_reduction");
  assert.ok(garden);
  assert.notEqual(garden.plane, "location");
  assert.notEqual(garden.role, "location");
  assert.ok(projectRevision.adjacentPairs.cd.neighborEvidence.some((item) => item.supportsModes?.includes("simplicity_reduction")));
});

test("runtime validation rejects malformed spread inputs", () => {
  const q = context("这件事后续如何？");
  const valid = buildInput(q, [1, 12, 27]);
  assert.equal(validateSpreadInput(valid).success, true);
  assert.equal(validateSpreadInput({ ...valid, cards: [1, 12], spreadSize: 3 }).success, false);
  assert.equal(validateSpreadInput({ ...valid, cards: [1, 1, 27] }).success, false);
  assert.equal(validateSpreadInput({ ...valid, adjacentPairs: valid.adjacentPairs.slice(0, 1) }).success, false);
  assert.equal(validateSpreadInput({ ...valid, adjacentPairs: [...valid.adjacentPairs].reverse() }).success, false);
});
