import { BasicAnswerResolutionLevel } from "./answer-types";
import { ClosingStateType, SynthesisMainProcess } from "./synthesis-types";
import { TempoCompatibilityResult } from "./tempo-types";

export const resolutionLeads: Record<Exclude<BasicAnswerResolutionLevel, "not_applicable">, string> = {
  strongly_supported: "当前结构对这个方向支持较强。",
  supported: "整体偏支持。",
  conditional: "有支持，但属于有条件的支持。",
  unclear: "目前还不能形成明确结论。",
  weakly_supported: "目前支持力度偏弱。",
  not_supported: "目前这组信息并不支持这个判断。"
};

export const likelihoodLeads: Record<Exclude<BasicAnswerResolutionLevel, "not_applicable">, string> = {
  strongly_supported: "可能性较高。",
  supported: "有较明显可能。",
  conditional: "有可能，但条件比较明显。",
  unclear: "目前难以判断可能性。",
  weakly_supported: "可能性偏低。",
  not_supported: "当前不太支持。"
};

export const processPhrases: Record<SynthesisMainProcess, string> = {
  stable: "当前结构偏稳定。",
  developing: "事情仍在继续发展。",
  approaching: "有向你靠近或进入视野的趋势。",
  changing: "局面正在发生变化。",
  improving: "阻碍之后出现转向更清楚或更顺的过程。",
  deteriorating: "当前过程有走弱的迹象。",
  blocked: "推进受到明显阻碍。",
  delayed: "过程不是停止，但节奏被拖慢。",
  eroding: "这个状态存在持续消耗。",
  ending: "某个阶段正在收束或结束。",
  cutting: "结构里有切断或分离的动作。",
  repeating: "问题反复出现，需要通过重复处理推进。",
  clarifying: "局面正在从模糊走向更清楚。",
  confirming: "重点落在消息或结果被确认。",
  binding: "连接或约定是当前主线。",
  stabilizing: "当前状态有继续固定下来的趋势。",
  uncertain: "核心仍处在不确定状态。",
  mixed: "结构里有混合信号，方向不够单一。",
  none: "当前结构没有形成明确推进方向。"
};

export const closingPhrases: Record<ClosingStateType, string> = {
  open: "结尾仍是开放状态。",
  stable: "结尾偏稳定。",
  confirmed: "结尾有确认意味。",
  blocked: "结尾仍有阻碍。",
  delayed: "结尾显示进度偏慢。",
  ended: "结尾有阶段收束。",
  changed: "结尾显示状态发生变化。",
  unclear: "结尾仍不清楚。",
  burdened: "结尾带着压力或负担。",
  repeating: "结尾仍有反复。",
  improving: "结尾向改善靠拢。",
  deteriorating: "结尾向消耗或走弱靠拢。",
  mixed: "结尾信号混合。"
};

const conceptPhrases: Record<string, string> = {
  attraction_passion: "吸引与情感兴趣",
  love_affection: "感情与好感",
  emotion_attraction: "情感吸引",
  uncertainty: "不确定",
  confusion: "状态还不够清晰",
  commitment_bond: "绑定或承诺主题",
  romantic_commitment: "关系承诺主题",
  written_message: "书面消息或明确沟通",
  document_paperwork: "书面材料或文件",
  result_notification: "结果通知",
  confirmation_certainty: "确认与明确",
  solution_unlock: "找到突破口",
  importance_significance: "关键意义",
  clarity_illumination: "清晰度",
  success_achievement: "结果达成",
  relief_recovery: "缓和与恢复",
  blockage_obstacle: "阻碍",
  delay_resistance: "延迟与阻力",
  ending_closure: "阶段收束",
  stop_termination: "停止",
  stability_security: "稳定与安全感",
  persistence_duration: "持续性",
  fixed_stagnation: "固定或停滞",
  knowledge_learning: "知识与学习",
  research_investigation: "研究与深入查找",
  project_case: "项目或课题",
  unknown_information: "未知信息",
  secret_hidden: "隐藏信息",
  abundance_quantity: "数量或资源偏多",
  cashflow_circulation: "流动与周转",
  editing_revision_research: "修改、修订或反复打磨",
  practice_discipline: "练习与重复处理",
  simplicity_reduction: "简化与缩小范围",
  new_beginning: "新的开始",
  public_open: "公开呈现",
  social_group: "群体或社交场域",
  network_audience: "受众与外部视野",
  loyalty_trust: "信任与忠诚",
  contact_arrival: "消息或行动靠近",
  movement_progress: "推进",
  oral_communication: "口头沟通",
  anxiety_noise: "焦虑和杂音",
  choice_path: "选择路径",
  decision_point: "需要做选择",
  career_vocation: "事业方向或个人角色感",
  recognition_reputation: "被看见、被认可的状态",
  creativity_inspiration: "感受力与灵感",
  self_image_awareness: "自我感受和被看见的方式",
  intuition_dreams: "直觉与内在感受",
  cycle_phase: "阶段性循环",
  night_month: "月度节奏",
  small_scale: "小范围、轻量或初始阶段",
  early_stage: "早期阶段",
  literal_child: "孩子相关的现实因素",
  female_person_anchor: "这位女性或当事人",
  male_person_anchor: "这位男性或当事人",
  household: "家庭、居所或生活基础",
  home_residence: "居所和生活根基",
  burden_hardship: "压力、负担或困难",
  trial_test: "考验和需要承受的阶段",
  necessity_obligation: "责任和必须面对的议题",
  finalization: "阶段收尾",
  pain_sorrow: "情绪上的沉重感",
  sacrifice_cost: "需要付出的代价",
  ending: "阶段收束",
  finalize: "收束或定局",
  burden: "压力加重",
  describe: "补充描述",
  blocked: "推进受阻",
  none: "过程证据不足",
  relationship_definition_unclear: "关系本身的定义目前仍不明确",
  information_incomplete: "目前的信息仍不完整",
  timeframe_tight: "你问的时间窗口比较紧",
  persistent_state: "当前状态有较强的延续性"
};

const conditionPhrases: Record<string, string> = {
  "relationship definition unclear": "关系本身的定义目前仍不明确。",
  relationship_definition_unclear: "关系本身的定义目前仍不明确。",
  "information remains unclear": "目前的信息仍不完整。",
  information_incomplete: "目前的信息仍不完整。",
  "timeframe unspecified": "你没有给出明确时间范围。",
  "question horizon does not strongly fit process pace": "你问的时间窗口比较紧。",
  timeframe_tight: "你问的时间窗口比较紧。",
  "process structurally blocked": "当前推进受到结构性阻碍。",
  "process delayed rather than stopped": "过程更像被拖慢，而不是完全停止。",
  "open timeframe": "目前缺少明确时间边界。",
  persistent_state: "当前状态有较强的延续性。",
  "fixed duration signal": "当前状态有较强的固定性。",
  "persistent duration signal": "当前状态有较强的延续性。",
  "extended duration signal": "这个过程更偏长期。"
};

const unresolvedPhrases: Record<string, string> = {
  pair_unresolved: "部分组合仍存在不止一种合理解释。",
  high_ambiguity: "目前仍有一些语义上的不确定性。",
  mirror_conflict: "辅助信息与主线之间存在一定张力。",
  person_conflict: "当前涉及的人物指向还不完全唯一。",
  semantic_mode_conflict: "部分牌义之间仍有接近的解释空间。",
  process_conflict: "过程方向存在一定拉扯。",
  closing_conflict: "结尾信号还不够单一。",
  topic_conflict: "主题指向还没有完全收束。",
  certainty_conflict: "确定性不足，需要保留余地。",
  semantic_ambiguity: "目前仍有一些语义上的不确定性。",
  mixed_process: "过程信号比较混合。",
  hidden_information: "仍有信息没有完全显露。",
  person_mapping: "人物指向还不完全唯一。",
  timeframe: "时间边界仍需保留弹性。",
  multiple_options: "当前不止一种可能路径。",
  spread_conflict: "旁侧信息与主线之间存在一定张力。"
};

export function themePhrase(label: string) {
  if (label === "uncertainty around feelings/relationship") return "核心在于感情或关系定义仍不够清楚。";
  if (label === "relationship uncertainty") return "这段关系的定义和态度还没有完全落定。";
  if (label === "trust and bond persistence") return "核心在于信任、连接和持续性的叠加。";
  if (label === "obstacle ending into clearer state") return "主线不是单纯受阻，而是阻碍走向收束后出现更清楚的状态。";
  if (label === "project long-term stabilization") return "核心是项目进入较慢、偏长期固定的推进方式。";
  if (label === "fixed obstacle / slow persistence") return "核心是阻碍和稳定性叠在一起，状态更偏持久。";
  if (label === "written_message") return "核心落在消息、文字或通知的确认。";
  if (label === "project revision / repeated editing") return "核心是项目或文本需要反复修改。";
  if (label === "persistent emotional erosion") return "核心是情绪投入被持续消耗。";
  return `核心主题落在${userFacingConceptPhrase(label)}。`;
}

export function conditionPhrase(concept: string) {
  const exact = conditionPhrases[concept] ?? conceptPhrases[concept];
  if (exact) return exact.endsWith("。") ? exact : `${exact}。`;
  if (/relationship definition unclear/.test(concept)) return "关系本身的定义目前仍不明确。";
  if (/information remains unclear/.test(concept)) return "信息还没有完全清楚。";
  if (/timeframe|window|horizon/.test(concept)) return "你问的时间窗口比较紧。";
  if (/persistent|fixed|extended duration/.test(concept)) return "当前状态有较强的延续性。";
  if (/mirror/.test(concept)) return "旁侧结构对主线有补充或牵制。";
  if (/blocked/.test(concept)) return "推进条件受到阻碍。";
  return "目前仍有一些未定因素。";
}

export function timingPhrase(tempo: TempoCompatibilityResult) {
  if (tempo.compatibility === "well_matched") return "从节奏上看，这个时间窗口与当前过程是匹配的。";
  if (tempo.compatibility === "possible") return "从节奏上看，这个时间窗口可以成立，但不是特别强的时间信号。";
  if (tempo.compatibility === "strained") return `从节奏上看，这个过程偏${tempo.dominantTempo === "slow" ? "慢" : "紧"}，你问的时间窗口比较紧。`;
  if (tempo.compatibility === "mismatched") return "从节奏上看，用户给出的时间窗口与当前过程不太匹配。";
  if (tempo.compatibility === "unknown" && tempo.timeframe.scope === "open") return "";
  return "时间节奏暂时不够明确。";
}

export function safetyPhrase(type: string) {
  if (type === "third_party_not_confirmed") return "这组结构可以提示复杂因素或额外影响，但不能据此确认第三者。";
  if (type === "pregnancy_not_confirmed") return "这里出现了与生育或新阶段相关的象征，但不能替代实际检测或医学判断。";
  if (type === "health_not_diagnosis") return "涉及健康时，这只能作为象征性提示，不能替代医学判断。";
  if (type === "crime_not_attributed") return "这类结构不能直接当作违法或欺骗事实的确认。";
  if (type === "investment_not_guaranteed") return "涉及投资或金钱结果时，不能把牌面当作收益保证。";
  if (type === "legal_not_guaranteed") return "涉及法律结果时，这不能替代专业意见或结果保证。";
  return "高风险事实不能仅凭牌面确认。";
}

export function transitionPhrase(type: string, from?: string, to?: string) {
  const left = from ? userFacingConceptPhrase(from) : undefined;
  const right = to ? userFacingConceptPhrase(to) : undefined;
  if (!left && !right) return transitionTypePhrase(type);
  if (!left) return `${transitionTypePhrase(type)}重点落向${right}。`;
  if (!right) {
    if (type === "end") return `${left}正在走向收束。`;
    if (type === "burden") return `${left}带来压力或负担。`;
    return `${left}正在发生${transitionTypePhrase(type).replace(/。$/, "")}。`;
  }
  if (type === "communicate") return `${left}需要通过实际沟通进入${right}。`;
  if (type === "confirm") return `${left}进一步落到${right}。`;
  if (type === "end") return `${left}正在走向收束。`;
  if (type === "change") return `${left}之后转入${right}。`;
  if (type === "stabilize") return `${left}趋向更固定的${right}。`;
  if (type === "hide") return `${left}和${right}之间仍有不清楚的部分。`;
  if (type === "repeat") return `${left}需要反复处理${right}。`;
  if (type === "clarify") return `${left}正在转向更清楚的${right}。`;
  if (type === "resolve") return `${left}正在寻找进入${right}的办法。`;
  if (type === "bind") return `${left}与${right}之间形成连接。`;
  if (type === "block") return `${left}到${right}之间存在阻碍。`;
  if (type === "delay") return `${left}到${right}之间节奏被拖慢。`;
  if (type === "burden") return `${left}让${right}带上压力或责任。`;
  return `${left}与${right}之间形成联系。`;
}

export function unresolvedPhrase(type: string, concept?: string) {
  return unresolvedPhrases[type] ?? (concept ? conditionPhrase(concept) : "目前仍有一些未定因素。");
}

export function userFacingConceptPhrase(value: string, fallback = "相关因素") {
  const direct = conceptPhrases[value] ?? conditionPhrases[value] ?? unresolvedPhrases[value];
  if (direct) return direct.replace(/。$/, "");
  if (/feel|emotion|attraction|love|heart|passion/i.test(value)) return "感情信号";
  if (/unclear|uncertain|confusion|hidden|unknown|secret|ambigu/i.test(value)) return "不确定因素";
  if (/commitment|bond|ring|relationship/i.test(value)) return "关系主题";
  if (/message|letter|communicat|document|information|confirm|clar/i.test(value)) return "信息与沟通";
  if (/block|obstacle|delay|mountain|stuck/i.test(value)) return "阻碍因素";
  if (/stable|stability|persist|anchor|fixed/i.test(value)) return "持续或固定的状态";
  if (/end|coffin|closure|stop/i.test(value)) return "阶段收束";
  if (/project|research|study|book|revision|editing/i.test(value)) return "项目或学习主题";
  if (/burden|hardship|cross|trial|necessity|obligation|cost/i.test(value)) return "压力、负担或考验";
  if (/child|small|early|minor|begin/i.test(value)) return "小范围或初始阶段";
  if (/woman|female|person.anchor/i.test(value)) return "这位女性或当事人";
  if (/man|male|person.anchor/i.test(value)) return "这位男性或当事人";
  if (/house|home|household|residence|domestic/i.test(value)) return "家庭、居所或生活基础";
  if (/career|vocation|recognition|reputation|self.image|intuition|dream|moon/i.test(value)) return "感受、自我形象或被看见的状态";
  if (/safety|risk|health|pregnancy|legal|investment|crime|third.party/i.test(value)) return "需要谨慎看待的现实议题";
  return fallback;
}

function transitionTypePhrase(type: string) {
  if (type === "end") return "阶段正在收束。";
  if (type === "change") return "状态正在转变。";
  if (type === "burden") return "压力或责任正在变重。";
  if (type === "communicate") return "重点需要通过沟通推进。";
  if (type === "confirm") return "重点正在被确认。";
  if (type === "clarify") return "信息正在变清楚。";
  if (type === "block") return "推进受到阻碍。";
  if (type === "stabilize") return "状态趋向固定。";
  return "牌面之间形成结构联系。";
}
