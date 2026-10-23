export type ResultKind = "YES" | "NO" | "UNCLEAR";

type CardTone = "positive" | "negative" | "neutral";

export type LenormandCard = {
  number: number;
  nameEn: string;
  nameZh: string;
  tone: CardTone;
  score: number;
};

export const yesNoDeck: LenormandCard[] = [
  { number: 1, nameEn: "Rider", nameZh: "骑士", tone: "positive", score: 1 },
  { number: 2, nameEn: "Clover", nameZh: "三叶草", tone: "positive", score: 1 },
  { number: 3, nameEn: "Ship", nameZh: "船", tone: "neutral", score: 0 },
  { number: 4, nameEn: "House", nameZh: "房子", tone: "positive", score: 1 },
  { number: 5, nameEn: "Tree", nameZh: "树", tone: "neutral", score: 0 },
  { number: 6, nameEn: "Clouds", nameZh: "云", tone: "negative", score: -1 },
  { number: 7, nameEn: "Snake", nameZh: "蛇", tone: "negative", score: -1 },
  { number: 8, nameEn: "Coffin", nameZh: "棺材", tone: "negative", score: -1 },
  { number: 9, nameEn: "Bouquet", nameZh: "花束", tone: "positive", score: 1 },
  { number: 10, nameEn: "Scythe", nameZh: "镰刀", tone: "negative", score: -1 },
  { number: 11, nameEn: "Whip", nameZh: "鞭子", tone: "negative", score: -1 },
  { number: 12, nameEn: "Birds", nameZh: "鸟", tone: "neutral", score: 0 },
  { number: 13, nameEn: "Child", nameZh: "孩子", tone: "positive", score: 1 },
  { number: 14, nameEn: "Fox", nameZh: "狐狸", tone: "negative", score: -1 },
  { number: 15, nameEn: "Bear", nameZh: "熊", tone: "positive", score: 1 },
  { number: 16, nameEn: "Stars", nameZh: "星星", tone: "positive", score: 1 },
  { number: 17, nameEn: "Stork", nameZh: "鹳", tone: "positive", score: 1 },
  { number: 18, nameEn: "Dog", nameZh: "狗", tone: "positive", score: 1 },
  { number: 19, nameEn: "Tower", nameZh: "塔", tone: "neutral", score: 0 },
  { number: 20, nameEn: "Garden", nameZh: "花园", tone: "positive", score: 1 },
  { number: 21, nameEn: "Mountain", nameZh: "山", tone: "negative", score: -1 },
  { number: 22, nameEn: "Crossroads", nameZh: "岔路", tone: "neutral", score: 0 },
  { number: 23, nameEn: "Mice", nameZh: "老鼠", tone: "negative", score: -1 },
  { number: 24, nameEn: "Heart", nameZh: "心", tone: "positive", score: 1 },
  { number: 25, nameEn: "Ring", nameZh: "戒指", tone: "positive", score: 1 },
  { number: 26, nameEn: "Book", nameZh: "书", tone: "neutral", score: 0 },
  { number: 27, nameEn: "Letter", nameZh: "信", tone: "positive", score: 1 },
  { number: 28, nameEn: "Man", nameZh: "男人", tone: "neutral", score: 0 },
  { number: 29, nameEn: "Woman", nameZh: "女人", tone: "neutral", score: 0 },
  { number: 30, nameEn: "Lily", nameZh: "百合", tone: "positive", score: 1 },
  { number: 31, nameEn: "Sun", nameZh: "太阳", tone: "positive", score: 1 },
  { number: 32, nameEn: "Moon", nameZh: "月亮", tone: "neutral", score: 0 },
  { number: 33, nameEn: "Key", nameZh: "钥匙", tone: "positive", score: 1 },
  { number: 34, nameEn: "Fish", nameZh: "鱼", tone: "positive", score: 1 },
  { number: 35, nameEn: "Anchor", nameZh: "锚", tone: "positive", score: 1 },
  { number: 36, nameEn: "Cross", nameZh: "十字架", tone: "negative", score: -1 }
];

export function getYesNoResult(cards: ReadonlyArray<{ score: number }>): ResultKind {
  const score = cards.reduce((sum, card) => sum + card.score, 0);
  if (score > 0) return "YES";
  if (score < 0) return "NO";
  return "UNCLEAR";
}
