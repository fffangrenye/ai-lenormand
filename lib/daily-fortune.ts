export type CardTone = "positive" | "negative" | "neutral";

export type DailyFortuneCard = {
  number: number;
  nameEn: string;
  nameZh: string;
  tone: CardTone;
  keywords: string[];
};


export const dailyDeck: DailyFortuneCard[] = [
  { number: 1, nameEn: "Rider", nameZh: "骑士", tone: "positive", keywords: ["消息", "行动", "到来"] },
  { number: 2, nameEn: "Clover", nameZh: "三叶草", tone: "positive", keywords: ["机会", "轻松", "短暂"] },
  { number: 3, nameEn: "Ship", nameZh: "船", tone: "neutral", keywords: ["移动", "远方", "变化"] },
  { number: 4, nameEn: "House", nameZh: "房子", tone: "neutral", keywords: ["稳定", "边界", "内在"] },
  { number: 5, nameEn: "Tree", nameZh: "树", tone: "neutral", keywords: ["积累", "耐心", "修复"] },
  { number: 6, nameEn: "Clouds", nameZh: "云", tone: "negative", keywords: ["模糊", "迟疑", "看清"] },
  { number: 7, nameEn: "Snake", nameZh: "蛇", tone: "negative", keywords: ["复杂", "绕路", "灵活"] },
  { number: 8, nameEn: "Coffin", nameZh: "棺材", tone: "negative", keywords: ["结束", "停顿", "放下"] },
  { number: 9, nameEn: "Bouquet", nameZh: "花束", tone: "positive", keywords: ["善意", "回应", "美感"] },
  { number: 10, nameEn: "Scythe", nameZh: "镰刀", tone: "negative", keywords: ["切断", "果断", "小心"] },
  { number: 11, nameEn: "Whip", nameZh: "鞭子", tone: "negative", keywords: ["摩擦", "重复", "节制"] },
  { number: 12, nameEn: "Birds", nameZh: "鸟", tone: "negative", keywords: ["焦虑", "交流", "杂音"] },
  { number: 13, nameEn: "Child", nameZh: "孩子", tone: "positive", keywords: ["开始", "轻盈", "尝试"] },
  { number: 14, nameEn: "Fox", nameZh: "狐狸", tone: "negative", keywords: ["谨慎", "判断", "策略"] },
  { number: 15, nameEn: "Bear", nameZh: "熊", tone: "neutral", keywords: ["力量", "保护", "掌控"] },
  { number: 16, nameEn: "Stars", nameZh: "星星", tone: "positive", keywords: ["方向", "希望", "校准"] },
  { number: 17, nameEn: "Stork", nameZh: "鹳", tone: "positive", keywords: ["调整", "改善", "迁移"] },
  { number: 18, nameEn: "Dog", nameZh: "狗", tone: "positive", keywords: ["支持", "信任", "陪伴"] },
  { number: 19, nameEn: "Tower", nameZh: "塔", tone: "negative", keywords: ["距离", "独立", "规则"] },
  { number: 20, nameEn: "Garden", nameZh: "花园", tone: "positive", keywords: ["公开", "社交", "连接"] },
  { number: 21, nameEn: "Mountain", nameZh: "山", tone: "negative", keywords: ["阻滞", "耐心", "慢下来"] },
  { number: 22, nameEn: "Crossroads", nameZh: "十字路口", tone: "neutral", keywords: ["选择", "分岔", "权衡"] },
  { number: 23, nameEn: "Mice", nameZh: "老鼠", tone: "negative", keywords: ["消耗", "细节", "修补"] },
  { number: 24, nameEn: "Heart", nameZh: "心", tone: "positive", keywords: ["情感", "喜欢", "柔软"] },
  { number: 25, nameEn: "Ring", nameZh: "戒指", tone: "positive", keywords: ["承诺", "合作", "循环"] },
  { number: 26, nameEn: "Book", nameZh: "书", tone: "neutral", keywords: ["未知", "学习", "保留"] },
  { number: 27, nameEn: "Letter", nameZh: "信", tone: "positive", keywords: ["信息", "表达", "记录"] },
  { number: 28, nameEn: "Man", nameZh: "男人", tone: "neutral", keywords: ["人物", "角色", "主动"] },
  { number: 29, nameEn: "Woman", nameZh: "女人", tone: "neutral", keywords: ["人物", "感受", "回应"] },
  { number: 30, nameEn: "Lily", nameZh: "百合", tone: "neutral", keywords: ["成熟", "平静", "克制"] },
  { number: 31, nameEn: "Sun", nameZh: "太阳", tone: "positive", keywords: ["清晰", "主动", "被看见"] },
  { number: 32, nameEn: "Moon", nameZh: "月亮", tone: "neutral", keywords: ["感受", "名誉", "节奏"] },
  { number: 33, nameEn: "Key", nameZh: "钥匙", tone: "positive", keywords: ["关键", "打开", "确定"] },
  { number: 34, nameEn: "Fish", nameZh: "鱼", tone: "positive", keywords: ["流动", "资源", "交换"] },
  { number: 35, nameEn: "Anchor", nameZh: "锚", tone: "positive", keywords: ["稳定", "坚持", "落点"] },
  { number: 36, nameEn: "Cross", nameZh: "十字架", tone: "negative", keywords: ["压力", "承担", "减负"] }
];

export function readingForDailyCard(card: DailyFortuneCard) {
  const [first, second, third] = card.keywords;

  if (card.tone === "negative") {
    return {
      overall: `今天的节奏可能不完全顺手。${card.nameZh}提醒你先看清阻力来自哪里，再决定要不要推进。它不是坏预兆，更像是在说：慢一点、准一点，比强行完成更重要。`,
      love: "感情与人际互动中，少一点猜测，多一点边界感。暂时不急着确认对方态度，先观察真实回应。",
      work: "工作或学习上适合处理细节、修补遗漏，避免在信息不清时做太快的决定。",
      caution: "不要把一时的卡顿放大成最终结论。",
      advice: "今天选一件最消耗你的事，先把它拆小。"
    };
  }

  if (card.tone === "positive") {
    return {
      overall: `今天的主题偏向${first}与${second}。${card.nameZh}带来一种更开放的能量，适合把停在心里的事往前轻轻推一步。它不保证所有事情都会立刻顺利，但会让你更容易看见可行动的入口。`,
      love: "感情互动中更适合自然表达，不需要过度试探。轻松、明确的沟通会比反复揣测更有效。",
      work: "工作或学习上适合推进已有任务，也适合展示成果、发出消息或确认下一步。",
      caution: "状态不错时仍要注意细节，不要把倾向当成绝对结果。",
      advice: "选一件今天最值得推进的事，把它向前推一小步。"
    };
  }

  return {
    overall: `今天更像一个需要调整节奏的日子。${card.nameZh}不要求你立刻得出答案，而是提醒你把注意力放在${first}、${second}和${third}上。事情可以慢慢展开，不必急着定性。`,
    love: "感情与人际中保持开放，但不要为了得到回应而过度解释自己。",
    work: "工作或学习上适合整理信息、确认优先级，把模糊的部分变得更清楚。",
    caution: "不要在还没看全局时急着选择立场。",
    advice: "今天留出一点空白时间，重新整理你的判断。"
  };
}


export type DailyFortune = ReturnType<typeof readingForDailyCard>;
