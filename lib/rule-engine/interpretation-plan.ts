import { lenormandCards } from "../lenormand-cards";
import { getCardLexiconEntry } from "./lexicon";
import type { PairInterpretation } from "./pair-types";
import { userFacingConceptPhrase } from "./renderer-phrases";
import type { RuleEngineReadingResult } from "./pipeline";
import type { SynthesisConfidence } from "./synthesis-types";

type InterpretationPlanSource = Omit<RuleEngineReadingResult, "interpretationPlan">;
type QuestionContext = RuleEngineReadingResult["questionContext"];
type UserUncertainty = {
  category: "safetyBoundary" | "semanticAmbiguity" | "outcomeUncertainty";
  text: string;
  userVisible: boolean;
};

export type InterpretationPlan = {
  context: {
    domain: string;
    primaryTopic: string;
    intent: string;
    answerMode: string;
    timeframe: RuleEngineReadingResult["questionContext"]["timeframe"];
  };
  cards: Array<{
    cardId: number;
    cardName: string;
    selectedMode: string;
    selectedMeaning: string;
    userFacingMeaning: string;
    semanticAgency: string;
    role: string;
  }>;
  pairEvidence: Array<{
    leftCard: string;
    rightCard: string;
    leftMode: string;
    rightMode: string;
    relation: string;
    subjectCard: string;
    operatorCard?: string;
    semanticMeaning: string;
    userFacingMeaning: string;
    confidence: string;
    ambiguity: "resolved" | "unresolved";
    evidenceSource: string[];
    supports?: string[];
    suppresses?: string[];
  }>;
  coreTheme: string;
  mainProcess: string;
  trajectory: string;
  confidence: {
    coreTheme: SynthesisConfidence;
    mainProcess: SynthesisConfidence;
    trajectory: SynthesisConfidence;
    closingTendency: SynthesisConfidence;
    keyTransitions: SynthesisConfidence;
    overall: SynthesisConfidence;
  };
  keyTransitions: string[];
  closingTendency: string;
  uncertainties: string[];
  uncertaintyProfile: {
    safetyBoundary: UserUncertainty[];
    semanticAmbiguity: UserUncertainty[];
    outcomeUncertainty: UserUncertainty[];
    userVisible: string[];
  };
  forbiddenClaims: string[];
  evidenceSummary: string[];
  versions: {
    engineVersion: string;
    schemaVersion: string;
  };
};

export function buildInterpretationPlan(result: InterpretationPlanSource): InterpretationPlan {
  const cards = result.resolvedCards.map((card) => {
    const lexicon = getCardLexiconEntry(card.cardId);
    const userFacingMeaning = userFacingCardMeaning(card.cardId, card.primaryMode, result.questionContext);
    return {
      cardId: card.cardId,
      cardName: cardLabel(card.cardId),
      selectedMode: card.primaryMode,
      selectedMeaning: userFacingMeaning === "MISSING_USER_FACING_SEMANTICS" ? "MISSING_USER_FACING_SEMANTICS" : userFacingMeaning,
      userFacingMeaning,
      semanticAgency: lexicon?.semanticAgency ?? "mixed",
      role: card.role
    };
  });

  const pairEvidence = result.refinedPairs.map((pair) => pairEvidenceItem(pair, result.questionContext));
  const evidenceSummary = result.refinedPairs.map((pair) => evidenceSummaryForPair(pair, result.questionContext));
  const keyTransitions = result.synthesis.keyTransitions.map((transition) =>
    [userFacingModeMeaning(transition.fromConcept ?? transition.type, result.questionContext), transitionLabel(transition.type), userFacingModeMeaning(transition.toConcept ?? transition.type, result.questionContext)]
      .filter(Boolean)
      .join(" ")
  );
  const uncertainties = [
    ...(result.synthesis.unresolvedPoints ?? []).map((item) => `${uncertaintyConcept(item.concept)}：${uncertaintyLabel(item.type)}`),
    ...(result.answer.uncertainty ?? []).map((item) => `${uncertaintyConcept(item.concept)}：${uncertaintyLabel(item.type)}`)
  ];
  const confidence = confidenceCalibration(result);
  const uncertaintyProfile = buildUncertaintyProfile(result, uncertainties, confidence);

  return {
    context: {
      domain: result.questionContext.domain,
      primaryTopic: result.questionContext.primaryTopic,
      intent: result.questionContext.intent,
      answerMode: result.questionContext.answerMode,
      timeframe: result.questionContext.timeframe
    },
    cards,
    pairEvidence,
    coreTheme: coreThemeMeaning(result, cards),
    mainProcess: processMeaning(result.synthesis.mainProcess),
    trajectory: keyTransitions.length ? keyTransitions.join("；") : result.synthesis.conclusion.summaryConcepts.map((concept) => userFacingModeMeaning(concept, result.questionContext)).filter((phrase) => phrase !== "MISSING_USER_FACING_SEMANTICS").join(" → "),
    confidence,
    keyTransitions,
    closingTendency: closingMeaning(result.synthesis.closingState?.type ?? "open"),
    uncertainties: uncertaintyProfile.userVisible,
    uncertaintyProfile,
    forbiddenClaims: forbiddenClaimsFor(result),
    evidenceSummary,
    versions: {
      engineVersion: result.metadata.engineVersion,
      schemaVersion: result.metadata.schemaVersion
    }
  };
}

export function planForVerbalizer(plan: InterpretationPlan) {
  return {
    context: plan.context,
    cards: plan.cards.map(({ cardName, selectedMeaning, userFacingMeaning, role }) => ({ cardName, selectedMeaning, userFacingMeaning, role })),
    pairEvidence: plan.pairEvidence.map(({ leftCard, rightCard, relation, semanticMeaning, userFacingMeaning, confidence, ambiguity }) => ({
      pair: `${leftCard} → ${rightCard}`,
      relation,
      semanticMeaning,
      userFacingMeaning,
      confidence,
      ambiguity
    })),
    coreTheme: plan.coreTheme,
    mainProcess: plan.mainProcess,
    trajectory: plan.trajectory,
    keyTransitions: plan.keyTransitions,
    closingTendency: plan.closingTendency,
    confidence: plan.confidence,
    uncertaintyProfile: {
      outcomeUncertainty: plan.uncertaintyProfile.outcomeUncertainty.filter((item) => item.userVisible),
      semanticAmbiguity: plan.uncertaintyProfile.semanticAmbiguity.filter((item) => item.userVisible),
      safetyBoundary: plan.uncertaintyProfile.safetyBoundary.filter((item) => item.userVisible)
    },
    internalGuardrails: plan.forbiddenClaims,
    evidenceSummary: plan.evidenceSummary,
    versions: plan.versions
  };
}

function pairEvidenceItem(pair: PairInterpretation, context: QuestionContext): InterpretationPlan["pairEvidence"][number] {
  const relation = pair.primaryRelation;
  return {
    leftCard: cardLabel(pair.leftCardId),
    rightCard: cardLabel(pair.rightCardId),
    leftMode: userFacingModeMeaning(relation.subjectModeId, context),
    rightMode: relation.operatorModeId ? userFacingModeMeaning(relation.operatorModeId, context) : "相邻线索",
    relation: relationLabel(relation.relation),
    subjectCard: cardLabel(relation.subjectCardId),
    operatorCard: relation.operatorCardId ? cardLabel(relation.operatorCardId) : undefined,
    semanticMeaning: semanticMeaningForPair(pair, context),
    userFacingMeaning: pairUserFacingMeaning(pair, context),
    confidence: relation.confidence,
    ambiguity: pair.unresolved ? "unresolved" : "resolved",
    evidenceSource: Array.from(new Set(relation.evidence.map((item) => item.source))),
    supports: pair.neighborEvidence.flatMap((item) => item.supportsModes ?? []).map((mode) => userFacingModeMeaning(mode, context)),
    suppresses: pair.neighborEvidence.flatMap((item) => item.suppressesModes ?? []).map((mode) => userFacingModeMeaning(mode, context))
  };
}

function evidenceSummaryForPair(pair: PairInterpretation, context: QuestionContext) {
  return `${cardLabel(pair.leftCardId)} → ${cardLabel(pair.rightCardId)}：${pairUserFacingMeaning(pair, context)}`;
}

function semanticMeaningForPair(pair: PairInterpretation, context: QuestionContext) {
  const relation = pair.primaryRelation;
  const subject = userFacingModeMeaning(relation.subjectModeId, context);
  const operator = relation.operatorModeId ? userFacingModeMeaning(relation.operatorModeId, context) : "相邻线索";
  const label = relationLabel(relation.relation);
  if (relation.relation === "finalize" || relation.relation === "end") return `${subject}受到${operator}影响，呈现阶段收束或到达一个压力节点。`;
  if (relation.relation === "burden") return `${operator}把压力、责任或现实重量加到${subject}上。`;
  if (relation.relation === "describe") return `${operator}把重点带回${subject}，让这个主题更具体。`;
  if (relation.relation === "modify") return `${operator}修饰${subject}，让主题呈现更小、更早期或更轻量的形态。`;
  if (relation.relation === "hide") return `${subject}与${operator}之间仍有不清楚或未显露的部分。`;
  if (relation.relation === "communicate") return `${subject}需要通过${operator}表现出来。`;
  if (relation.relation === "confirm") return `${operator}让${subject}更明确或被确认。`;
  return `${subject}与${operator}形成${label}关系。`;
}

function pairUserFacingMeaning(pair: PairInterpretation, context: QuestionContext) {
  const relation = pair.primaryRelation;
  const left = cardLabel(pair.leftCardId);
  const right = cardLabel(pair.rightCardId);
  const leftName = left.split(" / ")[0];
  const rightName = right.split(" / ")[0];
  const subject = userFacingModeMeaning(relation.subjectModeId, context);
  const operator = relation.operatorModeId ? userFacingModeMeaning(relation.operatorModeId, context) : "后续牌面线索";
  const relationship = context.domain === "relationship";

  if (relationship && pair.leftCardId === 34 && pair.rightCardId === 12) {
    return "关系里的投入、流动和互动状态，会通过双方的沟通、回应或来回交流表现出来。";
  }
  if (relationship && pair.leftCardId === 12 && pair.rightCardId === 5) {
    return "沟通之后，重点转向这段关系能否慢慢沉淀、持续成长或扎下根。";
  }
  if (relationship && pair.leftCardId === 5 && pair.rightCardId === 29) {
    return "长期发展和关系根基的问题，会落到女性当事人的感受、位置或选择上。";
  }
  if (relationship && pair.leftCardId === 29 && pair.rightCardId === 25) {
    return "女性当事人与这段关系的明确程度、稳定感或承诺主题被连在一起，但不直接等于婚姻结论。";
  }
  if (relationship && pair.leftCardId === 25 && pair.rightCardId === 29) {
    return "关系的约定、绑定或稳定主题，会把焦点带到女性当事人的态度与位置上。";
  }

  if (relation.relation === "communicate") return `${leftName}到${rightName}显示：${subject}需要通过${operator}表达、传递或被看见。`;
  if (relation.relation === "describe") return `${rightName}让${leftName}的主题更具体：重点落在${subject}与${operator}的关系上。`;
  if (relation.relation === "bind") return `${leftName}与${rightName}把${subject}和${operator}连接起来，使关系、约定或持续性成为重点。`;
  if (relation.relation === "stabilize") return `${leftName}到${rightName}让${subject}更偏向${operator}，但这只是稳定或停驻的结构，不自动代表好结果。`;
  if (relation.relation === "hide") return `${leftName}与${rightName}之间还有未说清或未显露的部分，${subject}暂时不能完全看透。`;
  if (relation.relation === "confirm") return `${rightName}让${leftName}所指的${subject}更容易被看清或确认。`;
  if (relation.relation === "unlock") return `${rightName}给${leftName}所指的${subject}带来突破口或打开方式。`;
  if (relation.relation === "erode") return `${leftName}到${rightName}显示${subject}被持续消耗、削弱或拖低。`;
  if (relation.relation === "block") return `${leftName}到${rightName}显示${subject}遇到阻碍、延迟或现实阻力。`;
  if (relation.relation === "end" || relation.relation === "finalize") return `${leftName}到${rightName}显示${subject}进入阶段收束、停下或需要结束旧状态。`;
  if (relation.relation === "sequence") return `${leftName}之后接着${rightName}，主线从${subject}转入${operator}。`;
  if (relation.relation === "burden") return `${leftName}到${rightName}让${subject}带上压力、责任或现实重量。`;
  if (relation.relation === "modify") return `${rightName}改变了${leftName}的表达方式，使${subject}呈现为${operator}这一层。`;
  return `${leftName}与${rightName}共同指向${subject}和${operator}之间的${relationLabel(relation.relation)}。`;
}

function userFacingCardMeaning(cardId: number, modeId: string, context: QuestionContext) {
  const relationship = context.domain === "relationship";
  const study = context.domain === "study";
  const career = context.domain === "career";
  const money = context.domain === "money";

  if (relationship) {
    if (cardId === 34) return "关系里的流动、投入、互动和情感资源";
    if (cardId === 12) return "双方的沟通、互动、来回交流和口头表达";
    if (cardId === 22) return "关系中的选择、岔路和可能方向";
    if (cardId === 5) {
      if (modeId === "health_wellbeing") return "关系中的恢复力和长期状态";
      return "关系能否持续成长、慢慢扎根或形成长期发展";
    }
    if (cardId === 29) return "女性当事人、她的感受位置和关系中的个人立场";
    if (cardId === 28) return "男性当事人、他的感受位置和关系中的个人立场";
    if (cardId === 25) return "关系是否更明确、稳定，或形成约定与承诺主题";
    if (cardId === 32 && /career|recognition/.test(modeId)) return "感情里的被看见、情绪投射和吸引感";
  }

  if (study) {
    if (cardId === 34) return "资料量、研究深度和信息流动";
    if (cardId === 5 && modeId === "health_wellbeing") return "长期精力、状态和可持续性";
    if (cardId === 20) return "公开呈现、受众和学术场域";
  }

  if (career) {
    if (cardId === 34) return "资源流动、业务机会或工作资源";
    if (cardId === 5) return "长期积累、职业根基和稳定发展";
  }

  if (money && cardId === 34) return "资金、收入、现金流和资源周转";
  if (cardId === 5 && context.intent !== "location") return "长期发展、根基、成长和持续性";
  if (cardId === 25 && relationship) return "关系约定、承诺、连接和稳定主题";

  return userFacingModeMeaning(modeId, context);
}

function userFacingModeMeaning(modeId: string, context: QuestionContext) {
  const genericModes: Record<string, string> = {
    change: "状态变化",
    communicate: "沟通推进",
    confirm: "逐渐确认",
    clarify: "逐渐清楚",
    hide: "模糊或未显露",
    bind: "关系连接",
    stabilize: "趋向稳定或停驻",
    sequence: "后续发展",
    associate: "彼此关联",
    adjacent_context: "后续牌面线索"
  };
  if (genericModes[modeId]) return genericModes[modeId];

  if (context.domain === "relationship") {
    const relationshipModes: Record<string, string> = {
      abundance_quantity: "情感投入、互动量和关系资源",
      cashflow_circulation: "关系里的流动、回应和投入循环",
      money_finance: "关系里的投入感和资源流动",
      business_transaction: "关系中的交换、投入和回应模式",
      depth: "关系的深度和持续投入",
      oral_communication: "口头沟通、互动和来回交流",
      anxiety_noise: "沟通里的焦虑、杂音或反复讨论",
      long_term_growth: "长期成长、慢慢扎根和持续发展",
      roots_foundation: "关系根基、基础和稳定来源",
      family_roots: "关系中的家庭感或根源议题",
      inertia_duration: "关系里拖得较久、节奏偏慢的状态",
      network_system: "关系背后的长期系统和连接",
      commitment_bond: "关系连接、约定和承诺主题",
      romantic_commitment: "感情承诺和关系确认主题",
      female_person_anchor: "女性当事人的位置和态度",
      male_person_anchor: "男性当事人的位置和态度"
    };
    if (relationshipModes[modeId]) return relationshipModes[modeId];
  }

  const phrase = userFacingConceptPhrase(modeId, "");
  if (modeId === "choice_options") return context.domain === "relationship" ? "关系中的选择、岔路和可能方向" : "选择、岔路和可能方向";
  return phrase || "MISSING_USER_FACING_SEMANTICS";
}

function coreThemeMeaning(result: InterpretationPlanSource, cards: InterpretationPlan["cards"]) {
  const direct = userFacingModeMeaning(result.synthesis.coreTheme.label, result.questionContext);
  if (direct !== "MISSING_USER_FACING_SEMANTICS") return direct;
  if (result.questionContext.domain === "relationship") {
    const relationshipCards = cards.map((card) => card.userFacingMeaning).filter((meaning) => meaning !== "MISSING_USER_FACING_SEMANTICS");
    if (relationshipCards.some((meaning) => /关系|沟通|互动|承诺|长期|女性|男性/.test(meaning))) return "关系互动、长期发展和关系位置的逐步明确";
  }
  const firstConcrete = cards.find((card) => card.userFacingMeaning !== "MISSING_USER_FACING_SEMANTICS")?.userFacingMeaning;
  return firstConcrete ?? "MISSING_USER_FACING_SEMANTICS";
}

function confidenceCalibration(result: InterpretationPlanSource): InterpretationPlan["confidence"] {
  const unresolved = result.synthesis.unresolvedPoints ?? [];
  const unresolvedConflictCount = unresolved.filter((item) => isOutcomeAffectingUnresolved(item.type)).length;
  const unresolvedPairCount = result.refinedPairs.filter((pair) => pair.unresolved).length;
  const highPairCount = result.refinedPairs.filter((pair) => pair.primaryRelation.confidence === "high").length;
  const mediumPairCount = result.refinedPairs.filter((pair) => pair.primaryRelation.confidence === "medium").length;
  const keyTransitionConfidence = lowestConfidence(result.synthesis.keyTransitions.map((transition) => transition.confidence));
  const closingConfidence = result.synthesis.closingState?.confidence ?? result.synthesis.confidence;
  const synthesisConfidence = result.synthesis.confidence;
  const hasTrajectory = result.synthesis.keyTransitions.length > 0 || result.synthesis.conclusion.summaryConcepts.length > 1;

  const pairAgreement: SynthesisConfidence =
    highPairCount >= Math.max(2, result.refinedPairs.length - 1) ? "high" : highPairCount + mediumPairCount >= Math.max(1, result.refinedPairs.length - unresolvedPairCount) ? "medium" : "low";

  const trajectory: SynthesisConfidence =
    unresolvedConflictCount >= 2 ? "low" : hasTrajectory && keyTransitionConfidence === "high" && pairAgreement !== "low" ? "high" : hasTrajectory && pairAgreement !== "low" ? "medium" : "low";

  const coreTheme = unresolved.some((item) => item.type === "topic_conflict") ? "medium" : result.synthesis.coreTheme.confidence;
  const mainProcess = result.synthesis.mainProcess === "mixed" || result.synthesis.mainProcess === "none" ? "low" : unresolvedConflictCount ? minConfidence(synthesisConfidence, "medium") : synthesisConfidence;

  return {
    coreTheme,
    mainProcess,
    trajectory,
    closingTendency: unresolved.some((item) => item.type === "closing_conflict") ? "low" : closingConfidence,
    keyTransitions: keyTransitionConfidence,
    overall: lowestConfidence([coreTheme, mainProcess, trajectory, closingConfidence])
  };
}

function buildUncertaintyProfile(result: InterpretationPlanSource, rawUncertainties: string[], confidence: InterpretationPlan["confidence"]): InterpretationPlan["uncertaintyProfile"] {
  const safetyBoundary = forbiddenClaimsFor(result).map((text) => ({ category: "safetyBoundary" as const, text, userVisible: safetyBoundaryShouldBeVisible(result, text) }));
  const unresolved = result.synthesis.unresolvedPoints ?? [];
  const semanticAmbiguity = unresolved
    .filter((item) => !isOutcomeAffectingUnresolved(item.type))
    .map((item) => ({
      category: "semanticAmbiguity" as const,
      text: `${uncertaintyConcept(item.concept)}：${uncertaintyLabel(item.type)}`,
      userVisible: false
    }));

  const outcomeCandidates = [
    ...unresolved
      .filter((item) => isOutcomeAffectingUnresolved(item.type))
      .map((item) => `${uncertaintyConcept(item.concept)}：${uncertaintyLabel(item.type)}`),
    ...rawUncertainties.filter((item) => /时间|过程方向|旁侧信息|人物指向|解释边界|结论|结果|关系本身/.test(item))
  ];
  const uniqueOutcome = Array.from(new Set(outcomeCandidates));
  const shouldExposeOutcome = confidence.overall === "low" || confidence.trajectory === "low" || uniqueOutcome.some((item) => /过程方向|旁侧信息|人物指向|结论|结果/.test(item));
  const outcomeUncertainty = uniqueOutcome.slice(0, confidence.overall === "low" ? 2 : 1).map((text) => ({
    category: "outcomeUncertainty" as const,
    text,
    userVisible: shouldExposeOutcome
  }));

  const userVisible = [
    ...outcomeUncertainty.filter((item) => item.userVisible).map((item) => item.text),
    ...safetyBoundary.filter((item) => item.userVisible).map((item) => item.text)
  ].slice(0, confidence.overall === "low" ? 2 : 1);

  return { safetyBoundary, semanticAmbiguity, outcomeUncertainty, userVisible };
}

function isOutcomeAffectingUnresolved(type: string) {
  return ["process_conflict", "closing_conflict", "mirror_conflict", "person_conflict", "topic_conflict", "certainty_conflict"].includes(type);
}

function safetyBoundaryShouldBeVisible(result: InterpretationPlanSource, claim: string) {
  const directFactualQuestion = result.questionContext.answerMode === "yes_no" || result.questionContext.intent === "outcome";
  const asksRelationshipFact = result.questionContext.domain === "relationship" && /第三者|出轨|结婚|分手|复合|排他/.test(claim);
  return directFactualQuestion && asksRelationshipFact && result.synthesis.confidence !== "high";
}

function lowestConfidence(values: Array<SynthesisConfidence | undefined>): SynthesisConfidence {
  if (values.includes("low")) return "low";
  if (values.includes("medium")) return "medium";
  return "high";
}

function minConfidence(left: SynthesisConfidence, right: SynthesisConfidence): SynthesisConfidence {
  return lowestConfidence([left, right]);
}

function cardLabel(cardId: number) {
  const card = lenormandCards.find((item) => item.number === cardId);
  return card ? `${card.nameZh} / ${card.nameEn}` : `Card ${cardId}`;
}

function relationLabel(relation: string) {
  const labels: Record<string, string> = {
    describe: "描述",
    modify: "修饰",
    act_on: "作用于",
    change: "转变",
    block: "阻碍",
    end: "结束",
    cut: "切断",
    erode: "消耗",
    confirm: "确认",
    unlock: "打开",
    bind: "连接",
    stabilize: "固定",
    publicize: "公开",
    pluralize: "增加",
    clarify: "澄清",
    hide: "隐藏/不明",
    communicate: "沟通",
    repeat: "反复",
    intensify: "加强",
    burden: "加重负担",
    finalize: "收束",
    sequence: "后续转入",
    associate: "关联"
  };
  return labels[relation] ?? relation;
}

function transitionLabel(type: string) {
  const labels: Record<string, string> = {
    change: "转向",
    end: "收束到",
    burden: "承受",
    communicate: "沟通到",
    confirm: "确认到",
    clarify: "澄清到",
    hide: "变得模糊于",
    bind: "连接到",
    stabilize: "固定到",
    block: "受阻于"
  };
  return labels[type] ?? type;
}

function processMeaning(process: string) {
  const labels: Record<string, string> = {
    stable: "状态偏稳定",
    developing: "仍在发展",
    changing: "正在变化",
    improving: "阻碍之后转向更清楚或更顺",
    deteriorating: "过程有走弱迹象",
    blocked: "推进受阻",
    delayed: "节奏被拖慢",
    eroding: "持续消耗",
    ending: "阶段正在收束或结束",
    cutting: "有切断或分离动作",
    repeating: "反复处理",
    clarifying: "从模糊走向清楚",
    confirming: "消息或结果被确认",
    binding: "连接或约定成为主线",
    stabilizing: "状态趋向固定",
    uncertain: "核心仍不确定",
    mixed: "信号混合",
    none: "过程证据不足"
  };
  return labels[process] ?? userFacingConceptPhrase(process);
}

function closingMeaning(closing: string) {
  const labels: Record<string, string> = {
    open: "结尾仍保持开放",
    stable: "结尾偏稳定",
    confirmed: "结尾有确认意味",
    blocked: "结尾仍有阻碍",
    delayed: "结尾进度偏慢",
    ended: "结尾有阶段收束",
    changed: "结尾显示状态变化",
    unclear: "结尾仍不清楚",
    burdened: "结尾带压力或负担",
    repeating: "结尾仍有反复",
    improving: "结尾靠向改善",
    deteriorating: "结尾靠向消耗或走弱",
    mixed: "结尾信号混合"
  };
  return labels[closing] ?? userFacingConceptPhrase(closing);
}

function uncertaintyLabel(type: string) {
  const labels: Record<string, string> = {
    pair_unresolved: "相邻组合仍有不止一种合理解释",
    high_ambiguity: "牌义本身保留较高歧义",
    semantic_ambiguity: "语义仍需保留弹性",
    mixed_process: "过程方向混合",
    spread_conflict: "旁侧信息与主线存在张力",
    person_mapping: "人物指向不能完全锁死",
    timeframe: "时间判断需要保留弹性"
  };
  return labels[type] ?? "仍需保留解释余地";
}

function uncertaintyConcept(concept: string) {
  if (/some pair modes remain close alternatives|pair modes/i.test(concept)) return "相邻组合";
  if (/high ambiguity survives synthesis|ambiguity/i.test(concept)) return "牌义歧义";
  const phrase = userFacingConceptPhrase(concept, "");
  return phrase || "解释边界";
}

function forbiddenClaimsFor(result: InterpretationPlanSource) {
  const claims = [
    "不得确认第三者、出轨或排他性事实。",
    "不得确认结婚、分手或复合结果，除非计划明确支持。",
    "不得把压力、负担写成必然失败。",
    "不得把不确定性写成确定事实。",
    "不得新增疾病诊断、怀孕、财务事实或法律事实。"
  ];
  if (result.synthesis.safetyFlags?.some((flag) => flag.type === "third_party_not_confirmed")) claims.push("第三者相关只能作为复杂因素，不得事实化。");
  if (result.synthesis.safetyFlags?.some((flag) => flag.type === "pregnancy_not_confirmed")) claims.push("Child/Stork 等生育象征不得写成确认怀孕。");
  if (result.synthesis.safetyFlags?.some((flag) => flag.type === "health_not_diagnosis")) claims.push("健康相关只能作为象征，不得写成诊断。");
  return Array.from(new Set(claims));
}
