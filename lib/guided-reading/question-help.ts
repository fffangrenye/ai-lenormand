export type GuidedQuestionHelp = {
  category: string;
  message: string;
  suggestions: string[];
  avoidInRecommendations: boolean;
};

type HelpRule = {
  category: string;
  match: RegExp;
  message: string;
  suggestions?: string[];
  avoidInRecommendations?: boolean;
};

// These are instant writing tips, not a safety classifier. The submitted text
// still goes through the existing AI review. No wording is changed automatically.
const rules: HelpRule[] = [
  {
    category: "sensitive",
    match: /出轨|第三者|小三|怀孕|是不是.{0,8}(?:有病|癌症)|诊断|停药|减药|换药|(?:药|治疗).{0,8}(?:该不该|要不要)|官司|起诉|怎么报税|如何报税|(?:股票|基金|虚拟币|比特币).{0,10}(?:买|卖|涨|跌)|(?:买|卖).{0,8}(?:股票|基金|虚拟币|比特币)|贷款|赌博|(?:何时|什么时候|哪天).{0,8}(?:死|去世)|诅咒|消灾|定位.{0,5}(?:他|她|对方)|(?:他|她|对方).{0,8}(?:手机号|电话号码|身份证|微信号)|(?:他|她|对方).{0,4}(?:现在|此刻).{0,4}(?:在哪|哪里)|(?:失踪|失联).{0,8}(?:人|家人|位置|下落|在哪)/,
    message: "这类问题可能涉及敏感隐私、事实指控或医疗、法律、财务等高风险判断，需要现实证据或专业支持。提交后仍需经过问题审查。",
    suggestions: [],
  },
  {
    category: "appearance",
    match: /身高|个子|高矮|(?:对方|他|她|下一任).{0,3}(?:多高|高不高|矮不矮)|几厘米|多少厘米|几公分|长相|颜值|五官|脸型|长得|外貌|帅不帅|帅吗|美不美|胖瘦|胖不胖|瘦不瘦|体重|长(?:什么|啥)样|(?:对方|他|她).{0,8}(?:好看|漂亮)/,
    message: "具体身高、体重和五官很难从牌面准确判断，可能得不到明确回应。换成整体印象或气质，更容易展开。",
    suggestions: ["对方给人的第一印象是什么样？", "对方可能呈现怎样的气质和相处风格？", "彼此可能因为什么互相吸引？"],
  },
  {
    category: "age",
    match: /年龄|几岁|多少岁|多大年纪|多大了|(?:对方|他|她).{0,4}多大|大我|小我|比我大|比我小|年长|年幼|同龄|同岁|出生年份|哪年出生|生日/,
    message: "真实年龄、生日和年龄差需要现实信息，牌面只能提供有限的象征联想。可以换个角度看看成熟度或相处节奏。",
    suggestions: ["对方在相处中可能表现出怎样的成熟度？", "彼此的生活节奏可能有哪些不同？", "我们容易在哪些方面产生共鸣？"],
  },
  {
    category: "identity",
    match: /(?:对方|他|她|下一任|那个人).{0,10}(?:姓什么|叫什么|什么名字|姓名|什么星座|哪个星座|什么血型|哪里人|哪国人|是什么职业|做什么工作|MBTI)|星座是什么|血型是什么/,
    message: "姓名、星座、血型和真实身份很难由牌面核实。询问整体特质、生活方式或相处特点，更容易得到连贯的线索。",
    suggestions: ["对方可能呈现怎样的性格和生活方式？", "相处时，对方比较鲜明的特点可能是什么？", "我们可能在哪些经历或兴趣上产生共鸣？"],
  },
  {
    category: "new_or_known",
    match: /新人.{0,8}旧人|旧人.{0,8}新人|新的人.{0,8}旧的人|熟人.{0,8}陌生人|陌生人.{0,8}熟人|已经认识.{0,8}(?:吗|没有|还是)|(?:认识|见过).{0,4}(?:他|她|对方).{0,4}吗/,
    message: "单张牌未必能区分新人、旧人或确认是否见过。换成联系如何建立、什么让彼此靠近，通常更容易展开。",
    suggestions: ["这段联系可能以什么方式建立起来？", "彼此可能因为什么开始靠近？", "这段互动可能带来怎样的新体验？"],
  },
  {
    category: "lost_item",
    match: /(?:钥匙|钱包|证件|耳机|手机|戒指|东西|物品).{0,10}(?:丢了|丢失|找不到|在哪|哪里)|(?:丢了|丢失|找不到).{0,10}(?:钥匙|钱包|证件|耳机|手机|戒指|东西|物品)/,
    message: "牌面无法准确定位失物，也不能替代实际查找。先回想最后使用的地点并检查失物招领；若继续探索，可以梳理容易遗漏的日常环节。",
    suggestions: ["我回想最近的日常时，有哪些环节容易遗漏？", "整理查找过程时，我可以先从哪里着手？", "最近哪些生活习惯值得我多留意？"],
  },
  {
    category: "location",
    match: /在哪(?:里|儿)?(?:认识|遇到|遇见|见面|出现|工作|生活|见到)|(?:会|将).{0,5}在哪|在哪里|什么地方|哪个城市|哪座城市|哪一座城市|哪个国家|哪个省|具体地点|具体地址|哪条街|哪家店|住哪/,
    message: "牌面很难准确对应城市、店名或地址。可以探索环境氛围、接触场景或互动方式，作为有限的象征联想。",
  },
  {
    category: "date",
    match: /几月|几号|几点|哪天|哪一天|哪一年|何年|具体日期|准确时间|精确时间|多少天|几天后|几个月后|什么时候一定/,
    message: "牌面很难准确对应具体日期或天数。询问发展节奏、影响条件或转机，会更容易得到有用的线索。",
  },
  {
    category: "timing",
    match: /什么时候|啥时候|何时|多久|多长时间/,
    message: "可以看看发展节奏和可能的条件，具体发生时间仍有变数。也可以把问题换成进展如何出现。",
    avoidInRecommendations: false,
  },
  {
    category: "amount",
    match: /(?:工资|薪资|月薪|年薪|收入|薪水|存款).{0,6}(?:多少|几千|几万|高不高)|赚多少钱|具体金额|多少钱|多少万|多少元|几个零|(?:几|多少|具体).{0,4}(?:粉丝|销量|订单|浏览量|播放量)|(?:粉丝|销量|订单|浏览量|播放量).{0,6}(?:多少|几个|几万)/,
    message: "牌面无法可靠计算金额、销量或粉丝数量。可以探索工作条件、内容表现或影响发展的因素，具体数字以实际数据为准。",
  },
  {
    category: "organization",
    match: /具体公司|哪家公司|哪个公司|公司名字|公司名称|学校名字|学校名称|哪个学校|哪所学校|哪所大学|哪个部门|具体岗位名称/,
    message: "具体公司、学校和岗位名称需要实际信息。可以改问环境特点、适应情况或发展方向。",
  },
  {
    category: "thoughts",
    match: /(?:他|她|对方|老板|领导|同事|朋友).{0,10}(?:怎么想|在想什么|想什么|真实想法|真实意图|心里想|内心想|喜不喜欢|爱不爱|喜欢我吗|爱我吗|想我吗|怎么看我)|对我.{0,5}(?:什么感觉|什么想法)|读心|真实内心/,
    message: "牌面可以提供互动倾向的参考，无法替对方确认真实想法。问回应方式、关系距离或沟通空间，通常更容易展开。",
    avoidInRecommendations: false,
  },
  {
    category: "guarantee",
    match: /一定|必定|必然|百分之百|百分百|100\s*%|肯定会|绝对会|注定|命定|命中注定|永远|一辈子|正缘/,
    message: "未来会随选择和现实条件变化，牌面难以作出一定、永远或命定的保证。可以改问目前的倾向与影响条件。",
  },
  {
    category: "result",
    match: /(?:考试|考研|考公|面试|录取|offer|成绩).{0,12}(?:能过|会过|过不过|通过吗|能不能过|能不能上|会不会过|会录取|会被录取|多少分|排名|第几|成功吗)|(?:能不能|会不会|能|会).{0,8}(?:考上|上岸|被录取|拿到offer)|考多少分|考几分|排名第几/i,
    message: "录取、面试和考试结果需要以实际通知为准，牌面只能提供有限的趋势参考。可以看看表现、准备重点与后续发展。",
    avoidInRecommendations: false,
  },
  {
    category: "decision",
    match: /替我决定|帮我做决定|帮我决定|替我做主|直接告诉我选|必须选哪个|必须怎么做/,
    message: "可以比较不同选择的特点、条件和取舍。把最看重的目标写出来，会更容易得到贴近处境的比较。",
    suggestions: ["两个选择各自可能带来什么样的体验？", "哪条路线更贴近我目前最看重的目标？", "作出选择前，有什么条件值得先弄清？"],
    avoidInRecommendations: false,
  },
  {
    category: "broad",
    match: /^(?:我(?:的)?|想看看|想了解|看看|看一下)?(?:未来|人生|命运|运势|感情|事业|工作|学业|生活)(?:怎么样|如何|怎样|会怎样|会怎么样|发展如何|运势如何)?[？?。！!]*$/,
    message: "这个主题可以慢慢探索。若想让每轮更聚焦，可以补充一段时间或最关心的方面。",
    avoidInRecommendations: false,
  },
];

function relatedQuestions(category: string, context: string): string[] {
  if (/学习|考试|考研|考公|学校|学业|成绩/.test(context)) {
    return ["接下来的学习可能呈现怎样的节奏？", "准备过程中，哪些地方值得多留意？", "哪些学习方式可能更适合我？"];
  }
  if (/工作|面试|求职|公司|职业|团队|老板|领导|同事|offer|工资|薪资|收入/i.test(context)) {
    if (category === "thoughts") return ["我在工作配合中可能给人什么样的印象？", "对方在工作交流中可能表现出怎样的回应方式？", "这段工作配合有哪些值得进一步了解的地方？"];
    return ["这份工作的日常内容可能有哪些特点？", "团队氛围和沟通方式可能是什么样？", "求职或工作接下来可能出现怎样的进展？"];
  }
  if (/创作|作品|账号|粉丝|销量|视频|项目|产品|内容/.test(context)) {
    return ["这个作品或项目可能给人留下怎样的印象？", "哪些内容可能更容易产生共鸣？", "接下来的发展可能受到什么因素影响？"];
  }
  if (category === "thoughts") return ["这段互动可能呈现怎样的距离感？", "对方在交流中可能表现出什么样的回应方式？", "彼此还有哪些更了解对方的空间？"];
  if (/感情|关系|恋爱|下一任|前任|伴侣|复合|对方|桃花|相亲|认识|遇见/.test(context)) {
    return category === "location"
      ? ["我们可能通过什么样的场景产生交集？", "这段联系可能以什么方式建立起来？", "彼此可能因为什么开始靠近？"]
      : ["这段关系接下来可能以什么节奏发展？", "什么条件可能让彼此更容易靠近？", "这段关系可能呈现怎样的相处特点？"];
  }
  if (category === "location" || category === "organization") {
    return ["这个环境可能呈现怎样的氛围？", "我适应这个环境时可能遇到什么？", "哪些特点可能更适合我？"];
  }
  return ["这件事接下来可能以什么节奏发展？", "什么条件可能让事情出现转机？", "接下来有哪些方面值得进一步了解？"];
}

export function guidedQuestionHelp(question: string, mainQuestion = ""): GuidedQuestionHelp | null {
  const text = question.normalize("NFKC").trim();
  if (!text) return null;
  const rule = rules.find(rule => rule.match.test(text));
  if (rule) {
    return {
      category: rule.category,
      message: rule.message,
      suggestions: rule.suggestions ?? relatedQuestions(rule.category, `${text} ${mainQuestion}`),
      avoidInRecommendations: rule.avoidInRecommendations ?? true,
    };
  }
  const questionParts = text.split(/[？?；;\n]/).filter(part => part.trim());
  const questionWords = text.match(/为什么|为何|怎么|如何|是否|是不是|能不能|会不会|多少|哪里|什么时候/g) ?? [];
  if (questionParts.length >= 3 || questionWords.length >= 3) {
    return {
      category: "multiple",
      message: "这一轮包含了几个问题，单张牌容易顾此失彼。可以先选一个角度，其他部分留给后面的轮次。",
      suggestions: relatedQuestions("multiple", `${text} ${mainQuestion}`),
      avoidInRecommendations: true,
    };
  }
  return null;
}
