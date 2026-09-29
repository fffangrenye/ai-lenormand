import { BasicAnswerResolution } from "./answer-types";
import { assertValidRenderedReading } from "./renderer-schema";
import { conditionPhrase, likelihoodLeads, processPhrases, resolutionLeads, safetyPhrase, themePhrase, timingPhrase, transitionPhrase } from "./renderer-phrases";
import { FinalRendererInput, LearningRenderDetails, RenderedReading, RendererStyle } from "./renderer-types";

const ENGINE_VERSION = "final-renderer-1.0.0";

export function renderFinalReading(input: FinalRendererInput): RenderedReading {
  const style = input.style ?? "standard";
  const answerLead = buildAnswerLead(input.answer, style);
  const body = buildBody(input, style);
  const timingNote = shouldRenderTiming(input) ? input.tempo ? timingPhrase(input.tempo) || undefined : undefined : undefined;
  const safetyNote = input.answer.safetyFlags?.[0] ? safetyPhrase(input.answer.safetyFlags[0].type) : undefined;
  const conclusion = buildConclusion(input.answer, style);
  const learningDetails = style === "learning" ? buildLearningDetails(input) : undefined;

  return assertValidRenderedReading({
    style,
    headline: buildHeadline(input),
    answerLead,
    body,
    conclusion,
    timingNote,
    safetyNote,
    learningDetails,
    engineVersion: ENGINE_VERSION,
    metadata: {
      engineVersion: ENGINE_VERSION,
      source: "rule_engine"
    }
  });
}

function buildAnswerLead(answer: BasicAnswerResolution, style: RendererStyle) {
  if (answer.resolution === "not_applicable") return undefined;
  if (answer.answerMode !== "yes_no" && answer.answerMode !== "likelihood") return undefined;
  if (style === "learning") {
    return answer.answerMode === "likelihood" ? likelihoodLeads[answer.resolution] : resolutionLeads[answer.resolution];
  }
  return answer.answerMode === "likelihood" ? likelihoodLeads[answer.resolution] : resolutionLeads[answer.resolution];
}

function buildHeadline(input: FinalRendererInput) {
  if (input.answer.resolution === "not_applicable") return "结构倾向";
  if (input.answer.resolution === "not_supported") return "当前不支持";
  if (input.answer.resolution === "unclear") return "暂不明确";
  if (input.answer.resolution === "conditional") return "有条件支持";
  if (input.answer.resolution === "weakly_supported") return "支持偏弱";
  return "倾向支持";
}

function buildBody(input: FinalRendererInput, style: RendererStyle) {
  const parts = [
    themePhrase(input.synthesis.coreTheme.label),
    processPhrases[input.synthesis.mainProcess],
    transitionSentence(input),
    conditionSentence(input),
    uncertaintySentence(input)
  ].filter((item): item is string => Boolean(item));

  if (style === "concise") return concise(parts, input.answer);
  if (style === "learning") return learningBody(parts, input);
  return standard(parts);
}

function transitionSentence(input: FinalRendererInput) {
  const transition = input.synthesis.keyTransitions[0];
  if (!transition) return undefined;
  return transitionPhrase(transition.type, transition.fromConcept, transition.toConcept);
}

function conditionSentence(input: FinalRendererInput) {
  const concepts = [
    ...(input.answer.conditions ?? []).map((condition) => condition.concept),
    ...(input.answer.blockers ?? []).map((blocker) => blocker.concept)
  ];
  const unique = Array.from(new Set(concepts)).slice(0, 2);
  if (!unique.length) return undefined;
  return unique.map(conditionPhrase).join("");
}

function uncertaintySentence(input: FinalRendererInput) {
  const uncertainty = input.answer.uncertainty?.[0];
  if (!uncertainty || input.answer.confidence === "high") return undefined;
  if (uncertainty.type === "timeframe") return undefined;
  if (uncertainty.type === "spread_conflict") return "旁侧或冲突信号让结论需要保留余地。";
  if (uncertainty.type === "semantic_ambiguity") return "这组牌仍保留多重解释，需要结合前面的具体主题一起看。";
  return "目前仍有未定因素。";
}

function buildConclusion(answer: BasicAnswerResolution, style: RendererStyle) {
  if (style === "concise") return undefined;
  if (answer.resolution === "not_supported") return "这里的不支持只针对当前命题，不等于直接否定未来变化。";
  if (answer.resolution === "weakly_supported") return "可以保留可能性，但当前结构给出的支持不够直接。";
  if (answer.resolution === "conditional") return "条件和限制需要一起看，不能只取支持的一面。";
  if (answer.resolution === "not_applicable") return "这里先看牌面主线和条件变化，不把开放式问题强行压成是或否。";
  return undefined;
}

function shouldRenderTiming(input: FinalRendererInput) {
  return input.question.timeframe.scope === "explicit" || input.question.intent === "timing";
}

function concise(parts: string[], answer: BasicAnswerResolution) {
  const selected = parts.slice(0, answer.resolution === "not_applicable" ? 2 : 3).join("");
  return selected.length > 130 ? `${selected.slice(0, 127)}...` : selected;
}

function standard(parts: string[]) {
  return parts.join("");
}

function learningBody(parts: string[], input: FinalRendererInput) {
  const ruleNote = learningRuleNote(input.answer);
  return [...parts, ruleNote].filter(Boolean).join("");
}

function learningRuleNote(answer: BasicAnswerResolution) {
  if (answer.proposition.desiredState === "relationship_reconciliation") return "这里把联系和复合分开处理：沟通迹象只能说明联系层面，不能直接升级成关系恢复。";
  if (answer.proposition.action === "contact") return "这里按行动命题判断：感情、牵连或稳定性不能替代实际联系证据。";
  if (answer.proposition.propositionType === "feeling") return "这里按感情命题判断，承诺或稳定结构不会被当成喜欢的直接证据。";
  if (answer.proposition.desiredState === "progress_or_change") return "这里把时间匹配和命题支持分开：节奏匹配不代表变化命题被支持。";
  return "这里保留上游解析出的主线，不重新按单牌好坏改写结论。";
}

function buildLearningDetails(input: FinalRendererInput): LearningRenderDetails {
  const details: LearningRenderDetails = {
    synthesisReasoning: learningRuleNote(input.answer)
  };
  if (input.synthesis.keyTransitions.length) {
    details.pairExplanations = input.synthesis.keyTransitions.slice(0, 2).map((transition) => ({
      cards: [`${transition.cardIds[0]}`, `${transition.cardIds[1]}`],
      explanation: transitionPhrase(transition.type, transition.fromConcept, transition.toConcept)
    }));
  }
  return details;
}
