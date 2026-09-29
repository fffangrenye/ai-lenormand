import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { RuleEngineError } from "../rule-engine-errors";
import { RULE_ENGINE_SCHEMA_VERSION, RULE_ENGINE_VERSION } from "../rule-engine-version";
import { runRuleEngineReading } from "../pipeline";
import { getCardLexiconEntry } from "../lexicon";

type Fixture = {
  name: string;
  question: string;
  cardIds: number[];
  spreadSize: 3 | 5;
};

const goldenFixtures: Fixture[] = [
  { name: "GR-E2E-01", question: "他喜欢我吗？", cardIds: [24, 6, 25], spreadSize: 3 },
  { name: "GR-E2E-02", question: "他会主动联系我吗？", cardIds: [24, 25, 35], spreadSize: 3 },
  { name: "GR-E2E-03", question: "我们会复合吗？", cardIds: [1, 27, 12], spreadSize: 3 },
  { name: "GR-E2E-04", question: "这个问题能解决吗？", cardIds: [21, 8, 31], spreadSize: 3 },
  { name: "GR-E2E-05", question: "三天内会收到消息吗？", cardIds: [1, 27, 33], spreadSize: 3 },
  { name: "GR-E2E-06", question: "一周内能有明显进展吗？", cardIds: [26, 5, 35], spreadSize: 3 },
  { name: "GR-E2E-07", question: "半年内这个状态会不会改变？", cardIds: [21, 35, 5], spreadSize: 3 },
  { name: "GR-E2E-08", question: "这段关系接下来怎么发展？", cardIds: [24, 25, 6, 27, 33], spreadSize: 5 },
  { name: "GR-E2E-09", question: "我的论文现在最大的问题是什么？", cardIds: [34, 26, 11, 13, 20], spreadSize: 5 },
  { name: "GR-E2E-10", question: "他是不是有第三方？", cardIds: [7, 20, 22], spreadSize: 3 },
  { name: "GR-E2E-11", question: "我会怀孕吗？", cardIds: [17, 13, 24], spreadSize: 3 },
  { name: "GR-E2E-12", question: "这个男人和这个女人是什么情况？", cardIds: [28, 26, 29], spreadSize: 3 }
];

const determinismFixtures: Fixture[] = [
  ...goldenFixtures,
  { name: "DET-13", question: "他三天内会主动联系我吗？", cardIds: [1, 27, 12], spreadSize: 3 },
  { name: "DET-14", question: "老板怎么看我？", cardIds: [15, 19, 28], spreadSize: 3 },
  { name: "DET-15", question: "我能拿到 offer 吗？", cardIds: [14, 27, 33], spreadSize: 3 },
  { name: "DET-16", question: "这笔款什么时候到账？", cardIds: [34, 27, 1], spreadSize: 3 },
  { name: "DET-17", question: "我的耳机在哪里？", cardIds: [26, 20, 22], spreadSize: 3 },
  { name: "DET-18", question: "还能找回来吗？", cardIds: [1, 33, 2], spreadSize: 3 },
  { name: "DET-19", question: "未来职业方向如何？", cardIds: [32, 16, 3], spreadSize: 3 },
  { name: "DET-20", question: "申请结果如何？", cardIds: [27, 33, 31], spreadSize: 3 }
];

test("pipeline exposes versioned full rule-engine result", () => {
  const result = reading(goldenFixtures[4]);
  assert.equal(result.engineVersion, RULE_ENGINE_VERSION);
  assert.equal(result.metadata.engineVersion, RULE_ENGINE_VERSION);
  assert.equal(result.metadata.schemaVersion, RULE_ENGINE_SCHEMA_VERSION);
  assert.equal(result.metadata.source, "rule_engine");
  assert.equal(result.metadata.externalFallbackUsed, false);
  assert.equal(result.preselection.length, 3);
  assert.equal(result.initialPairs.length, 2);
  assert.equal(result.refinedPairs.length, 2);
  assert.equal(result.resolvedCards.length, 3);
});

test("GR-E2E-01 feelings are not collapsed into commitment", () => {
  const result = reading(goldenFixtures[0]);
  assert.equal(result.questionContext.intent, "feelings_attitude");
  assert.equal(result.questionContext.answerMode, "yes_no");
  assert.notEqual(card(result, 24)?.primaryMode, "commitment_bond");
  assert.match(result.synthesis.coreTheme.label, /uncertainty|relationship/);
  assert.notEqual(result.answer.resolution, "strongly_supported");
  assert.doesNotMatch(serialized(result.answer), /marriage|committed relationship/i);
  assert.match(serialized(result.rendered), /不确定|还不清楚|有条件|需要/);
});

test("GR-E2E-02 feeling, bond, and persistence do not satisfy action alone", () => {
  const result = reading(goldenFixtures[1]);
  assert.equal(result.questionContext.intent, "action");
  assert.equal(result.answer.proposition.propositionType, "action");
  assert.notEqual(result.answer.resolution, "supported");
  assert.notEqual(result.answer.resolution, "strongly_supported");
  assert.ok(result.answer.semanticSupport.missingComponents?.includes("contact_action_evidence"));
});

test("GR-E2E-03 contact does not become reconciliation", () => {
  const result = reading(goldenFixtures[2]);
  assert.equal(result.questionContext.primaryTopic, "reconciliation");
  assert.equal(result.answer.proposition.desiredState, "relationship_reconciliation");
  assert.notEqual(result.answer.resolution, "supported");
  assert.notEqual(result.answer.resolution, "strongly_supported");
});

test("GR-E2E-04 resolution uses process evidence and Coffin sequence direction", () => {
  const result = reading(goldenFixtures[3]);
  assert.equal(result.questionContext.intent, "outcome");
  assert.equal(result.questionContext.answerMode, "yes_no");
  assert.equal(pair(result, 21, 8)?.primaryRelation.relation, "end");
  assert.equal(pair(result, 8, 31)?.primaryRelation.relation, "sequence");
  assert.ok(["improving", "changing"].includes(result.synthesis.mainProcess));
  assert.ok(result.answer.supportEvidence.some((item) => item.evidenceCodes.includes("MATCH_OUTCOME_PROCESS")));
  assert.equal(serialized(result.answer).includes("Sun=Yes"), false);
});

test("GR-E2E-05 message timing can strengthen support without Key equals yes", () => {
  const result = reading(goldenFixtures[4]);
  assert.equal(result.questionContext.timeframe.normalized?.horizonClass, "short");
  assert.equal(result.tempo.compatibility, "well_matched");
  assert.ok(["supported", "strongly_supported"].includes(result.answer.resolution));
  assert.equal(result.answer.timingEffect?.effect, "strengthen");
  assert.equal(serialized(result.answer).includes("Key=Yes"), false);
  assert.equal(result.answer.supportEvidence.some((item) => item.type === "timeframe"), false);
});

test("GR-E2E-06 slow pace strains a short progress window without becoming no", () => {
  const result = reading(goldenFixtures[5]);
  assert.equal(result.questionContext.timeframe.normalized?.horizonClass, "short");
  assert.equal(result.tempo.compatibility, "strained");
  assert.ok(result.tempo.warnings?.some((warning) => warning.type === "slow_not_no"));
  assert.notEqual(result.answer.resolution, "strongly_supported");
  assert.doesNotMatch(serialized(result.rendered), /不会|没有可能/);
});

test("GR-E2E-07 compatible long horizon does not support change proposition by itself", () => {
  const result = reading(goldenFixtures[6]);
  assert.equal(result.questionContext.timeframe.value, 6);
  assert.equal(result.questionContext.timeframe.unit, "month");
  assert.equal(result.questionContext.timeframe.normalized?.horizonClass, "extended");
  assert.equal(result.tempo.compatibilityTarget, "semantic_process");
  assert.equal(result.tempo.compatibility, "well_matched");
  assert.ok(["not_supported", "weakly_supported", "conditional"].includes(result.answer.resolution));
  assert.notEqual(result.answer.semanticSupport.semanticDirection, "support");
});

test("GR-E2E-08 open development keeps no yes/no and preserves clarification chain", () => {
  const result = reading(goldenFixtures[7]);
  assert.equal(result.questionContext.answerMode, "open");
  assert.equal(result.answer.resolution, "not_applicable");
  assert.equal(result.synthesis.mainProcess, "clarifying");
  assert.ok(result.synthesis.keyTransitions.some((transition) => transition.type === "hide"));
  assert.ok(result.synthesis.keyTransitions.some((transition) => transition.type === "communicate"));
  assert.ok(result.synthesis.keyTransitions.some((transition) => transition.type === "confirm"));
});

test("GR-E2E-09 study project keeps Fish, Child, and Garden context-safe", () => {
  const result = reading(goldenFixtures[8]);
  assert.equal(result.questionContext.domain, "study");
  assert.equal(result.questionContext.intent, "obstacle");
  assert.equal(result.questionContext.object.type, "project");
  assert.notEqual(card(result, 34)?.primaryMode, "money_finance");
  assert.ok(["abundance_quantity", "depth", "cashflow_circulation"].includes(card(result, 34)?.primaryMode ?? ""));
  assert.ok(["research_investigation", "project_case", "knowledge_learning"].includes(card(result, 26)?.primaryMode ?? ""));
  assert.equal(card(result, 11)?.primaryMode, "editing_revision_research");
  assert.equal(card(result, 13)?.primaryMode, "simplicity_reduction");
  assert.notEqual(card(result, 20)?.plane, "location");
});

test("GR-E2E-10 third-party signal remains non-factual", () => {
  const result = reading(goldenFixtures[9]);
  assert.ok(result.synthesis.safetyFlags?.some((flag) => flag.type === "third_party_not_confirmed"));
  assert.ok(result.answer.safetyFlags?.some((flag) => flag.type === "third_party_not_confirmed"));
  assert.notEqual(result.answer.resolution, "supported");
  assert.notEqual(result.answer.resolution, "strongly_supported");
  assert.doesNotMatch(serialized(result.rendered), /出轨事实|confirmed infidelity/i);
});

test("GR-E2E-11 pregnancy signal remains non-factual", () => {
  const result = reading(goldenFixtures[10]);
  assert.ok(result.synthesis.safetyFlags?.some((flag) => flag.type === "pregnancy_not_confirmed"));
  assert.ok(result.answer.safetyFlags?.some((flag) => flag.type === "pregnancy_not_confirmed"));
  assert.notEqual(result.answer.resolution, "strongly_supported");
  assert.doesNotMatch(serialized(result.rendered), /确认怀孕|confirmed pregnancy/i);
});

test("GR-E2E-12 Man and Woman do not auto-bind as querent partner or couple", () => {
  const result = reading(goldenFixtures[11]);
  assert.equal(card(result, 28)?.role, "person_anchor");
  assert.equal(card(result, 29)?.role, "person_anchor");
  assert.doesNotMatch(serialized(result.questionContext.people), /partner|spouse|couple|romantic/);
  assert.doesNotMatch(serialized(result.rendered), /伴侣|配偶|情侣|夫妻|couple|spouse/i);
});

test("Stage 2.1 production long-tail questions keep parser domain and renderer wording aligned", () => {
  const moneyMonth = reading({ name: "STAGE2-01", question: "未来一个月财运会有好消息发生吗", cardIds: [6, 9, 36, 28, 19], spreadSize: 5 });
  assert.equal(moneyMonth.questionContext.domain, "money");
  assert.equal(moneyMonth.questionContext.primaryTopic, "cashflow");
  assert.equal(moneyMonth.questionContext.intent, "outcome");
  assert.equal(moneyMonth.questionContext.object.type, "money");
  assert.equal(moneyMonth.questionContext.timeframe.value, 1);
  assert.equal(moneyMonth.questionContext.timeframe.unit, "month");
  assert.doesNotMatch(userVisible(moneyMonth), /关系|感情|恋爱|伴侣|复合|relationship/i);

  const moneyWeeks = reading({ name: "STAGE2-02", question: "未来2周会有来自财富上的好消息发生吗", cardIds: [8, 13, 4, 29, 28], spreadSize: 5 });
  assert.equal(moneyWeeks.questionContext.domain, "money");
  assert.equal(moneyWeeks.questionContext.primaryTopic, "cashflow");
  assert.equal(moneyWeeks.questionContext.intent, "outcome");
  assert.equal(moneyWeeks.questionContext.object.type, "money");
  assert.equal(moneyWeeks.questionContext.timeframe.value, 2);
  assert.equal(moneyWeeks.questionContext.timeframe.unit, "week");
  assert.doesNotMatch(userVisible(moneyWeeks), /关系|感情|恋爱|伴侣|复合|relationship/i);

  const healthLike = reading({ name: "STAGE2-03", question: "我的脓肿这周能好吗", cardIds: [25, 6, 29, 31, 19], spreadSize: 5 });
  assert.equal(healthLike.questionContext.domain, "general");
  assert.equal(healthLike.questionContext.primaryTopic, "wellbeing");
  assert.equal(healthLike.questionContext.intent, "outcome");
  assert.equal(healthLike.questionContext.object.type, "other");
  assert.equal(healthLike.questionContext.timeframe.value, 1);
  assert.equal(healthLike.questionContext.timeframe.unit, "week");
  assert.match(userVisible(healthLike), /不能替代医学判断/);
  assert.doesNotMatch(userVisible(healthLike), /关系|感情|恋爱|伴侣|复合|relationship/i);
  assert.doesNotMatch(userVisible(healthLike), /确认好转|一定会好|保证恢复/);

  const newRelationship = reading({ name: "STAGE2-04", question: "我今年会谈恋爱吗", cardIds: [29, 12, 24], spreadSize: 3 });
  assert.equal(newRelationship.questionContext.domain, "relationship");
  assert.equal(newRelationship.questionContext.primaryTopic, "new_relationship");
  assert.equal(newRelationship.questionContext.intent, "outcome");
  assert.equal(newRelationship.questionContext.object.type, "relationship");
  assert.deepEqual(
    newRelationship.questionContext.people.map((person) => person.id),
    ["self"]
  );
});

test("V2 owner trial regression: relationship outlook must not render tautological placeholders", () => {
  const result = runRuleEngineReading({
    question: "最近一个月感情运势",
    cardIds: [32, 13, 36, 29, 4],
    spreadSize: 5,
    rendererStyle: "standard"
  });
  const visible = [
    result.rendered.headline,
    result.rendered.answerLead,
    result.rendered.body,
    result.rendered.conclusion,
    result.rendered.timingNote
  ].filter(Boolean).join("\n");

  assert.equal(result.metadata.engineVersion, RULE_ENGINE_VERSION);
  assert.equal(result.questionContext.domain, "relationship");
  assert.equal(result.questionContext.answerMode, "open");
  assert.match(visible, /负担|压力|考验|女性|家庭|感情|关系|月亮|孩子|十字架|女人|房屋/);
  assert.match(visible, /收束|负担|描述|人物|家庭|缩小|小范围|修饰|转变/);
  assert.doesNotMatch(visible, /核心主题是当前主题|当前结构没有形成明确推进方向|当前状态之后转入下一步|没有完全收束|结构走向，而不是压成是或否/);
});

test("invalid input returns structured RuleEngineError codes", () => {
  const invalids: Array<{ input: Parameters<typeof runRuleEngineReading>[0]; code: RuleEngineError["code"] }> = [
    { input: { question: "x", cardIds: [], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2, 3, 4], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2, 3, 4, 5, 6], spreadSize: 5 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 1, 2], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2, 37], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2, -1], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "x", cardIds: [1, 2, Number.NaN], spreadSize: 3 }, code: "INVALID_CARD_IDS" },
    { input: { question: "", cardIds: [1, 2, 3], spreadSize: 3 }, code: "QUESTION_PARSE_FAILED" },
    { input: { question: "x", cardIds: [1, 2, 3], spreadSize: 4 as 3 }, code: "INVALID_SPREAD_SIZE" }
  ];

  for (const item of invalids) {
    assert.throws(() => runRuleEngineReading(item.input), (error) => error instanceof RuleEngineError && error.code === item.code);
  }
});

test("pipeline is deterministic across at least 20 fixtures for 100 runs each", () => {
  assert.ok(determinismFixtures.length >= 20);
  for (const fixture of determinismFixtures) {
    const expected = serialized(reading(fixture));
    for (let index = 0; index < 100; index += 1) {
      assert.equal(serialized(reading(fixture)), expected, fixture.name);
    }
  }
});

test("pipeline runs are isolated across A to B to C to A sequences", () => {
  const a = goldenFixtures[8];
  const b = goldenFixtures[6];
  const c = goldenFixtures[4];
  const firstA = reading(a);
  const resultB = reading(b);
  const resultC = reading(c);
  const secondA = reading(a);

  assert.equal(serialized(secondA), serialized(firstA));
  assert.doesNotMatch(serialized(resultB), /Whip|Child|Garden|editing_revision_research|project revision \/ repeated editing/);
  assert.doesNotMatch(serialized(resultC), /Dog|Heart|Ring|commitment_bond|trust and bond persistence/);
});

test("1000 full pipeline readings complete with recorded timings", () => {
  const fixture = goldenFixtures[4];
  const samples: number[] = [];
  for (let index = 0; index < 1000; index += 1) {
    const start = performance.now();
    reading(fixture);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const max = samples[samples.length - 1];
  assert.ok(Number.isFinite(average));
  assert.ok(Number.isFinite(p95));
  assert.ok(Number.isFinite(max));
});

function reading(fixture: Fixture) {
  return runRuleEngineReading({
    question: fixture.question,
    cardIds: fixture.cardIds,
    spreadSize: fixture.spreadSize,
    rendererStyle: "standard"
  });
}

function card(result: ReturnType<typeof reading>, cardId: number) {
  return result.resolvedCards.find((item) => item.cardId === cardId);
}

function pair(result: ReturnType<typeof reading>, leftCardId: number, rightCardId: number) {
  return result.refinedPairs.find((item) => item.leftCardId === leftCardId && item.rightCardId === rightCardId);
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

function userVisible(result: ReturnType<typeof reading>) {
  return [
    result.rendered.headline,
    result.rendered.answerLead,
    result.rendered.body,
    result.rendered.conclusion,
    result.rendered.timingNote,
    result.rendered.safetyNote
  ]
    .filter(Boolean)
    .join("\n");
}
