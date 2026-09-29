import { DeepReadingResult, assertDeepReadingResult } from "../deep-reading-result";
import { parseAiJsonObject } from "../ai-json";
import { InterpretationPlan, planForVerbalizer } from "./interpretation-plan";

export type VerbalizerValidationResult = {
  valid: boolean;
  issues: string[];
};

export type VerbalizerOutcome = {
  result: DeepReadingResult;
  source: "ai" | "deterministic_fallback";
  attempts: number;
  validationIssues?: string[];
};

export type AiVerbalizerClient = (messages: Array<{ role: "system" | "user"; content: string }>, attempt: number) => Promise<string>;

export const verbalizerSystemPrompt = `你是 Flora Lenormand 的中文表达整理器。

你不是负责决定牌义。下面的 Interpretation Plan 已经决定了允许表达的语义。
你的职责只是将其组织成自然、清晰、连贯、适合真实用户阅读的中文。

语义自由度 = 0：不能新增、改写或反转 Interpretation Plan 的牌义、方向、结论和边界。
语言自由度 = 高：可以用自然、专业、像真实解牌师一样的中文组织表达，不要机械复述字段。

必须遵守：
- 只使用 Interpretation Plan 中的语义、证据和限制。
- 保留 coreTheme、mainProcess、trajectory、closingTendency。
- 保留 pairEvidence 的方向，不能把 A→B 改成 B→A。
- 必须提及关键牌面依据，至少覆盖主要相邻 pair，但不要逐条机械复述。
- internalGuardrails 只用于约束输出，不能原样展示、翻译或写给用户看。
- 优先表达 Interpretation Plan 中 evidence 最强的主线。不要因为内部存在 safety boundaries 或已经被解决的 semantic ambiguity 而反复使用谨慎措辞。
- 谨慎程度必须与 confidence 一致：high 要明确表达趋势；medium 使用“更倾向于/目前看来”等轻度限定且最多一句；low 才说明两种方向都有支持。
- 只有 uncertaintyProfile.outcomeUncertainty 中 userVisible 的内容才允许进入最终用户文案。
- 不得新增第三者、婚姻、分手、怀孕、疾病诊断、财务事实或法律事实。
- 不得把可能性写成确定事实。
- 不得使用你训练知识里的固定组合覆盖计划。
- 不得输出这些内部/占位表达：相关因素、当前主题、当前状态、下一步、描述或限定、绑定主题、沟通或信息传递、MISSING_USER_FACING_SEMANTICS、forbiddenClaims、internalGuardrails。
- 不要把安全边界写成“不得确认……”这类内部规则；如需表达，只能自然地说“牌面还不足以直接下结论”。

返回且只返回一个 JSON 对象：
{
  "core_conclusion": "string",
  "interpretation": "string",
  "time_window": null,
  "uncertainty": "string"
}

interpretation 必须包含三个中文小标题：
整体解读
牌面依据
趋势总结

不要输出 markdown 代码块。`;

export function buildVerbalizerMessages(plan: InterpretationPlan, stricter = false) {
  const publicPlan = planForVerbalizer(plan);
  const guard = stricter
    ? "\n\n上一次输出未通过校验。请更严格：必须包含三个小标题，不能出现 internalGuardrails 禁止的断言，不能遗漏牌面依据，也不能原样展示内部边界。"
    : "";
  return [
    { role: "system" as const, content: `${verbalizerSystemPrompt}${guard}` },
    {
      role: "user" as const,
      content: `请把以下 Interpretation Plan 改写成自然中文最终解读。不要改变语义。\n\n${JSON.stringify(publicPlan, null, 2)}`
    }
  ];
}

export async function verbalizeWithAiGuard(plan: InterpretationPlan, client: AiVerbalizerClient): Promise<VerbalizerOutcome> {
  const first = await attemptVerbalization(plan, client, 1, false);
  if (first.validation.valid) return { result: first.result, source: "ai", attempts: 1 };

  const second = await attemptVerbalization(plan, client, 2, true);
  if (second.validation.valid) return { result: second.result, source: "ai", attempts: 2 };

  return {
    result: deterministicVerbalizerFallback(plan),
    source: "deterministic_fallback",
    attempts: 2,
    validationIssues: second.validation.issues
  };
}

export function deterministicVerbalizerFallback(plan: InterpretationPlan): DeepReadingResult {
  const evidence = plan.evidenceSummary.map((item) => `- ${item}`).join("\n");
  const uncertainty = naturalUncertaintyText(plan);
  return {
    core_conclusion: `核心落在${plan.coreTheme}，主线是${plan.mainProcess}。`,
    interpretation: [
      "整体解读",
      `这次解读的重点落在${plan.coreTheme}，整体过程更接近${plan.mainProcess}。${plan.trajectory ? `牌面连起来看，主线呈现为${plan.trajectory}。` : ""}`,
      "",
      "牌面依据",
      evidence || "- 这组牌暂时缺少足够具体的相邻牌证据，需要保留弹性。",
      "",
      "趋势总结",
      [plan.closingTendency, uncertainty].filter(Boolean).join("。")
    ].join("\n"),
    time_window: null,
    uncertainty
  };
}

export function validateVerbalizedReading(plan: InterpretationPlan, result: DeepReadingResult): VerbalizerValidationResult {
  const text = [result.core_conclusion, result.interpretation, result.uncertainty, result.time_window].filter(Boolean).join("\n");
  const issues: string[] = [];
  for (const heading of ["整体解读", "牌面依据", "趋势总结"]) {
    if (!text.includes(heading)) issues.push(`missing_section:${heading}`);
  }
  if (plan.evidenceSummary.length && !mentionsEnoughEvidence(plan, text)) issues.push("missing_key_evidence");
  if (containsForbiddenHighRiskClaim(text)) issues.push("forbidden_high_risk_claim");
  if (containsInternalLanguageLeakage(plan, text)) issues.push("internal_language_leakage");
  if (containsExcessiveHedging(plan, text)) issues.push("excessive_hedging");
  if (containsCertaintyOverreach(text)) issues.push("certainty_overreach");
  if (/核心主题是当前主题|当前状态之后转入下一步|当前结构没有形成明确推进方向|没有完全收束|结构走向，而不是压成是或否/.test(text)) issues.push("tautological_placeholder");
  if (/\b(?:[a-z]+_){1,}[a-z0-9]+\b/.test(text)) issues.push("internal_enum_leakage");
  return { valid: issues.length === 0, issues };
}

function mentionsEnoughEvidence(plan: InterpretationPlan, text: string) {
  const pairs = plan.pairEvidence.map((pair) => [pair.leftCard.split(" / ")[0], pair.rightCard.split(" / ")[0]]);
  const mentioned = pairs.filter(([left, right]) => text.includes(left) && text.includes(right)).length;
  return mentioned >= Math.min(2, pairs.length);
}

function containsForbiddenHighRiskClaim(text: string) {
  return sentences(text).some((sentence) => {
    if (isGuardrailSentence(sentence)) return false;
    return /(?:确认|确定|一定|必然).{0,8}(?:第三者|出轨|怀孕|疾病|诊断|结婚|分手|复合|发财|亏损|违法)/.test(sentence);
  });
}

function containsInternalLanguageLeakage(plan: InterpretationPlan, text: string) {
  if (/相关因素|当前主题|当前状态|下一步|描述或限定|绑定主题|沟通或信息传递|MISSING_USER_FACING_SEMANTICS|forbiddenClaims|internalGuardrails/.test(text)) return true;
  if (/(?:不得确认|不得新增|不得把|禁止|内部约束|安全边界)/.test(text)) return true;
  return plan.forbiddenClaims.some((claim) => text.includes(claim));
}

function containsCertaintyOverreach(text: string) {
  return sentences(text).some((sentence) => !isGuardrailSentence(sentence) && /(?:一定|必然|肯定会|已经确定|板上钉钉|毫无疑问)/.test(sentence));
}

function containsExcessiveHedging(plan: InterpretationPlan, text: string) {
  const hedgeMatches = text.match(/暂时不能把话说死|可能是.{0,12}也可能是|仍保留弹性|过程仍保留弹性|牌面还不足以直接下结论|相邻组合存在不止一种合理解释|多种合理解释|还不能确定|不能直接定论|仍有多重解释/g) ?? [];
  if (plan.confidence.overall === "high" || plan.confidence.trajectory === "high") return hedgeMatches.length > 0;
  if (plan.confidence.overall === "medium" || plan.confidence.trajectory === "medium") return hedgeMatches.length > 1;
  return hedgeMatches.length > 2;
}

function sentences(text: string) {
  return text.split(/[。！？\n]/).map((sentence) => sentence.trim()).filter(Boolean);
}

function isGuardrailSentence(sentence: string) {
  return /(?:不得|不能|不确认|无法确认|未确认|不要|不把|不代表|不等于|不足以|还不足以|不能直接|不适合直接)/.test(sentence);
}

function naturalUncertaintyText(plan: InterpretationPlan) {
  if (!plan.uncertainties.length) return "";
  if (plan.confidence.overall === "high" || plan.confidence.trajectory === "high") return "";
  if (plan.confidence.overall === "medium" || plan.confidence.trajectory === "medium") {
    return plan.context.domain === "relationship" ? "最终明确的是哪一种具体关系结果，还要看后续互动如何落地。" : "具体落点仍要看后续条件如何落地。";
  }
  if (plan.context.domain === "relationship") {
    return "目前关系里确实有不止一个方向获得支持，因此暂时更适合看主线趋势，而不是下单一结论。";
  }
  return "目前确实有不止一个方向获得支持，更适合按趋势理解，而不是下单一结论。";
}

async function attemptVerbalization(plan: InterpretationPlan, client: AiVerbalizerClient, attempt: number, stricter: boolean) {
  try {
    const content = await client(buildVerbalizerMessages(plan, stricter), attempt);
    const result = assertDeepReadingResult(parseAiJsonObject(content));
    return { result, validation: validateVerbalizedReading(plan, result) };
  } catch (error) {
    return {
      result: deterministicVerbalizerFallback(plan),
      validation: {
        valid: false,
        issues: [error instanceof Error ? error.message : "verbalizer_parse_failed"]
      }
    };
  }
}
