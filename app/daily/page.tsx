"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";

type CardTone = "positive" | "negative" | "neutral";

type LenormandCard = {
  number: number;
  nameEn: string;
  nameZh: string;
  tone: CardTone;
  keywords: string[];
};

type Stage = "idle" | "drawing" | "result";

const deck: LenormandCard[] = [
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

function drawDailyCard() {
  return deck[Math.floor(Math.random() * deck.length)];
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-[#D8D3C5] bg-[#FFFDF8] p-2 shadow-paper">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(33,31,27,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(33,31,27,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative h-full w-full overflow-hidden rounded-[2px] border border-ink/14">
        <div className="absolute inset-4 border border-clay/20" />
        <div className="absolute inset-8 border border-ink/8" />
        <div className="absolute left-1/2 top-1/2 h-[46%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sage/24" />
        <div className="absolute left-1/2 top-1/2 h-[28%] w-[40%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-clay/28" />
        <div className="absolute left-1/2 top-1/2 h-px w-[54%] -translate-x-1/2 bg-ink/12" />
        <div className="absolute left-1/2 top-1/2 h-[46%] w-px -translate-y-1/2 bg-ink/12" />
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-serif text-[13px] italic tracking-[0.16em] text-ink/48">
          Lenormand
        </p>
      </div>
    </div>
  );
}

function DailyCardFace({ card }: { card: LenormandCard }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-[#D8D3C5] bg-[#FFFDF8] shadow-paper">
      <img src={getLenormandCardImagePath(card.number)} alt={`${card.nameEn} / ${card.nameZh}`} className="h-full w-full object-fill [-webkit-touch-callout:default]" />
    </div>
  );
}

function DailyCard({ card, revealed }: { card: LenormandCard | null; revealed: boolean }) {
  const saveHandlers = useCardSpreadLongPressSave(
    () => (card ? [{ src: getLenormandCardImagePath(card.number), label: `${card.nameEn} / ${card.nameZh}` }] : []),
    "daily-reading-cards.png"
  );

  return (
    <div {...(revealed ? saveHandlers : {})} className="mx-auto h-[300px] w-[194px] touch-callout-none [perspective:1000px]">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardBack />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {card ? <DailyCardFace card={card} /> : null}
        </div>
      </motion.div>
    </div>
  );
}

function readingFor(card: LenormandCard) {
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

export default function DailyPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [card, setCard] = useState<LenormandCard | null>(null);

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);
  const [revealed, setRevealed] = useState(false);

  function startDaily() {
    const picked = drawDailyCard();
    setCard(picked);
    setStage("drawing");
    window.setTimeout(() => setRevealed(true), 620);
    window.setTimeout(() => setStage("result"), 1700);
  }

  const reading = card ? readingFor(card) : null;

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-8 pt-5">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[18px] leading-none tracking-[0.04em] text-ink/86">
            AI Lenormand
          </Link>
          <Link href="/" className="border-b border-ink/22 pb-1 text-[12px] uppercase tracking-[0.13em] text-ink/56">
            Home
          </Link>
        </header>

        <div className="flex flex-1 flex-col py-8">
          <p className="text-center text-[12px] uppercase tracking-[0.28em] text-sage">Daily Reading</p>
          <h1 className="mt-5 text-center font-serif text-[40px] leading-none text-ink">今日运势</h1>
          <p className="mx-auto mt-4 max-w-[290px] text-center text-[15px] leading-6 text-ink/58">抽一张牌，看看今天值得留意什么。</p>

          <motion.div
            animate={stage === "idle" ? { y: [0, -8, 0] } : stage === "drawing" ? { y: -10, scale: 0.98 } : { y: 0, scale: 1 }}
            transition={stage === "idle" ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6, ease: "easeOut" }}
            className="mt-9"
          >
            <DailyCard card={card} revealed={revealed} />
          </motion.div>

          {stage === "idle" ? (
            <>
              <button
                type="button"
                onClick={startDaily}
                className="mx-auto mt-9 h-12 rounded-full bg-[#6F2638] px-9 text-[13px] uppercase tracking-[0.14em] text-[#FDF8EF] shadow-entry transition active:translate-y-px"
              >
                抽取今日牌
              </button>
              <p className="mt-5 text-center text-[12px] leading-5 text-ink/42">无需登录，不进入项目记忆。</p>
            </>
          ) : null}

          {stage === "drawing" ? <p className="mt-8 text-center text-[13px] uppercase tracking-[0.2em] text-ink/44">正在解读……</p> : null}

          {stage === "result" && card && reading ? (
            <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-9">
              <p className="text-center text-[12px] uppercase tracking-[0.24em] text-ink/42">
                {new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date())}
              </p>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">今日关键词</h2>
                <p className="mt-3 text-[16px] leading-7 text-ink/64">{card.keywords.join(" / ")}</p>
              </section>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">今日整体</h2>
                <p className="mt-3 text-[16px] leading-8 text-ink/68">{reading.overall}</p>
              </section>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">感情</h2>
                <p className="mt-3 text-[16px] leading-8 text-ink/68">{reading.love}</p>
              </section>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">工作 / 学习</h2>
                <p className="mt-3 text-[16px] leading-8 text-ink/68">{reading.work}</p>
              </section>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">今日注意</h2>
                <p className="mt-3 text-[16px] leading-8 text-ink/68">{reading.caution}</p>
              </section>

              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="font-serif text-[24px] text-ink">今日建议</h2>
                <p className="mt-3 text-[16px] leading-8 text-ink/68">{reading.advice}</p>
              </section>

              <div className="mt-9 grid gap-3">
                <Link href="/" className="h-12 rounded-full bg-[#6F2638] px-6 text-center text-[13px] uppercase leading-[48px] tracking-[0.14em] text-[#FDF8EF] shadow-entry">
                  返回首页
                </Link>
                <Link href="/yes-no" className="h-12 rounded-full border border-ink/14 px-6 text-center text-[13px] uppercase leading-[48px] tracking-[0.14em] text-ink/58">
                  试试 Yes or No
                </Link>
              </div>
            </motion.article>
          ) : null}
        </div>
      </section>
    </main>
  );
}
