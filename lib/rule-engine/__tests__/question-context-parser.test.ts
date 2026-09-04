import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionContext } from "../parser";
import { validateQuestionContext } from "../schema";

const fixtures = [
  "他喜欢我吗？",
  "他为什么不联系我？",
  "他三天内会主动联系我吗？",
  "我们会确定关系吗？",
  "他怎么看我？",
  "我能拿到 offer 吗？",
  "老板怎么看我？",
  "我要不要辞职？",
  "未来职业方向如何？",
  "我考试能过吗？",
  "我的论文为什么一直写不完？",
  "申请结果如何？",
  "这笔款什么时候到账？",
  "我的收入会增加吗？",
  "我的耳机在哪里？",
  "还能找回来吗？"
];

test("all parser fixtures produce valid QuestionContext objects", () => {
  for (const question of fixtures) {
    const context = parseQuestionContext(question);
    const result = validateQuestionContext(context);
    assert.equal(result.success, true, `${question}: ${result.issues.join("; ")}`);
  }
});

test("explicit contact question separates action intent, yes/no mode, timeframe, and action frame", () => {
  const context = parseQuestionContext("他三天内会主动联系我吗？");

  assert.equal(context.domain, "relationship");
  assert.equal(context.primaryTopic, "communication");
  assert.equal(context.intent, "action");
  assert.equal(context.answerMode, "yes_no");
  assert.equal(context.timeframe.scope, "explicit");
  assert.equal(context.timeframe.relation, "within");
  assert.equal(context.timeframe.value, 3);
  assert.equal(context.timeframe.unit, "day");
  assert.equal(context.actionFrame?.actorPersonId, "counterparty");
  assert.equal(context.actionFrame?.recipientPersonId, "self");
  assert.equal(context.actionFrame?.action, "contact");
  assert.equal(context.perspective, undefined);
});

test("feelings question is not parsed as outcome or commitment", () => {
  const context = parseQuestionContext("他喜欢我吗？");

  assert.equal(context.intent, "feelings_attitude");
  assert.equal(context.answerMode, "yes_no");
  assert.notEqual(context.intent, "outcome");
  assert.notEqual(context.primaryTopic, "commitment");
});

test("payment arrival question uses timing intent while timeframe remains separate", () => {
  const context = parseQuestionContext("这笔款什么时候到账？");

  assert.equal(context.domain, "money");
  assert.equal(context.primaryTopic, "transaction");
  assert.equal(context.intent, "timing");
  assert.equal(context.answerMode, "open");
  assert.equal(context.timeframe.scope, "open");
  assert.equal(context.timeframe.normalized?.horizonClass, "open");
});

test("boss attitude question creates perspective rather than action frame", () => {
  const context = parseQuestionContext("老板怎么看我？");

  assert.equal(context.domain, "career");
  assert.equal(context.intent, "feelings_attitude");
  assert.equal(context.perspective?.subjectPersonId, "boss");
  assert.equal(context.perspective?.objectPersonId, "self");
  assert.equal(context.actionFrame, undefined);
});

test("people parsing does not infer partner from gendered pronouns", () => {
  const context = parseQuestionContext("他喜欢我吗？");
  const counterparty = context.people.find((person) => person.id === "counterparty");

  assert.equal(counterparty?.genderHint, "male");
  assert.deepEqual(counterparty?.relations, ["unknown_person"]);
  assert.equal(counterparty?.role, "counterparty");
});

test("Phase 6.1 parser classifies resolution questions as outcome without merging yes/no into intent", () => {
  const context = parseQuestionContext("这个问题能解决吗？");

  assert.equal(context.domain, "general");
  assert.equal(context.intent, "outcome");
  assert.equal(context.answerMode, "yes_no");
});

test("Phase 6.1 parser treats thesis biggest-problem question as study project obstacle", () => {
  const context = parseQuestionContext("我的论文现在最大的问题是什么？");

  assert.equal(context.domain, "study");
  assert.equal(context.primaryTopic, "academic_project");
  assert.equal(context.intent, "obstacle");
  assert.equal(context.object.type, "project");
});

test("Stage 2.1 money good-news questions keep money domain before message wording", () => {
  const cases = [
    ["未来一个月财运会有好消息发生吗", "cashflow", 1, "month"],
    ["未来2周会有来自财富上的好消息发生吗", "cashflow", 2, "week"],
    ["这个月财运怎么样", "cashflow", 1, "month"],
    ["最近会有进账吗", "income", undefined, undefined],
    ["近期会有额外收入吗", "income", undefined, undefined]
  ] as const;

  for (const [question, topic, value, unit] of cases) {
    const context = parseQuestionContext(question);
    assert.equal(context.domain, "money", question);
    assert.equal(context.primaryTopic, topic, question);
    assert.equal(context.object.type, "money", question);
    assert.notEqual(context.primaryTopic, "communication", question);
    assert.notEqual(context.object.type, "message", question);
    if (question.includes("会有") || question.includes("发生") || question.includes("进账") || question.includes("额外收入")) {
      assert.equal(context.intent, "outcome", question);
    }
    if (question.includes("吗")) assert.equal(context.answerMode, "yes_no", question);
    if (value && unit) {
      assert.equal(context.timeframe.scope, "explicit", question);
      assert.equal(context.timeframe.value, value, question);
      assert.equal(context.timeframe.unit, unit, question);
    }
  }
});

test("Stage 2.1 payment timing remains money timing and separate from timeframe", () => {
  const context = parseQuestionContext("这笔钱什么时候到账");

  assert.equal(context.domain, "money");
  assert.equal(context.primaryTopic, "transaction");
  assert.equal(context.intent, "timing");
  assert.equal(context.object.type, "payment");
  assert.equal(context.answerMode, "open");
  assert.equal(context.timeframe.scope, "open");
});

test("Stage 2.1 good-news wording does not decide domain by itself", () => {
  const career = parseQuestionContext("工作会有好消息吗");
  assert.equal(career.domain, "career");
  assert.equal(career.intent, "outcome");
  assert.notEqual(career.primaryTopic, "communication");
  assert.notEqual(career.object.type, "message");

  const study = parseQuestionContext("考试会有好消息吗");
  assert.equal(study.domain, "study");
  assert.equal(study.intent, "outcome");
  assert.notEqual(study.primaryTopic, "communication");
  assert.notEqual(study.object.type, "message");

  const relationship = parseQuestionContext("感情会有好消息吗");
  assert.equal(relationship.domain, "relationship");
  assert.equal(relationship.intent, "outcome");
  assert.notEqual(relationship.object.type, "message");
});

test("Stage 2.1 actual contact and message questions still parse as communication", () => {
  const cases = [
    "他会给我发消息吗",
    "会收到通知吗",
    "对方会联系我吗",
    "他会回我微信吗"
  ];

  for (const question of cases) {
    const context = parseQuestionContext(question);
    assert.equal(context.primaryTopic, "communication", question);
    assert.equal(context.object.type, "message", question);
    assert.equal(context.answerMode, "yes_no", question);
  }
});

test("Stage 2.1 new relationship questions parse as relationship outcome without invented counterparty", () => {
  const cases = [
    ["我今年会谈恋爱吗", 1, "year"],
    ["今年会遇到对象吗", 1, "year"],
    ["未来三个月会开始一段关系吗", 3, "month"]
  ] as const;

  for (const [question, value, unit] of cases) {
    const context = parseQuestionContext(question);
    assert.equal(context.domain, "relationship", question);
    assert.equal(context.primaryTopic, "new_relationship", question);
    assert.equal(context.intent, "outcome", question);
    assert.equal(context.object.type, "relationship", question);
    assert.equal(context.answerMode, "yes_no", question);
    assert.equal(context.timeframe.scope, "explicit", question);
    assert.equal(context.timeframe.value, value, question);
    assert.equal(context.timeframe.unit, unit, question);
    assert.deepEqual(
      context.people.map((person) => person.id),
      ["self"],
      question
    );
  }
});

test("Stage 2.1 health-like outcome questions do not enter relationship domain", () => {
  const cases = [
    ["我的脓肿这周能好吗", "outcome", 1, "week"],
    ["这个症状这几天会缓解吗", "outcome", 3, "day"],
    ["身体状态这周会改善吗", "outcome", 1, "week"]
  ] as const;

  for (const [question, intent, value, unit] of cases) {
    const context = parseQuestionContext(question);
    assert.equal(context.domain, "general", question);
    assert.equal(context.primaryTopic, "wellbeing", question);
    assert.equal(context.intent, intent, question);
    assert.equal(context.object.type, "other", question);
    assert.equal(context.answerMode, "yes_no", question);
    assert.equal(context.timeframe.scope, "explicit", question);
    assert.equal(context.timeframe.value, value, question);
    assert.equal(context.timeframe.unit, unit, question);
  }
});

test("Stage 2.1 generic outcome expressions prefer outcome over state", () => {
  for (const question of ["这个问题会好吗", "这个事情会发生吗", "最后会有结果吗"]) {
    const context = parseQuestionContext(question);
    assert.equal(context.intent, "outcome", question);
    assert.notEqual(context.domain, "relationship", question);
  }
});
