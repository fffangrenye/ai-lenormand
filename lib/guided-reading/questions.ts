import type { GuidedMode, GuidedSession } from "./details";

type TopicProfile = { label: string; subject: string; angles: string[]; match: RegExp };

// Topic examples guide the initial plan; later plans follow the actual conversation.
const topics: TopicProfile[] = [
  { label: "关系与感情", subject: "这段关系", match: /感情|爱情|恋爱|下一任|伴侣|前任|复合|暧昧|对象|相亲|桃花|婚姻|分手|他和我|我和他|她和我|我和她|喜欢的人|对方/, angles: ["第一印象", "相处风格", "接触场景", "靠近方式", "吸引所在", "沟通节奏", "彼此配合", "发展空间", "相处中的反差"] },
  { label: "工作与求职", subject: "工作", match: /工作|求职|面试|职场|同事|上司|领导|团队|职业|入职|转岗|跳槽|升职|辞职|事业|创业/, angles: ["工作内容", "团队氛围", "沟通方式", "工作节奏", "能力发挥", "成长机会", "合作边界", "日常挑战", "长期适应"] },
  { label: "学习与成长", subject: "学习", match: /学习|考试|考研|考公|留学|学校|课程|技能|论文|读书|专业|学业/, angles: ["学习节奏", "兴趣所在", "理解方式", "专注条件", "练习反馈", "学习伙伴", "知识连接", "表达方式", "持续动力"] },
  { label: "创作与项目", subject: "这个创作或项目", match: /创作|作品|写作|绘画|设计|内容|账号|视频|项目|产品|开发|灵感/, angles: ["主题风格", "表达方式", "灵感来源", "适合受众", "作品特点", "协作方式", "创作节奏", "反馈方向", "后续延展"] },
  { label: "人际与合作", subject: "彼此的相处", match: /朋友|友谊|人际|合作|客户|家人|父母|室友|社交|关系/, angles: ["相处氛围", "共同话题", "彼此距离", "联系机会", "沟通方式", "支持方式", "合作空间", "互动节奏", "关系变化"] },
  { label: "生活与新体验", subject: "接下来的生活", match: /生活|搬家|城市|旅行|出行|宠物|兴趣|日常|新环境|选择|决定/, angles: ["生活环境", "人际连接", "日常节奏", "兴趣体验", "舒适空间", "新鲜机会", "适应过程", "独处方式", "生活变化"] },
];
const generalTopic: TopicProfile = { label: "开放主题", subject: "这件事", match: /./, angles: ["当前特点", "可能变化", "关联人物", "发生场景", "互动方式", "吸引之处", "支持因素", "潜在差异", "后续发展"] };

const topicQuestions: Record<string, string[]> = {
  "关系与感情": [
    "对方给人的第一印象是什么样？", "我们可能通过什么方式产生交集？", "彼此可能因为什么互相吸引？",
    "对方在相处中可能是什么风格？", "什么样的交流容易让彼此熟悉起来？", "这段关系最初会怎样靠近？",
    "我们可能在哪些方面比较合拍？", "彼此的相处节奏可能是什么样？", "这段关系可能怎样慢慢展开？",
  ],
  "工作与求职": [
    "这份工作的日常内容可能有哪些特点？", "团队氛围可能是什么样？", "和同事配合时可能是什么感觉？",
    "哪些能力可能更有发挥空间？", "工作节奏可能有什么特点？", "我可能接触到哪些新的体验？",
    "这份工作可能带来怎样的成长？", "什么样的沟通方式可能更合适？", "长期相处下来，我可能更看重什么？",
  ],
  "学习与成长": [
    "哪种学习方式可能更适合我？", "我理解新知识时有哪些特点？", "什么样的节奏比较容易坚持？",
    "哪些内容可能更容易激发兴趣？", "什么环境可能更有利于专注？", "与别人一起学习可能带来什么？",
    "我的表达方式可能有哪些长处？", "练习中的反馈可能提示什么？", "继续学下去，可能打开哪些新方向？",
  ],
  "创作与项目": [
    "这个作品最鲜明的特点可能是什么？", "它可能吸引什么样的受众？", "什么样的表达方式比较贴合主题？",
    "灵感可能从哪些体验中出现？", "和别人合作可能带来什么不同？", "创作过程可能呈现怎样的节奏？",
    "作品可能给人留下怎样的印象？", "哪些内容值得继续延展？", "接下来的反馈可能打开什么新角度？",
  ],
  "人际与合作": [
    "彼此相处可能是什么感觉？", "我们容易在哪些话题上聊得来？", "双方可能以什么方式提供支持？",
    "什么样的交流容易拉近距离？", "彼此的做事风格有哪些不同？", "合作时可能形成怎样的配合？",
    "这段关系可能带来什么新体验？", "联系的节奏可能是什么样？", "继续了解之后，印象可能有什么变化？",
  ],
  "生活与新体验": [
    "接下来的日常可能是什么节奏？", "生活环境可能带来哪些新体验？", "我可能接触到什么样的人和事？",
    "哪些兴趣可能慢慢展开？", "什么样的空间可能让我更自在？", "适应过程可能呈现怎样的特点？",
    "生活中可能出现哪些新的连接？", "哪些体验可能让我印象深刻？", "回过头看，这段生活可能带来什么变化？",
  ],
};

export function guidedTopic(question: string) {
  return topics.find(topic => topic.match.test(question)) ?? generalTopic;
}

export function inferGuidedMode(question: string): GuidedMode {
  // Used for mock preview, legacy sessions and invalid/missing model classifications.
  if (/怎么办|怎么做|如何|为什么|为何|原因|阻碍|卡住|卡点|解决|改善|挽回|修复|推进|调整|该不该|要不要|能不能|是否应该|选哪|哪个更|怎么选|还有机会|还能|迟迟|停滞/.test(question)) return "analysis";
  return "exploration";
}

export function guidedSessionMode(session: Pick<GuidedSession, "question" | "mode">): GuidedMode {
  return session.mode ?? inferGuidedMode(session.question);
}

export function guidedFallbackQuestions(question: string, mode: GuidedMode) {
  const { subject, angles, label } = guidedTopic(question);
  const exploration = [
    ...(topicQuestions[label] ?? []),
    ...[
      (angle: string) => `从${angle}来看，${subject}可能是什么样？`,
      (angle: string) => `关于${angle}，可能有什么不同的体验？`,
      (angle: string) => `${angle}还有什么值得深入了解？`,
      (angle: string) => `${angle}与其他方面可能有什么联系？`,
    ].flatMap(writeQuestion => angles.map(writeQuestion)),
  ];
  const analysis = [
    `${subject}目前到了什么阶段？`, `${subject}眼下最主要的阻力是什么？`, `${subject}已经具备哪些推进的条件？`,
    "什么因素可能让现在的情况反复？", "如果继续保持现在的做法，可能怎样发展？", "改变哪个条件可能更有帮助？",
    "还有什么容易被忽略的影响？", "目前有哪些值得保留的优势？", "哪种改变比较容易先尝试？",
    "眼下的分歧可能出在哪里？", "什么情况下会有转机？", "现在适合先等等，还是主动一步？",
    "什么可能影响双方的配合？", "还有没有别的处理方向？", "有什么迹象说明进展开始松动？",
    "我现在能做点什么？", "我可以先从哪一步开始？", "有哪些事适合先放一放？",
    "如果暂时没有变化，还能怎么做？", "看到什么变化时，适合换个办法？", "下一步最值得留意什么？",
  ];
  return mode === "exploration" ? exploration : [...analysis, ...exploration];
}

