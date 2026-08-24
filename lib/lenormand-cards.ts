export type LenormandCard = {
  number: number;
  slug: string;
  nameEn: string;
  nameZh: string;
};

export const lenormandCards: LenormandCard[] = [
  { number: 1, slug: "rider", nameEn: "Rider", nameZh: "骑士" },
  { number: 2, slug: "clover", nameEn: "Clover", nameZh: "四叶草" },
  { number: 3, slug: "ship", nameEn: "Ship", nameZh: "船" },
  { number: 4, slug: "house", nameEn: "House", nameZh: "房屋" },
  { number: 5, slug: "tree", nameEn: "Tree", nameZh: "树" },
  { number: 6, slug: "clouds", nameEn: "Clouds", nameZh: "云" },
  { number: 7, slug: "snake", nameEn: "Snake", nameZh: "蛇" },
  { number: 8, slug: "coffin", nameEn: "Coffin", nameZh: "棺材" },
  { number: 9, slug: "bouquet", nameEn: "Bouquet", nameZh: "花束" },
  { number: 10, slug: "scythe", nameEn: "Scythe", nameZh: "镰刀" },
  { number: 11, slug: "whip", nameEn: "Whip", nameZh: "鞭子" },
  { number: 12, slug: "birds", nameEn: "Birds", nameZh: "鸟" },
  { number: 13, slug: "child", nameEn: "Child", nameZh: "孩子" },
  { number: 14, slug: "fox", nameEn: "Fox", nameZh: "狐狸" },
  { number: 15, slug: "bear", nameEn: "Bear", nameZh: "熊" },
  { number: 16, slug: "stars", nameEn: "Stars", nameZh: "星星" },
  { number: 17, slug: "stork", nameEn: "Stork", nameZh: "鹳" },
  { number: 18, slug: "dog", nameEn: "Dog", nameZh: "狗" },
  { number: 19, slug: "tower", nameEn: "Tower", nameZh: "塔" },
  { number: 20, slug: "garden", nameEn: "Garden", nameZh: "花园" },
  { number: 21, slug: "mountain", nameEn: "Mountain", nameZh: "山" },
  { number: 22, slug: "crossroads", nameEn: "Crossroads", nameZh: "十字路口" },
  { number: 23, slug: "mice", nameEn: "Mice", nameZh: "老鼠" },
  { number: 24, slug: "heart", nameEn: "Heart", nameZh: "心" },
  { number: 25, slug: "ring", nameEn: "Ring", nameZh: "戒指" },
  { number: 26, slug: "book", nameEn: "Book", nameZh: "书" },
  { number: 27, slug: "letter", nameEn: "Letter", nameZh: "信" },
  { number: 28, slug: "man", nameEn: "Man", nameZh: "男人" },
  { number: 29, slug: "woman", nameEn: "Woman", nameZh: "女人" },
  { number: 30, slug: "lily", nameEn: "Lily", nameZh: "百合" },
  { number: 31, slug: "sun", nameEn: "Sun", nameZh: "太阳" },
  { number: 32, slug: "moon", nameEn: "Moon", nameZh: "月亮" },
  { number: 33, slug: "key", nameEn: "Key", nameZh: "钥匙" },
  { number: 34, slug: "fish", nameEn: "Fish", nameZh: "鱼" },
  { number: 35, slug: "anchor", nameEn: "Anchor", nameZh: "锚" },
  { number: 36, slug: "cross", nameEn: "Cross", nameZh: "十字架" }
];

export function getLenormandCardImagePath(number: number, slug?: string) {
  const card = slug ? lenormandCards.find((item) => item.slug === slug) : lenormandCards.find((item) => item.number === number);
  const cardNumber = card?.number ?? number;
  const cardSlug = card?.slug ?? slug ?? "card";
  return `/cards/lenormand/${String(cardNumber).padStart(2, "0")}-${cardSlug}.png`;
}
