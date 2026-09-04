import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinalCardMeanings, resolvePairPipeline } from "../final-resolution";
import { getCardLexiconEntry } from "../lexicon";
import { parseQuestionContext } from "../parser";
import { resolveOrderedPair } from "../pair-engine";
import { validatePairInterpretation, validateResolvedCardMeaning } from "../pair-schema";
import { orderedPairKey, PairInput } from "../pair-types";
import { preselectCardMeaning } from "../preselection";
import { QuestionContext } from "../ontology";

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

function select(cardId: number, question: QuestionContext) {
  const card = getCardLexiconEntry(cardId);
  assert.ok(card, `Missing card ${cardId}`);
  return preselectCardMeaning({ question, card }).meaning;
}

function input(question: QuestionContext, leftCardId: number, rightCardId: number, pairIndex = 0): PairInput {
  const leftCard = getCardLexiconEntry(leftCardId);
  const rightCard = getCardLexiconEntry(rightCardId);
  assert.ok(leftCard, `Missing left card ${leftCardId}`);
  assert.ok(rightCard, `Missing right card ${rightCardId}`);
  return {
    left: select(leftCardId, question),
    right: select(rightCardId, question),
    leftCard,
    rightCard,
    question,
    pairIndex,
    spreadSize: 3
  };
}

function pair(question: QuestionContext, leftCardId: number, rightCardId: number) {
  const result = resolveOrderedPair(input(question, leftCardId, rightCardId));
  const validation = validatePairInterpretation(result);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return result;
}

test("ordered pair key and relation evidence preserve left-to-right direction", () => {
  const q = context("这件事后续怎么样？");
  const pairs = [
    [14, 27],
    [26, 28],
    [26, 29],
    [36, 9],
    [24, 25],
    [23, 25],
    [21, 27],
    [1, 27],
    [12, 27],
    [33, 21],
    [21, 33],
    [6, 27],
    [27, 6],
    [8, 21],
    [21, 8],
    [22, 35]
  ] as const;

  for (const [left, right] of pairs) {
    const forward = pair(q, left, right);
    const reverse = pair(q, right, left);
    assert.notEqual(orderedPairKey(left, right), orderedPairKey(right, left));
    assert.deepEqual(forward.debugTrace?.pair, [left, right]);
    assert.deepEqual(reverse.debugTrace?.pair, [right, left]);
    assert.notEqual(forward.primaryRelation.evidence[0].code, reverse.primaryRelation.evidence[0].code);
  }
});

test("high-value ordered overrides keep distinct semantics", () => {
  const relationship = context("他是不是在骗我？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "person", label: "他" },
    intent: "state"
  });
  const career = context("这份工作后续怎么样？", {
    domain: "career",
    primaryTopic: "current_job",
    object: { type: "job", label: "这份工作" },
    intent: "development"
  });

  const foxLetter = pair(relationship, 14, 27);
  assert.equal(foxLetter.primaryRelation.relation, "modify");
  assert.ok(foxLetter.primaryRelation.evidence.some((item) => item.code === "OVERRIDE_FOX_LETTER_WARNING_DOCUMENT"));
  assert.equal(foxLetter.primaryRelation.semanticResult.informationState, "unclear");

  const letterFox = pair(relationship, 27, 14);
  assert.equal(letterFox.primaryRelation.relation, "communicate");
  assert.ok(letterFox.primaryRelation.evidence.some((item) => item.code === "OVERRIDE_LETTER_FOX_DOCUMENT_REVEALS_WARNING"));

  const careerFoxLetter = pair(career, 14, 27);
  assert.equal(careerFoxLetter.primaryRelation.relation, "associate");
  assert.equal(careerFoxLetter.primaryRelation.subjectModeId, "employment");

  const riderLetter = pair(relationship, 1, 27);
  assert.equal(riderLetter.primaryRelation.relation, "communicate");
  assert.equal(riderLetter.primaryRelation.semanticResult.informationState, "incoming");

  const birdsLetter = pair(relationship, 12, 27);
  assert.equal(birdsLetter.primaryRelation.relation, "communicate");
  assert.notEqual(birdsLetter.primaryRelation.subjectModeId, riderLetter.primaryRelation.subjectModeId);
});

test("person anchors receive description without creating partner facts", () => {
  const q = context("这个人是什么情况？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "person", label: "这个人" },
    intent: "description"
  });
  const bookMan = pair(q, 26, 28);
  assert.equal(bookMan.primaryRelation.relation, "describe");
  assert.equal(bookMan.primaryRelation.subjectCardId, 28);
  assert.equal(bookMan.primaryRelation.operatorCardId, 26);
  assert.equal(bookMan.primaryRelation.semanticResult.personEffect?.personCardId, 28);
  assert.ok(!JSON.stringify(bookMan).includes("partner"));

  const manBook = pair(q, 28, 26);
  assert.equal(manBook.primaryRelation.relation, "describe");
  assert.equal(manBook.primaryRelation.subjectCardId, 28);
  assert.notDeepEqual(bookMan.primaryRelation.evidence[0].code, manBook.primaryRelation.evidence[0].code);

  const bookWoman = pair(q, 26, 29);
  assert.equal(bookWoman.primaryRelation.subjectCardId, 29);
});

test("Cross, Mice, Ring, Heart, Mountain, Key preserve ordered behavior", () => {
  const q = context("我们会确定关系吗？");
  const crossBouquet = pair(q, 36, 9);
  assert.equal(crossBouquet.primaryRelation.relation, "burden");
  assert.equal(crossBouquet.primaryRelation.subjectCardId, 9);

  const bouquetCross = pair(q, 9, 36);
  assert.equal(bouquetCross.primaryRelation.relation, "finalize");
  assert.equal(bouquetCross.primaryRelation.subjectCardId, 9);
  assert.notEqual(crossBouquet.primaryRelation.relation, bouquetCross.primaryRelation.relation);

  const heartRing = pair(q, 24, 25);
  assert.equal(heartRing.primaryRelation.relation, "bind");
  assert.ok(heartRing.neighborEvidence.some((item) => item.supportsModes?.includes("love_affection")));
  assert.ok(heartRing.neighborEvidence.some((item) => item.supportsModes?.includes("commitment_bond")));
  assert.ok(!JSON.stringify(heartRing.primaryRelation).includes("marriage_union"));

  const ringHeart = pair(q, 25, 24);
  assert.equal(ringHeart.primaryRelation.relation, "bind");
  assert.notEqual(heartRing.primaryRelation.subjectModeId, ringHeart.primaryRelation.subjectModeId);

  const miceRing = pair(q, 23, 25);
  assert.equal(miceRing.primaryRelation.relation, "erode");
  assert.equal(miceRing.primaryRelation.subjectCardId, 23);

  const ringMice = pair(q, 25, 23);
  assert.equal(ringMice.primaryRelation.relation, "erode");
  assert.equal(ringMice.primaryRelation.subjectCardId, 25);

  const mountainKey = pair(q, 21, 33);
  const keyMountain = pair(q, 33, 21);
  assert.notEqual(mountainKey.primaryRelation.subjectCardId, keyMountain.primaryRelation.subjectCardId);
  assert.ok(["block", "confirm", "unlock"].includes(mountainKey.primaryRelation.relation));
  assert.ok(["block", "confirm", "unlock"].includes(keyMountain.primaryRelation.relation));
});

test("neighbor-required third-party modes remain possibilities, not factual cheating claims", () => {
  const trust = context("他是不是有第三方？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "person", label: "第三方" },
    intent: "state"
  });
  const snakeGarden = pair(trust, 7, 20);
  const resolved = resolveFinalCardMeanings({
    preselected: [input(trust, 7, 20).left, input(trust, 7, 20).right],
    pairInterpretations: [snakeGarden]
  });
  for (const item of resolved) {
    const validation = validateResolvedCardMeaning(item);
    assert.equal(validation.success, true, validation.issues.join("\n"));
  }
  const snake = resolved.find((item) => item.cardId === 7);
  assert.ok(snake);
  assert.ok(select(7, trust).candidates.some((candidate) => candidate.modeId === "third_party_factor" && candidate.requiresNeighborResolution));
  assert.ok(!JSON.stringify(resolved).includes("infidelity_confirmed"));
  assert.ok(!JSON.stringify(resolved).includes("cheating_confirmed"));
});

test("final semantic resolution only chooses from preselected candidates and refinement runs once", () => {
  const study = context("我的论文为什么一直写不完？", {
    domain: "study",
    primaryTopic: "academic_project",
    object: { type: "project", label: "论文" },
    intent: "reason"
  });
  const bookWhipInput = input(study, 26, 11);
  const initial = resolveOrderedPair(bookWhipInput);
  const resolved = resolveFinalCardMeanings({
    preselected: [bookWhipInput.left, bookWhipInput.right],
    pairInterpretations: [initial]
  });
  const book = resolved.find((item) => item.cardId === 26);
  const whip = resolved.find((item) => item.cardId === 11);
  assert.ok(book);
  assert.ok(whip);
  assert.ok(bookWhipInput.left.candidates.some((candidate) => candidate.modeId === book.primaryMode));
  assert.ok(bookWhipInput.right.candidates.some((candidate) => candidate.modeId === whip.primaryMode));
  assert.equal(book.primaryMode, "project_case");
  assert.equal(whip.primaryMode, "editing_revision_research");
  assert.ok(book.evidence.some((item) => item.source === "neighbor"));
  assert.ok(whip.evidence.some((item) => item.source === "neighbor"));

  const pipeline = resolvePairPipeline([bookWhipInput]);
  assert.equal(pipeline.initialPairs.length, 1);
  assert.equal(pipeline.refinedPairs.length, 1);
  assert.equal(pipeline.refinementPasses, 0);
  assert.equal(pipeline.initialPairs[0].primaryRelation.relation, pipeline.refinedPairs[0].primaryRelation.relation);
  assert.ok(pipeline.refinedPairs.every((item) => validatePairInterpretation(item).success));
});

test("Phase 4.1 agency and Book person descriptor regressions stay fixed", () => {
  for (const cardId of [8, 14, 21, 23, 24, 25, 26, 27, 33]) {
    assert.equal(getCardLexiconEntry(cardId)?.semanticAgency, "mixed");
  }
  assert.equal(getCardLexiconEntry(28)?.semanticAgency, "passive_anchor");
  assert.equal(getCardLexiconEntry(29)?.semanticAgency, "passive_anchor");
  const bookPersonMode = getCardLexiconEntry(26)?.semanticModes.find((mode) => mode.id === "educated_secretive_person");
  assert.ok(bookPersonMode?.planes.includes("person"));
  assert.ok(!bookPersonMode?.roles.includes("person_anchor"));
});

test("Phase 4.1 refinement is optional and runs once only when final modes change", () => {
  const unchanged = context("我们会确定关系吗？", {
    domain: "relationship",
    primaryTopic: "commitment",
    object: { type: "relationship", label: "确定关系" },
    intent: "outcome"
  });
  const unchangedPipeline = resolvePairPipeline([input(unchanged, 24, 25)]);
  assert.equal(unchangedPipeline.refinementPasses, 0);
  assert.equal(unchangedPipeline.initialPairs[0].primaryRelation.relation, unchangedPipeline.refinedPairs[0].primaryRelation.relation);

  const changed = context("这个男人是什么情况？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "person", label: "这个男人" },
    intent: "description"
  });
  const changedPipeline = resolvePairPipeline([input(changed, 26, 28)]);
  assert.equal(changedPipeline.refinementPasses, 1);
  assert.equal(changedPipeline.initialPairs.length, 1);
  assert.equal(changedPipeline.refinedPairs.length, 1);
});

test("Phase 4.1 Key relations follow current mode instead of card-level confirm", () => {
  const obstacle = context("这个阻碍能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "这个阻碍" },
    intent: "outcome"
  });
  const keyMountain = pair(obstacle, 33, 21);
  assert.equal(keyMountain.primaryRelation.subjectModeId, "solution_unlock");
  assert.equal(keyMountain.primaryRelation.relation, "unlock");
  assert.notEqual(keyMountain.primaryRelation.relation, "confirm");

  const mountainKey = pair(obstacle, 21, 33);
  assert.equal(mountainKey.primaryRelation.subjectModeId, "blockage_obstacle");
  assert.equal(mountainKey.primaryRelation.relation, "block");
  assert.equal(mountainKey.primaryRelation.operatorModeId, "confirmation_certainty");

  const bookQuestion = context("这个未知信息能打开吗？", {
    domain: "general",
    primaryTopic: "general_state",
    object: { type: "event", label: "未知信息" },
    intent: "outcome"
  });
  const keyBook = pair(bookQuestion, 33, 26);
  assert.equal(keyBook.primaryRelation.subjectModeId, "solution_unlock");
  assert.equal(keyBook.primaryRelation.relation, "unlock");

  const bookKey = pair(bookQuestion, 26, 33);
  assert.equal(bookKey.primaryRelation.relation, "confirm");
  assert.equal(bookKey.primaryRelation.operatorModeId, "confirmation_certainty");

  const keyLetter = pair(bookQuestion, 33, 27);
  assert.equal(keyLetter.primaryRelation.relation, "unlock");
  assert.equal(keyLetter.primaryRelation.subjectModeId, "solution_unlock");

  const letterKey = pair(bookQuestion, 27, 33);
  assert.equal(letterKey.primaryRelation.relation, "confirm");
  assert.equal(letterKey.primaryRelation.operatorModeId, "confirmation_certainty");
});

test("Phase 5.1 Coffin-left and study revision simplification regressions", () => {
  const obstacle = context("这个问题能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "这个问题" },
    intent: "outcome"
  });
  const coffinSun = pair(obstacle, 8, 31);
  assert.equal(coffinSun.primaryRelation.relation, "sequence");
  assert.equal(coffinSun.primaryRelation.subjectCardId, 8);
  assert.equal(coffinSun.primaryRelation.subjectModeId, "ending_closure");
  assert.notEqual(coffinSun.primaryRelation.semanticResult.headConcept, "success_achievement");
  assert.notEqual(coffinSun.primaryRelation.semanticResult.action, "end");

  const mountainCoffin = pair(obstacle, 21, 8);
  assert.equal(mountainCoffin.primaryRelation.relation, "end");
  assert.equal(mountainCoffin.primaryRelation.subjectModeId, "blockage_obstacle");

  const study = context("我的论文现在最大的问题是什么？", {
    domain: "study",
    primaryTopic: "academic_project",
    object: { type: "project", label: "论文" },
    intent: "obstacle"
  });
  const whipChild = pair(study, 11, 13);
  assert.ok(whipChild.neighborEvidence.some((item) => item.supportsModes?.includes("simplicity_reduction")));
});

test("Phase 6.1 Book hiding behavior is mode-sensitive in study project context", () => {
  const study = context("我的论文现在最大的问题是什么？");
  const fishBook = pair(study, 34, 26);

  assert.equal(fishBook.primaryRelation.subjectModeId, "abundance_quantity");
  assert.ok(["knowledge_learning", "research_investigation", "project_case"].includes(fishBook.primaryRelation.operatorModeId ?? ""));
  assert.equal(fishBook.primaryRelation.relation, "modify");
  assert.notEqual(fishBook.primaryRelation.relation, "hide");
  assert.equal(fishBook.primaryRelation.semanticResult.headConcept, "abundance_quantity");
});
