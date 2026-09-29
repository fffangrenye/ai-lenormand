import assert from "node:assert/strict";
import test from "node:test";
import { getCardLexiconEntry } from "../lexicon";
import { QuestionContext } from "../ontology";
import { parseQuestionContext } from "../parser";
import { resolveOrderedPair } from "../pair-engine";
import { validatePairInterpretation } from "../pair-schema";
import { PairInput, PairInterpretation, PairRelationType } from "../pair-types";
import { PreselectedCardMeaning, SemanticCandidate } from "../preselection-types";
import { preselectCardMeaning } from "../preselection";

type PairCase = {
  name: string;
  left: number;
  right: number;
  question: QuestionContext;
  expected: {
    relation: PairRelationType;
    subjectCardId: number;
    operatorCardId: number;
    subjectModeId: string;
    operatorModeId: string;
    evidenceCode?: string;
  };
};

type Classification =
  | "CURRENT_CORRECT"
  | "CURRENT_INCORRECT"
  | "BEHAVIOR_SUFFICIENT"
  | "GENERIC_GRAMMAR_SUFFICIENT"
  | "PAIR_OVERRIDE_NEEDED"
  | "SPECIAL_BEHAVIOR_FIX_NEEDED"
  | "GENERIC_GRAMMAR_FIX_NEEDED"
  | "SAFETY_GATE_ONLY"
  | "NEEDS_MORE_CONTEXT";

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

function card(cardId: number) {
  const entry = getCardLexiconEntry(cardId);
  assert.ok(entry, `Missing card ${cardId}`);
  return entry;
}

function select(cardId: number, question: QuestionContext): PreselectedCardMeaning {
  return preselectCardMeaning({ question, card: card(cardId) }).meaning;
}

function forceMode(meaning: PreselectedCardMeaning, modeId: string): PreselectedCardMeaning {
  const candidate =
    meaning.candidates.find((item) => item.modeId === modeId) ??
    (() => {
      const mode = card(meaning.cardId).semanticModes.find((item) => item.id === modeId);
      assert.ok(mode, `Missing semantic mode ${modeId} for card ${meaning.cardId}`);
      return {
        modeId: mode.id,
        relevance: "possible" as const,
        internalScore: 2,
        roles: mode.roles,
        planes: mode.planes,
        evidence: [{ source: "default" as const, code: "V2_FORCED_MODE_FIXTURE" }]
      };
    })();
  return {
    ...meaning,
    candidates: [candidate as SemanticCandidate],
    unresolved: false,
    warnings: undefined
  };
}

function input(question: QuestionContext, leftCardId: number, rightCardId: number, forcedModes?: { left?: string; right?: string }): PairInput {
  const left = select(leftCardId, question);
  const right = select(rightCardId, question);
  return {
    left: forcedModes?.left ? forceMode(left, forcedModes.left) : left,
    right: forcedModes?.right ? forceMode(right, forcedModes.right) : right,
    leftCard: card(leftCardId),
    rightCard: card(rightCardId),
    question,
    pairIndex: 0,
    spreadSize: 3
  };
}

function pair(question: QuestionContext, leftCardId: number, rightCardId: number, forcedModes?: { left?: string; right?: string }) {
  const result = resolveOrderedPair(input(question, leftCardId, rightCardId, forcedModes));
  const validation = validatePairInterpretation(result);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return result;
}

function stableSnapshot(result: PairInterpretation) {
  return {
    primaryRelation: {
      relation: result.primaryRelation.relation,
      subjectCardId: result.primaryRelation.subjectCardId,
      operatorCardId: result.primaryRelation.operatorCardId,
      subjectModeId: result.primaryRelation.subjectModeId,
      operatorModeId: result.primaryRelation.operatorModeId,
      semanticResult: result.primaryRelation.semanticResult,
      evidence: result.primaryRelation.evidence
    },
    neighborEvidence: result.neighborEvidence,
    unresolved: result.unresolved,
    debugTrace: {
      pair: result.debugTrace?.pair,
      appliedOverrides: result.debugTrace?.appliedOverrides,
      appliedBehaviors: result.debugTrace?.appliedBehaviors,
      selectedRelation: result.debugTrace?.selectedRelation
    }
  };
}

function assertDeterministic(makeResult: () => PairInterpretation) {
  assert.deepEqual(stableSnapshot(makeResult()), stableSnapshot(makeResult()));
}

function assertCase(item: PairCase) {
  const result = pair(item.question, item.left, item.right);
  assert.equal(result.primaryRelation.relation, item.expected.relation, item.name);
  assert.equal(result.primaryRelation.subjectCardId, item.expected.subjectCardId, item.name);
  assert.equal(result.primaryRelation.operatorCardId, item.expected.operatorCardId, item.name);
  assert.equal(result.primaryRelation.subjectModeId, item.expected.subjectModeId, item.name);
  assert.equal(result.primaryRelation.operatorModeId, item.expected.operatorModeId, item.name);
  assert.ok(result.neighborEvidence.some((evidence) => evidence.supportsModes?.includes(item.expected.subjectModeId)), item.name);
  assert.ok(result.neighborEvidence.some((evidence) => evidence.supportsModes?.includes(item.expected.operatorModeId)), item.name);
  if (item.expected.evidenceCode) {
    assert.ok(result.primaryRelation.evidence.some((evidence) => evidence.code === item.expected.evidenceCode), item.name);
  }
  assertDeterministic(() => pair(item.question, item.left, item.right));
  return result;
}

test("V2 P0_KEEP characterization fixtures preserve current ordered override behavior", () => {
  const relationshipTrust = context("他是不是在骗我？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "person", label: "他" },
    intent: "state"
  });
  const relationshipCommitment = context("我们会确定关系吗？", {
    domain: "relationship",
    primaryTopic: "commitment",
    object: { type: "relationship", label: "关系" },
    intent: "outcome"
  });
  const obstacle = context("这个阻碍能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "阻碍" },
    intent: "outcome"
  });
  const information = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    object: { type: "message", label: "消息" },
    intent: "outcome"
  });

  const cases: PairCase[] = [
    {
      name: "Fox > Letter",
      left: 14,
      right: 27,
      question: relationshipTrust,
      expected: {
        relation: "modify",
        subjectCardId: 14,
        operatorCardId: 27,
        subjectModeId: "deception_suspicion",
        operatorModeId: "written_message",
        evidenceCode: "OVERRIDE_FOX_LETTER_WARNING_DOCUMENT"
      }
    },
    {
      name: "Letter > Fox",
      left: 27,
      right: 14,
      question: relationshipTrust,
      expected: {
        relation: "communicate",
        subjectCardId: 27,
        operatorCardId: 14,
        subjectModeId: "written_message",
        operatorModeId: "wrong_warning",
        evidenceCode: "OVERRIDE_LETTER_FOX_DOCUMENT_REVEALS_WARNING"
      }
    },
    {
      name: "Ring > Mice",
      left: 25,
      right: 23,
      question: relationshipCommitment,
      expected: {
        relation: "erode",
        subjectCardId: 25,
        operatorCardId: 23,
        subjectModeId: "commitment_bond",
        operatorModeId: "erosion_diminishment",
        evidenceCode: "OVERRIDE_RING_MICE_BOND_ERODES"
      }
    },
    {
      name: "Mice > Ring",
      left: 23,
      right: 25,
      question: relationshipCommitment,
      expected: {
        relation: "erode",
        subjectCardId: 23,
        operatorCardId: 25,
        subjectModeId: "erosion_diminishment",
        operatorModeId: "commitment_bond",
        evidenceCode: "OVERRIDE_MICE_RING_ERODE_BOND"
      }
    },
    {
      name: "Key > Mountain",
      left: 33,
      right: 21,
      question: obstacle,
      expected: {
        relation: "unlock",
        subjectCardId: 33,
        operatorCardId: 21,
        subjectModeId: "solution_unlock",
        operatorModeId: "blockage_obstacle",
        evidenceCode: "OVERRIDE_KEY_MOUNTAIN_UNLOCK_BLOCK"
      }
    },
    {
      name: "Mountain > Key",
      left: 21,
      right: 33,
      question: obstacle,
      expected: {
        relation: "block",
        subjectCardId: 21,
        operatorCardId: 33,
        subjectModeId: "blockage_obstacle",
        operatorModeId: "confirmation_certainty",
        evidenceCode: "OVERRIDE_MOUNTAIN_KEY_BLOCK_CONFIRMATION"
      }
    },
    {
      name: "Key > Letter",
      left: 33,
      right: 27,
      question: information,
      expected: {
        relation: "unlock",
        subjectCardId: 33,
        operatorCardId: 27,
        subjectModeId: "solution_unlock",
        operatorModeId: "written_message",
        evidenceCode: "OVERRIDE_KEY_LETTER_UNLOCK_DOCUMENT"
      }
    },
    {
      name: "Letter > Key",
      left: 27,
      right: 33,
      question: information,
      expected: {
        relation: "confirm",
        subjectCardId: 27,
        operatorCardId: 33,
        subjectModeId: "written_message",
        operatorModeId: "confirmation_certainty",
        evidenceCode: "OVERRIDE_LETTER_KEY_DOCUMENT_CONFIRMED"
      }
    }
  ];

  const results = cases.map(assertCase);
  assert.notDeepEqual(stableSnapshot(results[0]).primaryRelation, stableSnapshot(results[1]).primaryRelation);
  assert.notDeepEqual(stableSnapshot(results[2]).primaryRelation, stableSnapshot(results[3]).primaryRelation);
  assert.notDeepEqual(stableSnapshot(results[4]).primaryRelation, stableSnapshot(results[5]).primaryRelation);
  assert.notDeepEqual(stableSnapshot(results[6]).primaryRelation, stableSnapshot(results[7]).primaryRelation);
});

test("V2 P0_REVISE characterization records mode-sensitive Book/Person behavior", () => {
  const q = context("这个人是什么情况？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "person", label: "这个人" },
    intent: "description"
  });
  const descriptorModes = [
    { mode: "unknown_information", relation: "describe", informationState: "unknown" },
    { mode: "knowledge_learning", relation: "describe", informationState: undefined },
    { mode: "research_investigation", relation: "associate", informationState: undefined },
    { mode: "secret_hidden", relation: "describe", informationState: "hidden" }
  ] as const;
  const nonDescriptorModes = ["project_case", "exam_assessment", "physical_book_record"];
  const personCards = [
    { id: 28, mode: "male_person_anchor" },
    { id: 29, mode: "female_person_anchor" }
  ];

  for (const person of personCards) {
    for (const bookMode of descriptorModes) {
      const bookPerson = pair(q, 26, person.id, { left: bookMode.mode, right: person.mode });
      assert.equal(bookPerson.primaryRelation.relation, bookMode.relation);
      if (bookMode.relation === "describe") {
        assert.equal(bookPerson.primaryRelation.subjectCardId, person.id);
        assert.equal(bookPerson.primaryRelation.subjectModeId, person.mode);
      } else {
        assert.equal(bookPerson.primaryRelation.subjectCardId, 26);
        assert.equal(bookPerson.primaryRelation.subjectModeId, bookMode.mode);
        assert.equal(bookPerson.primaryRelation.operatorCardId, person.id);
        assert.equal(bookPerson.primaryRelation.operatorModeId, person.mode);
      }
      if (bookMode.relation === "describe") assert.equal(bookPerson.primaryRelation.operatorModeId, bookMode.mode);
      assert.equal(bookPerson.primaryRelation.semanticResult.informationState, bookMode.informationState);
      assert.equal(getCardLexiconEntry(person.id)?.semanticAgency, "passive_anchor");
      assertDeterministic(() => pair(q, 26, person.id, { left: bookMode.mode, right: person.mode }));

      const personBook = pair(q, person.id, 26, { left: person.mode, right: bookMode.mode });
      assert.equal(personBook.primaryRelation.relation, bookMode.relation);
      if (bookMode.relation === "describe") assert.equal(personBook.primaryRelation.subjectCardId, person.id);
      assert.equal(personBook.primaryRelation.subjectModeId, person.mode);
      assert.equal(personBook.primaryRelation.operatorModeId, bookMode.mode);
      assert.equal(personBook.primaryRelation.semanticResult.informationState, bookMode.informationState);
      assert.equal(getCardLexiconEntry(person.id)?.semanticAgency, "passive_anchor");
      assertDeterministic(() => pair(q, person.id, 26, { left: person.mode, right: bookMode.mode }));
    }

    for (const bookMode of nonDescriptorModes) {
      const bookPerson = pair(q, 26, person.id, { left: bookMode, right: person.mode });
      assert.notEqual(bookPerson.primaryRelation.relation, "describe");
      if (bookMode === "project_case") assert.notEqual(bookPerson.primaryRelation.subjectCardId, person.id);
      assert.equal(bookPerson.primaryRelation.semanticResult.personEffect, undefined);
      assert.equal(getCardLexiconEntry(person.id)?.semanticAgency, "passive_anchor");
      assertDeterministic(() => pair(q, 26, person.id, { left: bookMode, right: person.mode }));

      const personBook = pair(q, person.id, 26, { left: person.mode, right: bookMode });
      assert.notEqual(personBook.primaryRelation.relation, "describe");
      assert.equal(personBook.primaryRelation.semanticResult.personEffect, undefined);
      assert.equal(getCardLexiconEntry(person.id)?.semanticAgency, "passive_anchor");
      assertDeterministic(() => pair(q, person.id, 26, { left: person.mode, right: bookMode }));
    }
  }
});

test("V2 P0_REVISE spec: Book/Person descriptors must be mode-sensitive", () => {
  const q = context("这个人是什么情况？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "person", label: "这个人" },
    intent: "description"
  });
  const unknownBookMan = pair(q, 26, 28, { left: "unknown_information", right: "male_person_anchor" });
  assert.equal(unknownBookMan.primaryRelation.relation, "describe");
  assert.equal(unknownBookMan.primaryRelation.subjectCardId, 28);
  assert.equal(unknownBookMan.primaryRelation.operatorModeId, "unknown_information");

  const knowledgeBookMan = pair(q, 26, 28, { left: "knowledge_learning", right: "male_person_anchor" });
  assert.equal(knowledgeBookMan.primaryRelation.relation, "describe");
  assert.equal(knowledgeBookMan.primaryRelation.subjectCardId, 28);
  assert.notEqual(knowledgeBookMan.primaryRelation.operatorModeId, "unknown_information");
  assert.notEqual(knowledgeBookMan.primaryRelation.semanticResult.informationState, "unknown");

  const projectBookMan = pair(q, 26, 28, { left: "project_case", right: "male_person_anchor" });
  assert.notEqual(projectBookMan.primaryRelation.relation, "describe");
  assert.notEqual(projectBookMan.primaryRelation.subjectCardId, 28);

  const secretBookWoman = pair(q, 26, 29, { left: "secret_hidden", right: "female_person_anchor" });
  assert.equal(secretBookWoman.primaryRelation.relation, "describe");
  assert.equal(secretBookWoman.primaryRelation.subjectCardId, 29);
  assert.equal(secretBookWoman.primaryRelation.semanticResult.informationState, "hidden");

  const researchWomanBook = pair(q, 29, 26, { left: "female_person_anchor", right: "research_investigation" });
  assert.equal(researchWomanBook.primaryRelation.relation, "associate");
  assert.equal(researchWomanBook.primaryRelation.subjectCardId, 29);
});

test("V2 P0_REVISE characterization records current Mountain/Letter direction", () => {
  const q = context("这份文件会卡住吗？", {
    domain: "career",
    primaryTopic: "communication",
    object: { type: "document", label: "文件" },
    intent: "outcome"
  });
  const letterMountain = pair(q, 27, 21);
  const mountainLetter = pair(q, 21, 27);

  assert.equal(letterMountain.primaryRelation.relation, "block");
  assert.equal(letterMountain.primaryRelation.subjectCardId, 27);
  assert.equal(letterMountain.primaryRelation.operatorCardId, 21);
  assert.equal(letterMountain.primaryRelation.subjectModeId, "written_message");
  assert.equal(letterMountain.primaryRelation.operatorModeId, "delay");

  assert.equal(mountainLetter.primaryRelation.relation, "communicate");
  assert.equal(mountainLetter.primaryRelation.subjectCardId, 21);
  assert.equal(mountainLetter.primaryRelation.operatorCardId, 27);
  assert.equal(mountainLetter.primaryRelation.subjectModeId, "blockage_obstacle");
  assert.equal(mountainLetter.primaryRelation.operatorModeId, "written_message");
  assert.equal(mountainLetter.primaryRelation.semanticResult.stateChange, "block");
  assert.equal(mountainLetter.primaryRelation.semanticResult.informationState, "written");
  assert.notDeepEqual(stableSnapshot(letterMountain).primaryRelation, stableSnapshot(mountainLetter).primaryRelation);
  assertDeterministic(() => pair(q, 27, 21));
  assertDeterministic(() => pair(q, 21, 27));
});

test("V2 P0_REVISE spec: Mountain > Letter must not collapse into Letter > Mountain", () => {
  const q = context("这份文件会卡住吗？", {
    domain: "career",
    primaryTopic: "communication",
    object: { type: "document", label: "文件" },
    intent: "outcome"
  });
  const letterMountain = pair(q, 27, 21);
  const mountainLetter = pair(q, 21, 27);

  assert.equal(letterMountain.primaryRelation.relation, "block");
  assert.equal(letterMountain.primaryRelation.subjectCardId, 27);
  assert.equal(letterMountain.primaryRelation.operatorCardId, 21);

  assert.notEqual(mountainLetter.primaryRelation.relation, "block");
  assert.equal(mountainLetter.primaryRelation.subjectCardId, 21);
  assert.equal(mountainLetter.primaryRelation.operatorCardId, 27);
  assert.notEqual(mountainLetter.primaryRelation.semanticResult.stateChange, "delay");
});

test("V2 P0_NEW characterization probes Rider/Mountain and Snake/Ring without changing behavior", () => {
  const communication = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    object: { type: "message", label: "消息" },
    intent: "outcome"
  });
  const riderMountain = pair(communication, 1, 21);
  const mountainRider = pair(communication, 21, 1);
  assert.equal(riderMountain.primaryRelation.relation, "block");
  assert.equal(riderMountain.primaryRelation.subjectCardId, 1);
  assert.equal(riderMountain.primaryRelation.operatorCardId, 21);
  assert.equal(mountainRider.primaryRelation.relation, "sequence");
  assert.equal(mountainRider.primaryRelation.subjectCardId, 21);
  assert.equal(mountainRider.primaryRelation.operatorCardId, 1);
  assertDeterministic(() => pair(communication, 1, 21));
  assertDeterministic(() => pair(communication, 21, 1));

  const trust = context("这段关系有没有信任风险？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "relationship", label: "关系" },
    intent: "state"
  });
  const snakeRing = pair(trust, 7, 25);
  const ringSnake = pair(trust, 25, 7);
  const serialized = JSON.stringify([snakeRing, ringSnake]);
  assert.ok(!serialized.includes("infidelity_confirmed"));
  assert.ok(!serialized.includes("cheating_confirmed"));
  assert.ok(!serialized.includes("confirmed_affair"));
  assertDeterministic(() => pair(trust, 7, 25));
  assertDeterministic(() => pair(trust, 25, 7));
});

test("V2 P0_NEW spec: Rider/Mountain preserves ordered direction while Snake/Ring stays safety-only", () => {
  const communication = context("三天内会收到消息吗？", {
    domain: "relationship",
    primaryTopic: "communication",
    object: { type: "message", label: "消息" },
    intent: "outcome"
  });
  const riderMountain = pair(communication, 1, 21);
  const mountainRider = pair(communication, 21, 1);
  assert.equal(riderMountain.primaryRelation.subjectCardId, 1);
  assert.equal(riderMountain.primaryRelation.operatorCardId, 21);
  assert.equal(mountainRider.primaryRelation.subjectCardId, 21);
  assert.equal(mountainRider.primaryRelation.operatorCardId, 1);

  const trust = context("这段关系有没有信任风险？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "relationship", label: "关系" },
    intent: "state"
  });
  const snakeRing = pair(trust, 7, 25);
  const ringSnake = pair(trust, 25, 7);
  const serialized = JSON.stringify([snakeRing, ringSnake]);
  assert.ok(!serialized.includes("infidelity_confirmed"));
  assert.ok(!serialized.includes("cheating_confirmed"));
  assert.ok(!serialized.includes("confirmed_affair"));
});

test("V2 behavior guards characterize Coffin direction without adding overrides", () => {
  const q = context("这个问题能解决吗？", {
    domain: "general",
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "问题" },
    intent: "outcome"
  });
  const mountainCoffin = pair(q, 21, 8);
  assert.equal(mountainCoffin.primaryRelation.relation, "end");
  assert.equal(mountainCoffin.primaryRelation.subjectCardId, 21);
  assert.equal(mountainCoffin.primaryRelation.operatorCardId, 8);
  assert.equal(mountainCoffin.primaryRelation.semanticResult.stateChange, "end");
  assert.equal(mountainCoffin.primaryRelation.semanticResult.headConcept, mountainCoffin.primaryRelation.subjectModeId);
  assert.ok(mountainCoffin.primaryRelation.evidence.some((evidence) => evidence.source === "special_behavior"));

  const coffinSun = pair(q, 8, 31);
  assert.equal(coffinSun.primaryRelation.relation, "sequence");
  assert.equal(coffinSun.primaryRelation.subjectCardId, 8);
  assert.equal(coffinSun.primaryRelation.operatorCardId, 31);
  assert.equal(coffinSun.primaryRelation.semanticResult.stateChange, "change");
  assert.notEqual(coffinSun.primaryRelation.subjectModeId, "success_achievement");
  assert.notEqual(coffinSun.primaryRelation.operatorModeId, "end_closure");
  assert.ok(coffinSun.primaryRelation.evidence.some((evidence) => evidence.code === "BEHAVIOR_COFFIN_LEFT_SEQUENCE"));
  assertDeterministic(() => pair(q, 21, 8));
  assertDeterministic(() => pair(q, 8, 31));
});

test("V2 SpecialBehavior sufficiency characterization for Mice and Anchor candidates", () => {
  const q = context("这段关系后续怎么样？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "relationship", label: "关系" },
    intent: "development"
  });
  const checks = [
    { left: 24, right: 23, relation: "erode", subject: 24, operator: 23, classification: "BEHAVIOR_SUFFICIENT" },
    { left: 23, right: 24, relation: "erode", subject: 24, operator: 23, classification: "BEHAVIOR_SUFFICIENT" },
    { left: 24, right: 35, relation: "stabilize", subject: 24, operator: 35, classification: "BEHAVIOR_SUFFICIENT" },
    { left: 35, right: 24, relation: "stabilize", subject: 24, operator: 35, classification: "BEHAVIOR_SUFFICIENT" },
    { left: 25, right: 35, relation: "stabilize", subject: 25, operator: 35, classification: "BEHAVIOR_SUFFICIENT" },
    { left: 35, right: 25, relation: "stabilize", subject: 25, operator: 35, classification: "BEHAVIOR_SUFFICIENT" }
  ] satisfies Array<{ left: number; right: number; relation: PairRelationType; subject: number; operator: number; classification: Classification }>;

  for (const item of checks) {
    const result = pair(q, item.left, item.right);
    assert.equal(result.primaryRelation.relation, item.relation);
    assert.equal(result.primaryRelation.subjectCardId, item.subject);
    assert.equal(result.primaryRelation.operatorCardId, item.operator);
    assert.ok(result.primaryRelation.evidence.some((evidence) => evidence.source === "special_behavior" || evidence.source === "pair_override"));
    assert.equal(item.classification, "BEHAVIOR_SUFFICIENT");
    assertDeterministic(() => pair(q, item.left, item.right));
  }
});

test("V2 spec failures localize Mice-left and Anchor-left reverse behavior", () => {
  const q = context("这段关系后续怎么样？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "relationship", label: "关系" },
    intent: "development"
  });

  const miceHeart = pair(q, 23, 24);
  assert.equal(miceHeart.primaryRelation.relation, "erode");
  assert.equal(miceHeart.primaryRelation.subjectCardId, 24);
  assert.equal(miceHeart.primaryRelation.operatorCardId, 23);

  const anchorHeart = pair(q, 35, 24);
  assert.equal(anchorHeart.primaryRelation.relation, "stabilize");
  assert.equal(anchorHeart.primaryRelation.subjectCardId, 24);
  assert.equal(anchorHeart.primaryRelation.operatorCardId, 35);

  const anchorRing = pair(q, 35, 25);
  assert.equal(anchorRing.primaryRelation.relation, "stabilize");
  assert.equal(anchorRing.primaryRelation.subjectCardId, 25);
  assert.equal(anchorRing.primaryRelation.operatorCardId, 35);

  const miceFish = pair(q, 23, 34, { left: "loss_depletion", right: "cashflow_circulation" });
  assert.equal(miceFish.primaryRelation.relation, "erode");
  assert.equal(miceFish.primaryRelation.subjectCardId, 34);
  assert.equal(miceFish.primaryRelation.operatorCardId, 23);
  assert.equal(miceFish.primaryRelation.semanticResult.stateChange, "decrease");

  const miceBook = pair(q, 23, 26, { left: "erosion_diminishment", right: "knowledge_learning" });
  assert.equal(miceBook.primaryRelation.relation, "erode");
  assert.equal(miceBook.primaryRelation.subjectCardId, 26);
  assert.equal(miceBook.primaryRelation.operatorCardId, 23);
  assert.notEqual(miceBook.primaryRelation.semanticResult.informationState, "hidden");

  const anchorFish = pair(q, 35, 34, { left: "fixed_stagnation", right: "cashflow_circulation" });
  assert.equal(anchorFish.primaryRelation.relation, "stabilize");
  assert.equal(anchorFish.primaryRelation.subjectCardId, 34);
  assert.equal(anchorFish.primaryRelation.operatorCardId, 35);
  assert.equal(anchorFish.primaryRelation.operatorModeId, "fixed_stagnation");
  assert.equal(anchorFish.primaryRelation.semanticResult.stateChange, "stabilize");

  const anchorBook = pair(q, 35, 26, { left: "stability_security", right: "project_case" });
  assert.equal(anchorBook.primaryRelation.relation, "stabilize");
  assert.equal(anchorBook.primaryRelation.subjectCardId, 26);
  assert.equal(anchorBook.primaryRelation.operatorCardId, 35);
  assert.equal(anchorBook.primaryRelation.operatorModeId, "stability_security");
});
