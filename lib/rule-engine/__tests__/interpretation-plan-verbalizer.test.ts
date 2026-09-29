import assert from "node:assert/strict";
import test from "node:test";
import { buildVerbalizerMessages, deterministicVerbalizerFallback, validateVerbalizedReading, verbalizeWithAiGuard } from "../ai-verbalizer";
import { runRuleEngineReading } from "../pipeline";

function ownerTrialResult() {
  return runRuleEngineReading({
    question: "最近一个月感情运势",
    cardIds: [32, 13, 36, 29, 4],
    spreadSize: 5,
    rendererStyle: "standard"
  });
}

function fishRelationshipResult() {
  return runRuleEngineReading({
    question: "未来一个月这段感情会怎么发展？",
    cardIds: [34, 12, 5, 29, 25],
    spreadSize: 5,
    rendererStyle: "standard"
  });
}

function womanChoiceClarityResult() {
  return runRuleEngineReading({
    question: "未来一个月这段感情会怎么发展？",
    cardIds: [29, 22, 6, 8, 33],
    spreadSize: 5,
    rendererStyle: "standard"
  });
}

test("Interpretation Plan is deterministic and contains first-class evidence", () => {
  const first = ownerTrialResult().interpretationPlan;
  const second = ownerTrialResult().interpretationPlan;
  assert.deepEqual(second, first);
  assert.equal(first.context.domain, "relationship");
  assert.equal(first.versions.engineVersion, "1.0.0-rc.2");
  assert.ok(first.coreTheme);
  assert.ok(first.mainProcess.includes("收束") || first.mainProcess.includes("结束"));
  assert.ok(first.trajectory);
  assert.equal(first.cards.length, 5);
  assert.equal(first.pairEvidence.length, 4);
  assert.equal(first.evidenceSummary.length, 4);
  assert.ok(first.uncertaintyProfile.safetyBoundary.length >= 1);
  assert.ok(first.forbiddenClaims.some((claim) => /第三者|出轨/.test(claim)));
});

test("Moon relationship owner-trial plan uses emotional context and concrete evidence summaries", () => {
  const plan = ownerTrialResult().interpretationPlan;
  const moon = plan.cards.find((card) => card.cardId === 32);
  assert.equal(moon?.selectedMode, "emotion_attraction");
  assert.notEqual(moon?.selectedMode, "career_vocation");
  assert.match(plan.evidenceSummary.join("\n"), /月亮|Moon/);
  assert.match(plan.evidenceSummary.join("\n"), /孩子|Child/);
  assert.match(plan.evidenceSummary.join("\n"), /十字架|Cross/);
  assert.match(plan.evidenceSummary.join("\n"), /压力|负担|责任|收束/);
  assert.doesNotMatch(plan.evidenceSummary.join("\n"), /当前主题|当前状态|下一步/);
});

test("career context still allows Moon vocation or recognition modes", () => {
  const result = runRuleEngineReading({
    question: "未来职业方向如何？",
    cardIds: [32, 16, 3],
    spreadSize: 3,
    rendererStyle: "standard"
  });
  const moon = result.interpretationPlan.cards.find((card) => card.cardId === 32);
  assert.ok(["career_vocation", "recognition_reputation"].includes(moon?.selectedMode ?? ""));
});

test("verbalizer input includes evidence and forbidden claims without debug traces", () => {
  const messages = buildVerbalizerMessages(ownerTrialResult().interpretationPlan);
  const plan = ownerTrialResult().interpretationPlan;
  const payload = messages.map((message) => message.content).join("\n");
  assert.match(payload, /Interpretation Plan/);
  assert.match(payload, /evidenceSummary/);
  assert.ok(plan.forbiddenClaims.length > 0);
  assert.match(payload, /internalGuardrails/);
  assert.match(payload, /第三者|出轨/);
  assert.match(payload, /月亮 \/ Moon/);
  assert.doesNotMatch(payload, /debugTrace|internalScore|beforeScore|afterScore/);
});

test("verbalizer validation rejects forbidden claims and certainty overreach", () => {
  const plan = ownerTrialResult().interpretationPlan;
  const invalid = {
    core_conclusion: "这次已经确定会分手。",
    interpretation: "整体解读\n已经确定会分手。\n牌面依据\n月亮和孩子。\n趋势总结\n一定失败。",
    time_window: null,
    uncertainty: "无"
  };
  const validation = validateVerbalizedReading(plan, invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("forbidden_high_risk_claim"));
  assert.ok(validation.issues.includes("certainty_overreach"));
});

test("verbalizer retries once and falls back when AI keeps violating guard", async () => {
  const plan = ownerTrialResult().interpretationPlan;
  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "已经确定会结婚。",
      interpretation: "整体解读\n一定结婚。\n牌面依据\n月亮和孩子。\n趋势总结\n毫无疑问。",
      time_window: null,
      uncertainty: "无"
    })
  );
  assert.equal(outcome.source, "deterministic_fallback");
  assert.equal(outcome.attempts, 2);
  assert.match(outcome.result.interpretation, /整体解读/);
  assert.match(outcome.result.interpretation, /牌面依据/);
  assert.match(outcome.result.interpretation, /趋势总结/);
  assert.doesNotMatch(outcome.result.interpretation, /当前主题|当前状态之后转入下一步|当前结构没有形成明确推进方向/);
});

test("relationship Fish Birds Tree Woman Ring plan uses context-aware user-facing semantics", () => {
  const plan = fishRelationshipResult().interpretationPlan;
  const visiblePlanText = JSON.stringify({
    cards: plan.cards,
    evidenceSummary: plan.evidenceSummary,
    pairEvidence: plan.pairEvidence
  });

  const fish = plan.cards.find((card) => card.cardId === 34);
  const tree = plan.cards.find((card) => card.cardId === 5);
  const womanRing = plan.pairEvidence.find((pair) => pair.leftCard.includes("女人") && pair.rightCard.includes("戒指"));

  assert.match(fish?.userFacingMeaning ?? "", /关系|流动|投入|互动/);
  assert.match(tree?.userFacingMeaning ?? "", /持续|扎根|长期|成长|根基/);
  assert.doesNotMatch(tree?.userFacingMeaning ?? "", /健康|固定关系/);
  assert.match(womanRing?.userFacingMeaning ?? "", /女性|关系|明确|稳定|约定|承诺/);
  assert.doesNotMatch(visiblePlanText, /相关因素|当前主题|当前状态|下一步|描述或限定|绑定主题|沟通或信息传递/);
});

test("verbalizer rejects mechanical placeholders and internal safety boundaries", async () => {
  const plan = fishRelationshipResult().interpretationPlan;
  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "核心主题是当前主题。",
      interpretation:
        "整体解读\n核心主题是当前主题。\n\n牌面依据\n鱼和鸟显示相关因素通过口头沟通进入沟通或信息传递；女人和戒指显示绑定主题在描述或限定这位女性。\n\n趋势总结\n不得确认第三者、出轨或排他性事实。",
      time_window: null,
      uncertainty: "当前状态之后转入下一步。"
    })
  );

  assert.equal(outcome.source, "deterministic_fallback");
  assert.ok(outcome.validationIssues?.includes("internal_language_leakage"));
  assert.doesNotMatch(outcome.result.interpretation, /相关因素|当前主题|当前状态|下一步|描述或限定|绑定主题|沟通或信息传递|不得确认/);
});

test("relationship Fish Birds Tree Woman Ring accepts natural guarded verbalization", async () => {
  const plan = fishRelationshipResult().interpretationPlan;
  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "这段关系未来一个月的重点在互动是否能持续沉淀，并逐渐把关系位置变得更清楚。",
      interpretation:
        "整体解读\n鱼、鸟、树、女人、戒指连在一起，显示这段关系不是马上定局，而是先看双方有没有持续互动和回应。鱼到鸟让关系里的投入通过沟通表现出来，鸟到树则说明这些交流需要时间沉淀，才会慢慢变成更稳定的关系基础。\n\n牌面依据\n树到女人把长期发展的问题落到女性当事人的感受和位置上；女人到戒指让焦点回到关系是否更明确、更稳定，或是否形成某种约定。这里有关系焦点，但牌面不足以直接确认婚姻、分手或第三者。\n\n趋势总结\n结尾更像开放式推进：有机会通过互动让关系变清楚，但仍要看后续沟通能否持续。",
      time_window: null,
      uncertainty: "目前关系仍处在逐渐明确的过程中，不能把它压成绝对结论。"
    })
  );

  assert.equal(outcome.source, "ai");
  assert.doesNotMatch(outcome.result.interpretation, /相关因素|当前主题|当前状态|下一步|描述或限定|绑定主题|沟通或信息传递|不得确认|MISSING_USER_FACING_SEMANTICS/);
  assert.match(outcome.result.interpretation, /互动|沟通|持续|沉淀|长期|稳定|关系/);
});

test("final user text can mention limits naturally without exposing internal guardrails", () => {
  const plan = fishRelationshipResult().interpretationPlan;
  const natural = {
    core_conclusion: "关系仍在逐渐明确中。",
    interpretation:
      "整体解读\n鱼和鸟说明关系里的投入需要通过沟通表现出来。\n\n牌面依据\n树和女人把长期发展落到当事人的感受位置；女人和戒指把焦点带回关系是否更明确。\n\n趋势总结\n牌面还不足以直接下成婚姻、分手或第三者结论，但可以看出关系需要靠后续互动继续变清楚。",
    time_window: null,
    uncertainty: "仍需观察后续互动。"
  };
  const validation = validateVerbalizedReading(plan, natural);
  assert.equal(validation.valid, true);
});

test("forbidden claims stay in the plan and prompt but not in accepted final text", async () => {
  const plan = fishRelationshipResult().interpretationPlan;
  const messages = buildVerbalizerMessages(plan);
  const payload = messages.map((message) => message.content).join("\n");
  assert.ok(plan.forbiddenClaims.some((claim) => /第三者|出轨/.test(claim)));
  assert.match(payload, /internalGuardrails/);
  assert.match(payload, /第三者|出轨/);

  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "关系的互动和长期发展是重点。",
      interpretation:
        "整体解读\n鱼和鸟说明关系里的投入会通过沟通表现出来，鸟和树则把重点带到互动能否持续。\n\n牌面依据\n树和女人让长期发展落到当事人的感受位置；女人和戒指把焦点带回关系是否更清楚、更稳定。\n\n趋势总结\n牌面还不足以直接下成高风险事实，关系仍需要靠后续互动逐渐明确。",
      time_window: null,
      uncertainty: "关系仍在逐步明确。"
    })
  );
  assert.equal(outcome.source, "ai");
  assert.doesNotMatch(outcome.result.interpretation, /不得确认|不得新增|不得把|forbiddenClaims|internalGuardrails/);
});

test("confidence calibration suppresses resolved semantic ambiguity before verbalization", () => {
  const plan = womanChoiceClarityResult().interpretationPlan;
  const payload = buildVerbalizerMessages(plan).map((message) => message.content).join("\n");
  assert.ok(["high", "medium", "low"].includes(plan.confidence.trajectory));
  assert.doesNotMatch(payload, /相邻组合仍有不止一种合理解释|多种合理解释|resolved semantic ambiguity/);
  assert.ok(plan.uncertaintyProfile.semanticAmbiguity.every((item) => item.userVisible === false));
});

test("high confidence trajectory rejects excessive hedging", () => {
  const base = womanChoiceClarityResult().interpretationPlan;
  const plan = {
    ...base,
    confidence: { ...base.confidence, overall: "high" as const, trajectory: "high" as const },
    uncertainties: []
  };
  const validation = validateVerbalizedReading(plan, {
    core_conclusion: "未来一个月主线很清楚。",
    interpretation:
      "整体解读\n女人、岔路、云、棺材、钥匙显示未来一个月主线是从选择和模糊走向收束与明确。\n\n牌面依据\n女人和岔路把重点放在当事人的选择；岔路和云显示选择阶段有犹豫；云和棺材让模糊进入收束；棺材和钥匙把收束之后的重点带向清楚或确认。\n\n趋势总结\n牌面还不足以直接下结论，过程仍保留弹性。",
    time_window: null,
    uncertainty: "相邻组合存在不止一种合理解释。"
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("excessive_hedging"));
});

test("medium confidence allows at most one main hedge", () => {
  const base = womanChoiceClarityResult().interpretationPlan;
  const plan = {
    ...base,
    confidence: { ...base.confidence, overall: "medium" as const, trajectory: "medium" as const },
    uncertainties: ["具体关系结果仍需观察。"]
  };
  const oneHedge = validateVerbalizedReading(plan, {
    core_conclusion: "未来一个月更倾向于从犹豫走向明确。",
    interpretation:
      "整体解读\n女人、岔路、云、棺材、钥匙显示主线更像从选择和模糊走向收束与明确。\n\n牌面依据\n女人和岔路把重点放在当事人的选择；岔路和云显示选择阶段有犹豫；云和棺材让模糊进入收束；棺材和钥匙把收束之后的重点带向清楚或确认。\n\n趋势总结\n最终明确的是哪一种具体关系结果，还要看后续互动如何落地。",
    time_window: null,
    uncertainty: "最终明确的是哪一种具体关系结果，还要看后续互动如何落地。"
  });
  assert.equal(oneHedge.valid, true);

  const stacked = validateVerbalizedReading(plan, {
    core_conclusion: "未来一个月更倾向于从犹豫走向明确。",
    interpretation:
      "整体解读\n女人、岔路、云、棺材、钥匙显示主线更像从选择和模糊走向收束与明确。\n\n牌面依据\n女人和岔路把重点放在当事人的选择；岔路和云显示选择阶段有犹豫；云和棺材让模糊进入收束；棺材和钥匙把收束之后的重点带向清楚或确认。\n\n趋势总结\n牌面还不足以直接下结论，过程仍保留弹性，暂时不能把话说死。",
    time_window: null,
    uncertainty: "相邻组合存在不止一种合理解释。"
  });
  assert.equal(stacked.valid, false);
  assert.ok(stacked.issues.includes("excessive_hedging"));
});

test("low confidence conflict can explain multiple directions without failing guard", () => {
  const base = womanChoiceClarityResult().interpretationPlan;
  const plan = {
    ...base,
    confidence: { ...base.confidence, overall: "low" as const, trajectory: "low" as const },
    uncertainties: ["过程方向混合。", "结尾信号还不够单一。"]
  };
  const validation = validateVerbalizedReading(plan, {
    core_conclusion: "目前两种方向都有支持。",
    interpretation:
      "整体解读\n女人、岔路、云、棺材、钥匙显示选择、模糊、收束和确认同时出现。\n\n牌面依据\n女人和岔路把重点放在当事人的选择；岔路和云显示选择阶段有犹豫；云和棺材让模糊进入收束；棺材和钥匙把收束之后的重点带向清楚或确认。\n\n趋势总结\n目前两种方向都有支持，暂时不适合下单一判断。",
    time_window: null,
    uncertainty: "目前两种方向都有支持。"
  });
  assert.equal(validation.valid, true);
});

test("Woman Crossroads Clouds Coffin Key verbalizes decisive trajectory with only necessary boundary", async () => {
  const plan = womanChoiceClarityResult().interpretationPlan;
  const fallback = deterministicVerbalizerFallback(plan);
  const payload = buildVerbalizerMessages(plan)[1].content;
  assert.doesNotMatch(JSON.stringify({ cards: plan.cards, evidenceSummary: plan.evidenceSummary, pairEvidence: plan.pairEvidence.map((pair) => pair.userFacingMeaning), payload }), /MISSING_USER_FACING_SEMANTICS|相关因素| hide /);
  assert.doesNotMatch(fallback.interpretation, /MISSING_USER_FACING_SEMANTICS|相关因素| hide /);
  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "未来一个月的整体趋势，是从犹豫和模糊逐渐走向收束与明确。",
      interpretation:
        "整体解读\n女人、岔路、云、棺材、钥匙连在一起，主线不是停在混乱里，而是先出现选择和犹豫，再经过一个收束点，最后把重点带向更清楚的答案或确认。\n\n牌面依据\n女人和岔路把焦点放在当事人的立场与选择；岔路和云说明选择阶段确实带着迷雾和不确定；云和棺材显示这份模糊会进入收束；棺材和钥匙则把收束之后的方向带向清晰、关键答案或确认。\n\n趋势总结\n整体更倾向于先乱后清，后半段会更明显地走向某种明确。最终明确的是哪一种具体关系结果，还要看后续互动如何落地。",
      time_window: null,
      uncertainty: "最终明确的是哪一种具体关系结果，还要看后续互动如何落地。"
    })
  );
  const text = [outcome.result.core_conclusion, outcome.result.interpretation, outcome.result.uncertainty].join("\n");
  assert.equal(outcome.source, "ai");
  assert.match(text, /犹豫|模糊|选择/);
  assert.match(text, /收束|明确|确认|清晰/);
  assert.doesNotMatch(text, /仍保留弹性|多种合理解释|暂时不能把话说死|还不能确定|不能直接定论|牌面还不足以直接下结论/);
});

test("verbalizer accepts guarded output with required sections and evidence", async () => {
  const plan = ownerTrialResult().interpretationPlan;
  const outcome = await verbalizeWithAiGuard(plan, async () =>
    JSON.stringify({
      core_conclusion: "最近一个月的感情重点在压力与现实基础，整体更像一个阶段在收束。",
      interpretation:
        "整体解读\n这组牌显示感情感受进入较小、较早期的变化，但很快碰到压力与现实责任。\n\n牌面依据\n月亮与孩子说明情绪和关系感受进入新的小阶段；孩子与十字架说明这个发展带有压力或责任；十字架与女人说明压力落到当事人身上；女人与房屋说明重点回到家庭、生活基础与安全感。\n\n趋势总结\n接下来更明显的主线是压力落回生活基础与安全感，关系结果要看这些现实条件如何被处理。",
      time_window: null,
      uncertainty: "压力不等于必然失败，关键在于现实条件如何被处理。"
    })
  );
  assert.equal(outcome.source, "ai");
  assert.equal(outcome.attempts, 1);
});

test("AI unavailable uses deterministic structured fallback", () => {
  const fallback = deterministicVerbalizerFallback(ownerTrialResult().interpretationPlan);
  assert.match(fallback.interpretation, /整体解读/);
  assert.match(fallback.interpretation, /牌面依据/);
  assert.match(fallback.interpretation, /趋势总结/);
  assert.match(fallback.interpretation, /月亮|孩子|十字架|女人|房屋/);
  assert.doesNotMatch(fallback.interpretation, /核心主题是当前主题|当前状态之后转入下一步|当前结构没有形成明确推进方向/);
});
