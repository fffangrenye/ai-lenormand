import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionContext } from "../parser";
import { preselectCardMeaning } from "../preselection";
import { validatePreselectedCardMeaning } from "../preselection-schema";
import { getCardLexiconEntry } from "../lexicon";
import { PersonContext, QuestionContext } from "../ontology";

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

function person(input: Partial<PersonContext> & Pick<PersonContext, "id" | "label">): PersonContext {
  return {
    role: "counterparty",
    relations: ["unknown_person"],
    genderHint: "unknown",
    knownStatus: "unclear",
    isPrimary: true,
    ...input
  };
}

function select(cardId: number, question: QuestionContext) {
  const card = getCardLexiconEntry(cardId);
  assert.ok(card, `Missing card ${cardId}`);
  const result = preselectCardMeaning({ question, card });
  const validation = validatePreselectedCardMeaning(result.meaning);
  assert.equal(validation.success, true, validation.issues.join("\n"));
  return result;
}

function modes(cardId: number, question: QuestionContext) {
  return select(cardId, question).meaning.candidates;
}

function relevance(cardId: number, question: QuestionContext, modeId: string) {
  return modes(cardId, question).find((candidate) => candidate.modeId === modeId)?.relevance;
}

test("Fox context switches between career employment and relationship trust without deleting core warning", () => {
  const career = context("这份工作后续怎么样？", {
    domain: "career",
    primaryTopic: "current_job",
    object: { type: "job", label: "这份工作" },
    intent: "development"
  });
  const careerModes = modes(14, career);
  assert.equal(careerModes[0].modeId, "employment");
  assert.ok(["dominant", "strong"].includes(careerModes[0].relevance));
  assert.ok(careerModes.some((candidate) => ["wrong_warning", "deception_suspicion"].includes(candidate.modeId)));
  assert.ok(!careerModes.some((candidate) => candidate.blocked));

  const trust = context("他是不是在骗我？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "person", label: "他" },
    intent: "state"
  });
  const trustModes = modes(14, trust);
  assert.ok(["deception_suspicion", "wrong_warning"].includes(trustModes[0].modeId));
  assert.ok(["dominant", "strong"].includes(trustModes[0].relevance));
  assert.notEqual(trustModes[0].modeId, "employment");
});

test("Book switches between study project and relationship unknown information without merging unknown and secret", () => {
  const study = context("我的论文为什么一直写不完？", {
    domain: "study",
    primaryTopic: "academic_project",
    object: { type: "project", label: "论文" },
    intent: "reason"
  });
  const studyModes = modes(26, study);
  assert.ok(studyModes.some((candidate) => candidate.modeId === "project_case"));
  assert.ok(studyModes.some((candidate) => ["knowledge_learning", "research_investigation"].includes(candidate.modeId)));
  assert.ok((studyModes.find((candidate) => candidate.modeId === "project_case")?.internalScore ?? 0) > (studyModes.find((candidate) => candidate.modeId === "unknown_information")?.internalScore ?? -1));

  const relationship = context("他现在对我还有什么没说的吗？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "message", label: "没说的信息" },
    intent: "state"
  });
  const relationshipModes = modes(26, relationship);
  assert.ok(relationshipModes.some((candidate) => candidate.modeId === "unknown_information"));
  assert.ok(relationshipModes.some((candidate) => candidate.modeId === "secret_hidden"));
  assert.notEqual(relationshipModes[0].modeId, "project_case");
});

test("Whip activates editing in study and gates sexuality to explicit intimacy", () => {
  const editing = context("我的论文该怎么改？", {
    domain: "study",
    primaryTopic: "academic_project",
    object: { type: "document", label: "论文" },
    intent: "advice"
  });
  const editingModes = modes(11, editing);
  assert.equal(editingModes[0].modeId, "editing_revision_research");
  assert.ok(["dominant", "strong"].includes(editingModes[0].relevance));
  assert.ok(!editingModes.some((candidate) => candidate.modeId === "sexuality"));

  const intimacy = context("我们的亲密关系后续怎么样？", {
    domain: "relationship",
    primaryTopic: "intimacy",
    object: { type: "relationship", label: "亲密关系" },
    intent: "development"
  });
  const intimacyModes = modes(11, intimacy);
  assert.ok(intimacyModes.some((candidate) => candidate.modeId === "sexuality"));
  assert.ok(["dominant", "strong", "possible"].includes(relevance(11, intimacy, "sexuality") ?? ""));
});

test("Moon switches between career, feelings, and timing contexts", () => {
  const career = context("未来职业方向如何？", {
    domain: "career",
    primaryTopic: "career_direction",
    object: { type: "job", label: "职业方向" },
    intent: "development"
  });
  assert.equal(modes(32, career)[0].modeId, "career_vocation");
  assert.ok(!["dominant", "strong"].includes(relevance(32, career, "emotion_attraction") ?? ""));

  const feelings = context("他喜欢我吗？", {
    domain: "relationship",
    primaryTopic: "feelings_attraction",
    object: { type: "person", label: "他" },
    intent: "feelings_attitude"
  });
  assert.equal(modes(32, feelings)[0].modeId, "emotion_attraction");
  assert.ok(!["dominant", "strong"].includes(relevance(32, feelings, "career_vocation") ?? ""));

  const timing = context("什么时候会收到结果？", {
    intent: "timing",
    object: { type: "event", label: "收到结果" }
  });
  const timingModes = modes(32, timing).map((candidate) => candidate.modeId);
  assert.ok(timingModes.includes("cycle_phase"));
  assert.ok(timingModes.includes("night_month"));
});

test("Snake and Crossroads third-party modes stay pending for neighbor resolution", () => {
  const trust = context("他是不是有第三方？", {
    domain: "relationship",
    primaryTopic: "trust_exclusivity",
    object: { type: "person", label: "第三方" },
    intent: "state"
  });
  for (const [cardId, modeId] of [
    [7, "third_party_factor"],
    [22, "third_party_or_multiple_interest"]
  ] as const) {
    const result = select(cardId, trust).meaning;
    const pending = result.candidates.find((candidate) => candidate.modeId === modeId);
    assert.ok(pending);
    assert.equal(pending.requiresNeighborResolution, true);
    assert.equal(pending.relevance, "possible");
    assert.equal(result.unresolved, true);
  }
});

test("Dog, Child, Bear, Lily, Ring, and Anchor preserve their key context behaviors", () => {
  const knownPerson = context("我的下一任是我已经认识的人吗？", {
    domain: "relationship",
    primaryTopic: "new_relationship",
    object: { type: "person", label: "下一任" },
    intent: "description",
    people: [
      person({ id: "self", label: "我", role: "querent", relations: ["self"], knownStatus: "known" }),
      person({ id: "known_person", label: "认识的人", relations: ["unknown_person"], knownStatus: "known" })
    ]
  });
  assert.ok(["friend_known_person", "familiarity"].includes(modes(18, knownPerson)[0].modeId));

  const project = context("这个项目后续会怎么样？", {
    domain: "career",
    primaryTopic: "project_work",
    object: { type: "project", label: "项目" },
    intent: "development"
  });
  assert.ok(modes(13, project).some((candidate) => ["new_beginning", "early_stage", "small_scale"].includes(candidate.modeId)));
  assert.ok(!modes(13, project).some((candidate) => candidate.modeId === "literal_child"));

  const boss = context("老板怎么看我？", {
    domain: "career",
    primaryTopic: "workplace_relationship",
    object: { type: "person", label: "老板" },
    intent: "feelings_attitude",
    people: [person({ id: "boss", label: "老板", relations: ["boss"], knownStatus: "known" })]
  });
  assert.ok(["authority_leader", "power_strength"].includes(modes(15, boss)[0].modeId));

  const assets = context("我的资产未来一年怎么样？", {
    domain: "money",
    primaryTopic: "assets",
    object: { type: "money", label: "资产" },
    intent: "development"
  });
  assert.equal(modes(15, assets)[0].modeId, "financial_assets");

  const relationship = context("普通关系后续怎么样？", {
    domain: "relationship",
    primaryTopic: "relationship_state",
    object: { type: "relationship", label: "普通关系" },
    intent: "development"
  });
  assert.ok(modes(30, relationship).some((candidate) => ["maturity_experience", "peace_calm", "long_duration"].includes(candidate.modeId)));
  assert.ok(!modes(30, relationship).some((candidate) => candidate.modeId === "sexuality"));

  const commitment = context("我们会确定关系吗？", {
    domain: "relationship",
    primaryTopic: "commitment",
    object: { type: "relationship", label: "确定关系" },
    intent: "outcome"
  });
  assert.equal(modes(25, commitment)[0].modeId, "commitment_bond");

  const contract = context("这个合同后续怎么样？", {
    domain: "career",
    primaryTopic: "contract_employment",
    object: { type: "contract", label: "合同" },
    intent: "development"
  });
  assert.equal(modes(25, contract)[0].modeId, "agreement_contract");

  const cycle = context("为什么这个问题一直重复？", {
    domain: "general",
    primaryTopic: "general_development",
    object: { type: "event", label: "重复问题" },
    intent: "reason"
  });
  assert.ok(modes(25, cycle).some((candidate) => candidate.modeId === "cycle_repetition"));

  const stability = context("这件事会稳定吗？", {
    primaryTopic: "general_state",
    object: { type: "event", label: "稳定" },
    intent: "outcome"
  });
  assert.equal(modes(35, stability)[0].modeId, "stability_security");

  const stagnation = context("为什么一直没变化？", {
    primaryTopic: "conflict_obstacle",
    object: { type: "event", label: "没变化" },
    intent: "reason"
  });
  assert.ok(modes(35, stagnation).some((candidate) => candidate.modeId === "fixed_stagnation"));
});

test("Birds timeframe and lost-item preferred plane are deterministic", () => {
  const short = context("他三天内会主动联系我吗？");
  assert.equal(select(12, short).meaning.preferredPlane, "action");
  assert.ok(["oral_communication", "call_live_contact", "busyness_chatter"].includes(modes(12, short)[0].modeId));

  const long = context("未来一年这件事会不会让我很焦虑？", {
    timeframe: {
      scope: "explicit",
      relation: "within",
      value: 1,
      unit: "year",
      anchor: "now",
      precision: "bounded",
      sourceText: "未来一年",
      normalized: { horizonClass: "extended", approximateDays: 365 }
    },
    intent: "development"
  });
  assert.ok(modes(12, long).some((candidate) => candidate.modeId === "nervousness_anxiety"));

  const lost = context("我的耳机在哪里？");
  const house = select(4, lost).meaning;
  assert.equal(house.preferredPlane, "location");
  assert.equal(house.candidates[0].modeId, "home_residence");
});

test("preselection is deterministic and emits safe debug trace without raw question", () => {
  const q = context("这份工作后续怎么样？", {
    domain: "career",
    primaryTopic: "current_job",
    object: { type: "job", label: "这份工作" },
    intent: "development"
  });
  const first = select(14, q);
  const second = select(14, q);
  assert.deepEqual(first.meaning, second.meaning);
  assert.ok(first.debugTrace.steps.length > 0);
  assert.ok(first.debugTrace.steps.some((step) => step.stage === "context_overrides"));
  assert.ok(!JSON.stringify(first.debugTrace).includes("这份工作"));
});
