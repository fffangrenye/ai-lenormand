import {
  ActionFrame,
  AnswerMode,
  Domain,
  HorizonClass,
  Intent,
  PersonContext,
  Perspective,
  QuestionContext,
  QuestionObject,
  Timeframe,
  TimeframeUnit,
  TopicType
} from "./ontology";
import { assertQuestionContext } from "./schema";

type ParserDraft = {
  domain: Domain;
  primaryTopic: TopicType;
  secondaryTopics?: TopicType[];
  object: QuestionObject;
  intent: Intent;
  secondaryIntent?: Intent;
  timeframe: Timeframe;
  people: PersonContext[];
  perspective?: Perspective;
  actionFrame?: ActionFrame;
  answerMode: AnswerMode;
  topicConfidence: number;
  intentConfidence: number;
  peopleConfidence: number;
};

const chineseNumberMap: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

export function parseQuestionContext(question: string): QuestionContext {
  const source = question.trim();
  const text = normalizeQuestion(source);
  const people = detectPeople(text);
  const domain = detectDomain(text);
  const timeframe = detectTimeframe(source, text);
  const intent = detectIntent(text);
  const answerMode = detectAnswerMode(text, intent);
  const topic = detectTopic(text, domain, intent);
  const object = detectObject(source, text, domain, topic.primaryTopic, intent);
  const perspective = detectPerspective(text, people);
  const actionFrame = perspective ? undefined : detectActionFrame(text, people);

  const draft: ParserDraft = {
    domain,
    primaryTopic: topic.primaryTopic,
    secondaryTopics: topic.secondaryTopics,
    object,
    intent,
    timeframe,
    people,
    perspective,
    actionFrame,
    answerMode,
    topicConfidence: topic.confidence,
    intentConfidence: intent === "state" ? 0.58 : 0.78,
    peopleConfidence: people.length > 1 ? 0.82 : 0.68
  };

  return assertQuestionContext(removeEmptyArrays(draft));
}

function normalizeQuestion(question: string) {
  return question.replace(/\s+/g, "").replace(/[？?。！!,.，]/g, "").toLowerCase();
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectDomain(text: string): Domain {
  if (hasMoneySignal(text)) return "money";
  if (hasAny(text, ["考试", "论文", "申请", "学习", "研究"])) return "study";
  if (hasAny(text, ["offer", "老板", "辞职", "职业", "工作", "升职", "面试", "公司"])) return "career";
  if (hasAny(text, ["耳机", "钥匙", "手机", "钱包", "在哪里", "找回来", "丢"])) return "lost_item";
  if (hasRelationshipSignal(text)) return "relationship";
  return "general";
}

function detectTopic(text: string, domain: Domain, intent: Intent): { primaryTopic: TopicType; secondaryTopics?: TopicType[]; confidence: number } {
  if (isActualCommunicationQuestion(text)) {
    return { primaryTopic: "communication", secondaryTopics: ["action_intention"], confidence: 0.88 };
  }

  if (domain === "relationship") {
    if (hasAny(text, ["复合", "重新在一起", "和好"])) return { primaryTopic: "reconciliation", confidence: 0.88 };
    if (hasAny(text, ["谈恋爱", "遇到对象", "新恋情", "开始一段关系", "开始关系", "脱单", "桃花"])) return { primaryTopic: "new_relationship", confidence: 0.9 };
    if (hasAny(text, ["喜欢", "感觉", "爱"])) return { primaryTopic: "feelings_attraction", confidence: 0.86 };
    if (hasAny(text, ["怎么看", "态度"])) return { primaryTopic: "attitude_perception", confidence: 0.86 };
    if (hasAny(text, ["确定关系", "承诺", "在一起"])) return { primaryTopic: "commitment", confidence: 0.84 };
    return { primaryTopic: "relationship_state", confidence: 0.62 };
  }

  if (domain === "career") {
    if (hasAny(text, ["offer", "面试", "录用"])) return { primaryTopic: "job_search", confidence: 0.88 };
    if (hasAny(text, ["辞职", "离职"])) return { primaryTopic: "resignation_change", confidence: 0.88 };
    if (hasAny(text, ["老板", "同事"])) return { primaryTopic: "workplace_relationship", confidence: 0.82 };
    if (hasAny(text, ["方向", "职业"])) return { primaryTopic: "career_direction", confidence: 0.84 };
    return { primaryTopic: "current_job", confidence: 0.62 };
  }

  if (domain === "study") {
    if (hasAny(text, ["考试", "考"])) return { primaryTopic: "exam", confidence: 0.88 };
    if (isStudyProjectObstacle(text)) return { primaryTopic: "academic_project", secondaryTopics: ["research"], confidence: 0.9 };
    if (hasAny(text, ["论文", "研究"])) return { primaryTopic: "research", secondaryTopics: ["learning_progress"], confidence: 0.84 };
    if (hasAny(text, ["申请"])) return { primaryTopic: "application", confidence: 0.86 };
    return { primaryTopic: "learning_progress", confidence: 0.62 };
  }

  if (domain === "money") {
    if (hasAny(text, ["到账", "款", "付款"])) return { primaryTopic: "transaction", confidence: 0.88 };
    if (hasAny(text, ["收入", "工资", "进账", "额外收入", "增加"])) return { primaryTopic: "income", confidence: 0.86 };
    if (hasAny(text, ["财运", "财富", "财务"])) return { primaryTopic: "cashflow", secondaryTopics: ["income"], confidence: 0.84 };
    return { primaryTopic: "cashflow", confidence: 0.66 };
  }

  if (domain === "lost_item") {
    if (intent === "location" || hasAny(text, ["在哪里", "哪儿"])) return { primaryTopic: "location", confidence: 0.9 };
    if (hasAny(text, ["找回来", "找回"])) return { primaryTopic: "recovery", confidence: 0.88 };
    return { primaryTopic: "condition", confidence: 0.6 };
  }

  if (intent === "advice") return { primaryTopic: "general_advice", confidence: 0.62 };
  if (hasHealthLikeSignal(text)) return { primaryTopic: "wellbeing", confidence: 0.72 };
  if (intent === "development") return { primaryTopic: "general_development", confidence: 0.62 };
  return { primaryTopic: "general_state", confidence: 0.55 };
}

function detectObject(source: string, text: string, domain: Domain, topic: TopicType, intent: Intent): QuestionObject {
  if (domain === "money") {
    if (hasAny(text, ["款", "到账", "付款"])) return { type: "payment", label: "款项到账" };
    if (hasAny(text, ["收入", "钱", "财运", "财富", "财务", "进账", "额外收入", "资金"])) return { type: "money", label: source };
    return { type: "event", label: source };
  }
  if (isActualCommunicationQuestion(text)) return { type: "message", label: source };
  if (hasAny(text, ["offer", "录用"])) return { type: "offer", label: "offer" };
  if (hasAny(text, ["老板", "他", "她", "对方"])) return { type: "person", label: source };
  if (hasAny(text, ["考试"])) return { type: "exam", label: "考试" };
  if (hasAny(text, ["申请"])) return { type: "application", label: "申请结果" };
  if (hasAny(text, ["论文", "研究", "项目"]) && isStudyProjectObstacle(text)) return { type: "project", label: hasAny(text, ["论文"]) ? "论文" : source };
  if (hasAny(text, ["论文"]) && hasAny(text, ["文件", "文档", "提交", "发送", "上传", "打印"])) return { type: "document", label: "论文" };
  if (hasAny(text, ["论文"])) return { type: topic === "academic_project" ? "project" : "document", label: "论文" };
  if (domain === "lost_item" || hasAny(text, ["耳机", "钥匙", "手机", "钱包"])) return { type: "item", label: extractItemLabel(source) };
  if (topic === "new_relationship" || hasAny(text, ["谈恋爱", "遇到对象", "新恋情", "开始一段关系", "开始关系", "脱单"])) return { type: "relationship", label: source };
  if (topic === "commitment" || topic === "reconciliation" || hasAny(text, ["关系", "复合", "和好"])) return { type: "relationship", label: source };
  if (hasHealthLikeSignal(text)) return { type: "other", label: source };
  if (intent === "decision" || intent === "outcome") return { type: "event", label: source };
  return { type: "other", label: source };
}

function detectIntent(text: string): Intent {
  if (hasAny(text, ["什么时候", "何时", "几时", "多久"])) return "timing";
  if (hasAny(text, ["还是", "哪个更", "a还是b", "a或b"])) return "comparison";
  if (hasAny(text, ["要不要", "该不该", "是否应该"])) return "decision";
  if (isStudyProjectObstacle(text)) return "obstacle";
  if (hasAny(text, ["为什么", "为何", "原因"])) return "reason";
  if (hasAny(text, ["主动", "会联系", "会找", "采取"])) return "action";
  if (hasAny(text, ["怎么看", "喜欢", "态度", "感觉"])) return "feelings_attitude";
  if (hasAny(text, ["在哪里", "哪儿", "位置"])) return "location";
  if (hasAny(text, ["复合", "重新在一起", "和好"])) return "outcome";
  if (hasAny(text, ["会好吗", "能好吗", "会不会好", "会缓解", "会改善", "能改善", "会有", "会发生", "会谈恋爱", "遇到对象", "开始一段关系", "能拿到", "能通过"])) return "outcome";
  if (hasAny(text, ["能不能解决", "能解决", "会不会成功", "最后能否完成", "最后能不能完成", "能否完成", "能不能完成", "能否通过", "能不能通过", "能不能拿到", "能否拿到"])) return "outcome";
  if (hasAny(text, ["如何", "怎么样", "发展"])) return "development";
  if (hasAny(text, ["能过", "拿到", "结果", "会增加", "找回来", "会确定", "确定关系"])) return "outcome";
  return "state";
}

function isStudyProjectObstacle(text: string) {
  return hasAny(text, ["论文", "研究", "项目"]) && hasAny(text, ["最大问题", "最大的问题", "卡在哪里", "为什么写不完", "主要障碍", "哪里有问题", "为什么推进不了", "推进不了"]);
}

function detectAnswerMode(text: string, intent: Intent): AnswerMode {
  if (intent === "timing" || intent === "location" || intent === "reason" || intent === "description") return "open";
  if (hasAny(text, ["吗", "能不能", "会不会", "是否", "有没有", "要不要", "能过", "拿到", "还能", "会有", "会发生", "能好", "会好"])) return "yes_no";
  if (hasAny(text, ["可能", "概率", "机会大"])) return "likelihood";
  return "open";
}

function detectTimeframe(source: string, text: string): Timeframe {
  const explicit = matchExplicitTimeframe(source, text);
  if (explicit) return explicit;

  const calendar = matchCalendarTimeframe(text);
  if (calendar) return calendar;

  if (hasAny(text, ["未来", "接下来", "之后"])) {
    return {
      scope: "implicit",
      anchor: "now",
      precision: "unspecified",
      sourceText: hasAny(text, ["未来"]) ? "未来" : "接下来",
      normalized: { horizonClass: "open" }
    };
  }

  return {
    scope: "open",
    precision: "unspecified",
    normalized: { horizonClass: "open" }
  };
}

function matchExplicitTimeframe(source: string, text: string): Timeframe | null {
  const halfYearMatch = source.match(/半年\s*(内|以内|之内|前|后)?/) ?? text.match(/半年\s*(内|以内|之内|前|后)?/);
  if (halfYearMatch) {
    const suffix = halfYearMatch[1] ?? "内";
    return {
      scope: "explicit",
      relation: suffix.includes("前") ? "before" : suffix.includes("后") ? "after" : "within",
      value: 6,
      unit: "month",
      anchor: "now",
      precision: "bounded",
      sourceText: halfYearMatch[0],
      normalized: {
        horizonClass: "extended",
        approximateDays: 180
      }
    };
  }

  const pattern = /([0-9一二两三四五六七八九十]+)\s*(小时|天|日|周|星期|个月|月|季度|年)\s*(内|以内|之内|前|后)?/;
  const match = source.match(pattern) ?? text.match(pattern);
  if (!match) return null;

  const value = parseChineseNumber(match[1]);
  const unit = normalizeUnit(match[2]);
  const suffix = match[3] ?? "内";
  const approximateDays = toApproximateDays(value, unit);

  return {
    scope: "explicit",
    relation: suffix.includes("前") ? "before" : suffix.includes("后") ? "after" : "within",
    value,
    unit,
    anchor: "now",
    precision: "bounded",
    sourceText: match[0],
    normalized: {
      horizonClass: getHorizonClass(approximateDays),
      approximateDays
    }
  };
}

function matchCalendarTimeframe(text: string): Timeframe | null {
  if (hasAny(text, ["今年", "本年"])) {
    return {
      scope: "explicit",
      relation: "within",
      value: 1,
      unit: "year",
      anchor: "calendar_period",
      precision: "bounded",
      sourceText: hasAny(text, ["今年"]) ? "今年" : "本年",
      normalized: { horizonClass: "extended", approximateDays: 365 }
    };
  }

  if (hasAny(text, ["下半年"])) {
    return {
      scope: "explicit",
      relation: "within",
      value: 6,
      unit: "month",
      anchor: "calendar_period",
      precision: "bounded",
      sourceText: "下半年",
      normalized: { horizonClass: "extended", approximateDays: 180 }
    };
  }

  if (hasAny(text, ["这个月", "本月"])) {
    return {
      scope: "explicit",
      relation: "within",
      value: 1,
      unit: "month",
      anchor: "calendar_period",
      precision: "bounded",
      sourceText: hasAny(text, ["这个月"]) ? "这个月" : "本月",
      normalized: { horizonClass: "near_term", approximateDays: 30 }
    };
  }

  if (hasAny(text, ["这周", "本周"])) {
    return {
      scope: "explicit",
      relation: "within",
      value: 1,
      unit: "week",
      anchor: "calendar_period",
      precision: "bounded",
      sourceText: hasAny(text, ["这周"]) ? "这周" : "本周",
      normalized: { horizonClass: "short", approximateDays: 7 }
    };
  }

  if (hasAny(text, ["这几天", "这两天"])) {
    const twoDays = text.includes("这两天");
    return {
      scope: "explicit",
      relation: "within",
      value: twoDays ? 2 : 3,
      unit: "day",
      anchor: "now",
      precision: "approximate",
      sourceText: twoDays ? "这两天" : "这几天",
      normalized: { horizonClass: twoDays ? "immediate" : "short", approximateDays: twoDays ? 2 : 3 }
    };
  }

  if (hasAny(text, ["近期", "最近"])) {
    return {
      scope: "implicit",
      anchor: "now",
      precision: "approximate",
      sourceText: text.includes("近期") ? "近期" : "最近",
      normalized: { horizonClass: "near_term", approximateDays: 30 }
    };
  }

  return null;
}

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    const tenValue = tens ? chineseNumberMap[tens] ?? 1 : 1;
    return tenValue * 10 + (ones ? chineseNumberMap[ones] ?? 0 : 0);
  }
  return chineseNumberMap[value] ?? 1;
}

function normalizeUnit(value: string): TimeframeUnit {
  if (value === "小时") return "hour";
  if (value === "周" || value === "星期") return "week";
  if (value === "个月" || value === "月") return "month";
  if (value === "季度") return "quarter";
  if (value === "年") return "year";
  return "day";
}

function toApproximateDays(value: number, unit: TimeframeUnit) {
  if (unit === "hour") return Math.max(1, Math.ceil(value / 24));
  if (unit === "week") return value * 7;
  if (unit === "month") return value * 30;
  if (unit === "quarter") return value * 90;
  if (unit === "year") return value * 365;
  return value;
}

function getHorizonClass(days: number): HorizonClass {
  if (days <= 2) return "immediate";
  if (days <= 14) return "short";
  if (days <= 45) return "near_term";
  if (days <= 120) return "medium_term";
  return "extended";
}

function detectPeople(text: string): PersonContext[] {
  const people: PersonContext[] = [];

  if (hasAny(text, ["我", "我的", "我们"])) {
    people.push({
      id: "self",
      label: "我",
      role: "querent",
      relations: ["self"],
      genderHint: "unknown",
      knownStatus: "known",
      isPrimary: true,
      aliases: ["我", "我的", "我们"]
    });
  }

  if (text.includes("老板")) {
    people.push({
      id: "boss",
      label: "老板",
      role: "counterparty",
      relations: ["boss"],
      genderHint: "unknown",
      knownStatus: "known",
      isPrimary: !people.length,
      aliases: ["老板", "上司"]
    });
  } else if (text.includes("他")) {
    people.push({
      id: "counterparty",
      label: "他",
      role: "counterparty",
      relations: ["unknown_person"],
      genderHint: "male",
      knownStatus: "unclear",
      isPrimary: !people.length,
      aliases: ["他", "对方"]
    });
  } else if (text.includes("她")) {
    people.push({
      id: "counterparty",
      label: "她",
      role: "counterparty",
      relations: ["unknown_person"],
      genderHint: "female",
      knownStatus: "unclear",
      isPrimary: !people.length,
      aliases: ["她", "对方"]
    });
  } else if (text.includes("对方")) {
    people.push({
      id: "counterparty",
      label: "对方",
      role: "counterparty",
      relations: ["unknown_person"],
      genderHint: "unknown",
      knownStatus: "unclear",
      isPrimary: !people.length,
      aliases: ["对方"]
    });
  }

  if (hasAny(text, ["第三者", "第三方", "小三"])) {
    people.push({
      id: "third_party",
      label: "第三方",
      role: "third_party",
      relations: ["unknown_person"],
      genderHint: "unknown",
      knownStatus: "unclear",
      isPrimary: false,
      aliases: ["第三者", "第三方", "小三"]
    });
  }

  return people.length
    ? people
    : [
        {
          id: "self",
          label: "我",
          role: "querent",
          relations: ["self"],
          genderHint: "unknown",
          knownStatus: "known",
          isPrimary: true
        }
      ];
}

function detectPerspective(text: string, people: PersonContext[]): Perspective | undefined {
  if (!hasAny(text, ["怎么看", "如何看待", "对我什么态度"])) return undefined;
  const subject = findNonSelfPerson(people);
  const self = people.find((person) => person.id === "self");
  return {
    subjectPersonId: subject?.id,
    objectPersonId: self?.id
  };
}

function detectActionFrame(text: string, people: PersonContext[]): ActionFrame | undefined {
  if (!isActualCommunicationQuestion(text)) return undefined;
  const actor = hasAny(text, ["他", "她", "对方", "老板"]) ? findNonSelfPerson(people) : people.find((person) => person.id === "self");
  const recipient = actor?.id === "self" ? findNonSelfPerson(people) : people.find((person) => person.id === "self");
  return {
    actorPersonId: actor?.id,
    recipientPersonId: recipient?.id,
    action: "contact"
  };
}

function findNonSelfPerson(people: PersonContext[]) {
  return people.find((person) => person.id !== "self");
}

function extractItemLabel(source: string) {
  const match = source.match(/我的?(.+?)(在哪里|哪儿|还能|能不能|会不会|吗|？|\?)/);
  return match?.[1]?.trim() || source;
}

function hasMoneySignal(text: string) {
  return hasAny(text, ["财运", "财富", "财务", "收入", "款", "到账", "钱", "付款", "工资", "进账", "额外收入", "资金", "资产"]);
}

function hasRelationshipSignal(text: string) {
  if (hasAny(text, ["恋爱", "谈恋爱", "新恋情", "对象", "脱单", "约会", "伴侣", "前任", "暧昧", "复合", "喜欢", "感情", "关系", "确定关系", "和好", "在一起", "爱"])) {
    return true;
  }
  return hasPersonSignal(text) && (isActualCommunicationQuestion(text) || hasAny(text, ["怎么看", "态度", "感觉", "反应", "可爱"]));
}

function hasPersonSignal(text: string) {
  return hasAny(text, ["他", "她", "对方", "dylan", "老板"]);
}

function isActualCommunicationQuestion(text: string) {
  if (hasOutcomeGoodNewsFraming(text)) return false;
  if (hasAny(text, ["微信", "电话", "通知", "联系", "主动找", "找我", "发消息", "发信息", "回消息", "回信息", "收到消息", "收到信息"])) return true;
  if (text.includes("消息") && hasPersonSignal(text)) return true;
  return false;
}

function hasOutcomeGoodNewsFraming(text: string) {
  return hasAny(text, ["好消息", "好消息发生"]) && (hasMoneySignal(text) || hasAny(text, ["工作", "职业", "考试", "申请", "论文", "项目", "财运", "财富"]));
}

function hasHealthLikeSignal(text: string) {
  return hasAny(text, ["脓肿", "症状", "身体", "恢复", "缓解", "改善", "会好", "能好", "病", "疼", "痛"]);
}

function removeEmptyArrays<T extends ParserDraft>(draft: T): T {
  if (draft.secondaryTopics?.length === 0) delete draft.secondaryTopics;
  return draft;
}
