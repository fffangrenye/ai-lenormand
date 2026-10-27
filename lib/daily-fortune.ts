import reviewedDailyCopy from "./daily-fortune-copy.json";

export type CardTone = "positive" | "negative" | "neutral";

export type DailyFortuneCard = {
  number: number;
  nameEn: string;
  nameZh: string;
  tone: CardTone;
  keywords: string[];
};


const cardDefinitions: Omit<DailyFortuneCard, "keywords">[] = [
  { number: 1, nameEn: "Rider", nameZh: "骑士", tone: "positive" },
  { number: 2, nameEn: "Clover", nameZh: "三叶草", tone: "positive" },
  { number: 3, nameEn: "Ship", nameZh: "船", tone: "neutral" },
  { number: 4, nameEn: "House", nameZh: "房子", tone: "neutral" },
  { number: 5, nameEn: "Tree", nameZh: "树", tone: "neutral" },
  { number: 6, nameEn: "Clouds", nameZh: "云", tone: "negative" },
  { number: 7, nameEn: "Snake", nameZh: "蛇", tone: "negative" },
  { number: 8, nameEn: "Coffin", nameZh: "棺材", tone: "negative" },
  { number: 9, nameEn: "Bouquet", nameZh: "花束", tone: "positive" },
  { number: 10, nameEn: "Scythe", nameZh: "镰刀", tone: "negative" },
  { number: 11, nameEn: "Whip", nameZh: "鞭子", tone: "negative" },
  { number: 12, nameEn: "Birds", nameZh: "鸟", tone: "negative" },
  { number: 13, nameEn: "Child", nameZh: "孩子", tone: "positive" },
  { number: 14, nameEn: "Fox", nameZh: "狐狸", tone: "negative" },
  { number: 15, nameEn: "Bear", nameZh: "熊", tone: "neutral" },
  { number: 16, nameEn: "Stars", nameZh: "星星", tone: "positive" },
  { number: 17, nameEn: "Stork", nameZh: "鹳", tone: "positive" },
  { number: 18, nameEn: "Dog", nameZh: "狗", tone: "positive" },
  { number: 19, nameEn: "Tower", nameZh: "塔", tone: "negative" },
  { number: 20, nameEn: "Garden", nameZh: "花园", tone: "positive" },
  { number: 21, nameEn: "Mountain", nameZh: "山", tone: "negative" },
  { number: 22, nameEn: "Crossroads", nameZh: "十字路口", tone: "neutral" },
  { number: 23, nameEn: "Mice", nameZh: "老鼠", tone: "negative" },
  { number: 24, nameEn: "Heart", nameZh: "心", tone: "positive" },
  { number: 25, nameEn: "Ring", nameZh: "戒指", tone: "positive" },
  { number: 26, nameEn: "Book", nameZh: "书", tone: "neutral" },
  { number: 27, nameEn: "Letter", nameZh: "信", tone: "positive" },
  { number: 28, nameEn: "Man", nameZh: "男人", tone: "neutral" },
  { number: 29, nameEn: "Woman", nameZh: "女人", tone: "neutral" },
  { number: 30, nameEn: "Lily", nameZh: "百合", tone: "neutral" },
  { number: 31, nameEn: "Sun", nameZh: "太阳", tone: "positive" },
  { number: 32, nameEn: "Moon", nameZh: "月亮", tone: "neutral" },
  { number: 33, nameEn: "Key", nameZh: "钥匙", tone: "positive" },
  { number: 34, nameEn: "Fish", nameZh: "鱼", tone: "positive" },
  { number: 35, nameEn: "Anchor", nameZh: "锚", tone: "positive" },
  { number: 36, nameEn: "Cross", nameZh: "十字架", tone: "negative" }
];

export type DailyFortune = {
  overall: string;
  love: string;
  work: string;
  caution: string;
  advice: string;
};

const dailyCopy: Record<string, DailyFortune & { keywords: string[] }> = reviewedDailyCopy;

export const dailyDeck: DailyFortuneCard[] = cardDefinitions.map((card) => ({
  ...card,
  keywords: [...dailyCopy[card.number].keywords]
}));

// Resolve each reviewed reading by card number rather than its broad tone.
// The check-in ledger saves this snapshot; past entries keep their original text.
export function readingForDailyCard(card: DailyFortuneCard): DailyFortune {
  const copy = dailyCopy[card.number];
  if (!copy) throw new Error("Unknown daily fortune card");
  const { overall, love, work, caution, advice } = copy;
  return { overall, love, work, caution, advice };
}
