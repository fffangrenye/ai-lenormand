import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { guidedCardCount, guidedPlanVersion, type GuidedSession } from "../guided-reading/details";
import { guidedFallbackQuestions, guidedTopic, inferGuidedMode } from "../guided-reading/questions";
import { guidedQuestionHelp } from "../guided-reading/question-help";
import { interpretGuidedRound, planNextCard, summarizeGuidedReading, type GuidedJsonRequest } from "../guided-reading/model";
import { GuidedPreviewStore, guidedSchema } from "../guided-reading/preview";
import { guidedAction } from "../guided-reading/actions";

function session(question = "想了解下一段感情会是什么样"): GuidedSession {
  return { id: randomUUID(), question, focus: "", petalPrice: 3, cards: [], messages: [], rounds: [], plan: null, final: null, updatedAt: new Date().toISOString() };
}

test("topic examples cover relationships, work, learning, creation, social life and new experiences", async () => {
  const cases = [
    ["下一任会是什么样的人", "关系与感情"], ["想了解下一份工作的团队", "工作与求职"],
    ["想了解我适合的学习方式", "学习与成长"], ["我的创作可能呈现什么风格", "创作与项目"],
    ["想看看和朋友的相处特点", "人际与合作"], ["搬到新城市的生活会是什么样", "生活与新体验"],
  ];
  for (const [question, expected] of cases) {
    assert.equal(guidedTopic(question).label, expected);
    const plan = await planNextCard(session(question));
    assert.equal(plan.groups.length, 3);
    assert(plan.groups.every(group => group.length === 3));
    assert.equal(new Set(plan.groups.flat()).size, 9);
    assert(plan.groups.flat().every(question => !guidedQuestionHelp(question)));
  }
  assert.equal(inferGuidedMode("为什么关系停滞，接下来怎么办"), "analysis");
  assert.equal(inferGuidedMode("想了解下一份工作的氛围"), "exploration");
  assert(guidedFallbackQuestions("我的学习怎样推进", "analysis")[0].includes("学习"));
  assert.deepEqual(guidedFallbackQuestions("下一份工作的特点", "exploration").slice(0, 3), [
    "这份工作的日常内容可能有哪些特点？", "团队氛围可能是什么样？", "和同事配合时可能是什么感觉？",
  ]);
});

test("precision help offers related optional questions without changing input or requesting a model", () => {
  for (const question of ["对方身高多少", "他的长相是什么样", "对方年龄比我大吗", "几月几号收到消息", "具体公司叫什么", "哪个学校适合我"]) {
    const help = guidedQuestionHelp(question);
    assert(help, question);
    assert.equal(help.suggestions.length, 3);
    assert(help.suggestions.every(suggestion => !guidedQuestionHelp(suggestion)));
  }
  assert.equal(guidedQuestionHelp("对方身高多少")?.suggestions[0], "对方给人的第一印象是什么样？");
  for (const question of ["", "怎样改善团队沟通", "下一段关系有哪些特点", "我的创作适合什么风格"]) assert.equal(guidedQuestionHelp(question), null);
});

test("common question limitations cover paraphrases, related rewrites and safety notices", () => {
  const cases: [string, string][] = [
    ["下一任长啥样", "appearance"], ["他个子高不高", "appearance"], ["他的五官好看吗", "appearance"], ["她胖不胖", "appearance"],
    ["他多大", "age"], ["对方跟我同岁吗", "age"], ["她比我大几岁", "age"],
    ["下一任叫什么名字", "identity"], ["他是什么星座", "identity"], ["她是什么血型", "identity"],
    ["是新人还是旧人", "new_or_known"], ["是我已经认识的人吗", "new_or_known"], ["我之前见过他吗", "new_or_known"],
    ["我们会在哪个城市认识", "location"], ["在哪里遇见下一任", "location"],
    ["我们几月复合", "date"], ["哪一天有面试消息", "date"], ["多久能开始新工作", "timing"], ["他什么时候联系我", "timing"],
    ["这份工作月薪能有多少", "amount"], ["我的账号会有多少粉丝", "amount"], ["我要去哪家公司", "organization"],
    ["他在想什么", "thoughts"], ["对方喜不喜欢我", "thoughts"], ["老板怎么看我", "thoughts"],
    ["他是不是我的正缘", "guarantee"], ["我们会永远在一起吗", "guarantee"],
    ["这次面试能过吗", "result"], ["我能考多少分", "result"], ["我能不能拿到offer", "result"],
    ["帮我决定选哪个", "decision"], ["我的未来怎么样", "broad"], ["我的钥匙在哪里", "lost_item"],
    ["原因是什么；现在情况如何；下一步怎么做", "multiple"],
    ["他出轨了吗", "sensitive"], ["医疗诊断是否准确", "sensitive"], ["他现在在哪里", "sensitive"], ["我要买哪个股票", "sensitive"],
  ];
  for (const [question, category] of cases) {
    const help = guidedQuestionHelp(question);
    assert(help, question);
    assert.equal(help?.category, category, question);
    if (category === "sensitive") assert.deepEqual(help.suggestions, []);
    else {
      assert.equal(help!.suggestions.length, 3, question);
      assert(help!.suggestions.every(suggestion => !guidedQuestionHelp(suggestion)?.avoidInRecommendations), question);
    }
  }
  assert(guidedQuestionHelp("什么时候有进展", "想了解我的创作项目")!.suggestions.some(question => /作品|内容|项目/.test(question)));
  assert(guidedQuestionHelp("什么时候有进展", "我和伴侣接下来的关系")!.suggestions.some(question => question.includes("关系")));
  assert.equal(guidedQuestionHelp("对方喜欢我吗")!.avoidInRecommendations, false);
  for (const question of ["未来三个月关系怎么发展", "这幅画好看吗", "这个项目有多高的发展空间", "我在医院做设计，怎么和同事沟通", "对方给人的第一印象是什么样？"]) {
    assert.equal(guidedQuestionHelp(question), null, question);
  }
});

test("classification shares the first plan request and mode stays fixed on subsequent plans", async () => {
  let calls = 0;
  let lastSystem = "";
  const input = session("怎么了解一个新城市的生活");
  assert.equal(inferGuidedMode(input.question), "exploration");
  const request: GuidedJsonRequest = async (system, user, _max, _id, kind) => {
    calls++;
    lastSystem = system;
    assert.equal(kind, "guided-plan");
    assert(JSON.parse(user).主问题);
    return { mode: "analysis", topic: "生活节奏", groups: [["具体地址在哪？", "生活有哪些新鲜的体验？", "什么条件会影响适应？"]] };
  };
  const plan = await planNextCard(input, request);
  assert.equal(calls, 1);
  assert.equal(plan.mode, "analysis");
  assert(!plan.groups.flat().some(question => question.includes("具体地址")));
  assert.match(lastSystem, /创作项目|学习可探索|生活与新体验/);
  assert.equal((await planNextCard({ ...input, mode: "exploration" }, request)).mode, "exploration");
});

test("rounds and summary get mode, actual context, precision note and consistent factual boundaries", async () => {
  const input = { ...session(), mode: "exploration" as const, cards: [26], focus: "没有认识具体的人", rounds: [{ question: "对方的身高怎么样", interpretation: null }] };
  const seen: { system: string; data: Record<string, unknown>; kind: string }[] = [];
  const request: GuidedJsonRequest = async (system, user, _max, _id, kind) => {
    seen.push({ system, data: JSON.parse(user), kind });
    return kind === "guided-step" ? { interpretation: "这是可保存的模型回答。" } : { summary: "这是可保存的完整总结。" };
  };
  assert.equal(await interpretGuidedRound(input, request), "这是可保存的模型回答。");
  assert.equal(seen[0].data.展开方式, "主题探索");
  assert.equal(seen[0].data.当前选择的观察问题, "对方的身高怎么样");
  assert.equal(typeof seen[0].data.问题精度提示, "string");
  assert.match(seen[0].system, /先直接回应本轮小问题/);
  assert.match(seen[0].system, /不捏造厘米数/);
  assert.match(seen[0].system, /不提供财务、法律、医疗/);
  assert.match(seen[0].system, /不声称对方在隐瞒/);
  await summarizeGuidedReading(input, request);
  assert.match(seen[1].system, /探索模式将实际涉及的特点/);
  assert.match(seen[1].system, /不把人物联想和场景推测升级为现实事实/);
});

test("mode switching, nine-round resume and retry preserve owner isolation, cards and single debit", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(guidedSchema);
  let calls = 0;
  let debits = 0;
  const request: GuidedJsonRequest = async (_system, _user, _max, _id, kind) => {
    calls++;
    return kind === "guided-plan" ? { mode: "analysis", groups: [] } : kind === "guided-step" ? { interpretation: "这一轮的象征性解读。" } : { summary: "九轮汇总。" };
  };
  const store = new GuidedPreviewStore(db, work => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }, () => {}, () => { debits++; }, request);
  try {
    let current = store.start("owner", "想了解下一段感情", "", randomUUID());
    const [first, duplicate] = await Promise.all([store.advance("owner", current.id), store.advance("owner", current.id)]);
    assert.deepEqual(first, duplicate);
    assert.equal(calls, 1);
    assert.equal(first.mode, "analysis");
    assert.throws(() => store.setMode("another", first.id, "exploration", first.plan!.id), { code: "NOT_FOUND" });
    assert.throws(() => store.setMode("owner", first.id, "exploration", randomUUID()), { code: "DRAW_CHANGED" });
    current = store.setMode("owner", first.id, "exploration", first.plan!.id);
    assert.equal(current.plan, null);
    assert.equal(current.mode, "exploration");
    assert.equal(debits, 0);
    current = await store.advance("owner", current.id);
    const oldPlan = current.plan!;
    // Reloading an older saved plan refreshes recommendations while keeping the session.
    const saved = JSON.parse(String(db.prepare("SELECT payload FROM guided_preview_sessions WHERE id=?").get(current.id)!.payload));
    saved.plan.version = guidedPlanVersion - 1;
    db.prepare("UPDATE guided_preview_sessions SET payload=? WHERE id=?").run(JSON.stringify(saved), current.id);
    assert.equal(store.open("owner", current.id).plan, null);
    current = await store.advance("owner", current.id);
    assert.equal(current.mode, "exploration");
    assert.notEqual(current.plan!.id, oldPlan.id);
    const countBeforeDraws = calls;
    for (let step = 0; step < guidedCardCount; step++) {
      const plan = current.plan!;
      assert.equal(plan.groups.flat().length, 9);
      const question = plan.groups[0][0];
      current = store.draw("owner", current.id, step, question, false, plan.id);
      assert.equal(store.draw("owner", current.id, step, question, false, plan.id).cards.length, step + 1);
      assert.throws(() => store.setMode("owner", current.id, "analysis", plan.id), { code: "GUIDED_MODE_LOCKED" });
      current = await store.advance("owner", current.id);
      assert(current.rounds[step].interpretation);
      current = await store.advance("owner", current.id);
      assert.equal(current.mode, "exploration");
    }
    assert.equal(new Set(current.cards).size, 9);
    assert.equal(current.final, "九轮汇总。");
    assert.equal(debits, 1);
    assert.equal(calls - countBeforeDraws, 18);
    const before = calls;
    assert.deepEqual(await store.advance("owner", current.id), current);
    assert.equal(calls, before);
    assert.equal(Object.hasOwn(current, "deck"), false);
  } finally { db.close(); }
});

test("mode endpoint rejects invalid input and custom precision questions still pass safety review", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(guidedSchema);
  const store = new GuidedPreviewStore(db, work => work(), () => {}, () => {});
  const share = <T>(_key: string, task: () => Promise<T>) => task();
  let reviewed = "";
  const review = async (_reading: unknown, _background?: unknown, question?: string) => { reviewed = question ?? ""; return null; };
  try {
    const started = store.start("owner", "想了解下一段感情", "", randomUUID());
    const current = await store.advance("owner", started.id);
    await assert.rejects(guidedAction(store, "owner", "guided/mode", { id: started.id, mode: "unexpected", planId: current.plan!.id }, review, () => {}, share), { code: "INVALID_GUIDED_MODE" });
    await guidedAction(store, "owner", "guided/draw", { id: current.id, step: 0, custom: true, planId: current.plan!.id, question: "对方身高怎么样" }, review, () => {}, share);
    assert.equal(reviewed, "对方身高怎么样");
    assert.equal(store.open("owner", current.id).rounds[0].question, "对方身高怎么样");
  } finally { db.close(); }
});
