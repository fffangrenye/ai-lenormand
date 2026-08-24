"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";

type CardTone = "positive" | "negative" | "neutral";

type LenormandCard = {
  number: number;
  nameEn: string;
  nameZh: string;
  tone: CardTone;
  score: number;
};

type ResultKind = "YES" | "NO" | "UNCLEAR";
type Stage = "input" | "drawing" | "result";

const deck: LenormandCard[] = [
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

function drawCards() {
  const pool = [...deck];
  const picked: LenormandCard[] = [];

  while (picked.length < 3) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function getResult(cards: LenormandCard[]): ResultKind {
  const score = cards.reduce((sum, card) => sum + card.score, 0);
  if (score >= 2) return "YES";
  if (score <= -2) return "NO";
  return "UNCLEAR";
}

function isUnsuitable(question: string) {
  const patterns = ["怎么办", "怎么看", "为什么", "未来会怎么样", "人生", "关系未来", "几个月", "长期"];
  return patterns.some((pattern) => question.includes(pattern));
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-[#D8D3C5] bg-[#FFFDF8] p-1.5 shadow-entry">
      <div className="relative h-full w-full overflow-hidden rounded-[2px] border border-ink/14">
        <div className="absolute inset-3 border border-clay/20" />
        <div className="absolute left-1/2 top-1/2 h-[44%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sage/24" />
        <div className="absolute left-1/2 top-1/2 h-px w-[52%] -translate-x-1/2 bg-ink/12" />
        <div className="absolute left-1/2 top-1/2 h-[42%] w-px -translate-y-1/2 bg-ink/12" />
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-serif text-[10px] italic tracking-[0.14em] text-ink/46">
          Lenormand
        </p>
      </div>
    </div>
  );
}

function MiniCard({ card, revealed, index }: { card: LenormandCard; revealed: boolean; index: number }) {
  return (
    <motion.div
      className="h-[148px] w-[101px] [perspective:900px]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.68, delay: revealed ? index * 0.14 : 0, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardBack />
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-[4px] border border-[#D8D3C5] bg-[#FFFDF8] shadow-entry [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <img src={getLenormandCardImagePath(card.number)} alt={`${card.nameEn} / ${card.nameZh}`} className="h-full w-full object-fill [-webkit-touch-callout:default]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function mockReading(result: ResultKind, cards: LenormandCard[]) {
  const names = cards.map((card) => card.nameEn).join("、");

  if (result === "YES") {
    return `这组三张牌整体更倾向于“是”。${names} 组合起来，像是事情有推进的空间，但推进方式偏轻、偏试探，不一定马上进入很深的交流。可以把它理解为一个开放的窗口，而不是绝对承诺。`;
  }

  if (result === "NO") {
    return `这组三张牌整体更倾向于“否”。${names} 放在一起，阻力比推动力更明显，短期内事情可能不容易自然发生，或需要先处理现实层面的卡点。这个 No 不是永久结论，只代表当前趋势偏弱。`;
  }

  return `这组三张牌目前不够明确。${names} 之间有推动，也有保留，说明答案还取决于接下来现实中的互动变化。与其立刻定论，不如先观察一个更具体的信号。`;
}

export default function YesNoPage() {
  const [stage, setStage] = useState<Stage>("input");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<LenormandCard[]>([]);
  const [result, setResult] = useState<ResultKind>("UNCLEAR");
  const [revealed, setRevealed] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [unsuitable, setUnsuitable] = useState(false);

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);

  const remaining = useMemo(() => 200 - question.length, [question]);
  const cardSaveHandlers = useCardSpreadLongPressSave(
    () => cards.map((card) => ({ src: getLenormandCardImagePath(card.number), label: `${card.nameEn} / ${card.nameZh}` })),
    "yes-or-no-cards.png"
  );

  function reset() {
    setStage("input");
    setQuestion("");
    setError("");
    setCards([]);
    setResult("UNCLEAR");
    setRevealed(false);
    setInterpretation("");
    setUnsuitable(false);
  }

  function startReading() {
    const trimmed = question.trim();
    setError("");
    setUnsuitable(false);

    if (!trimmed) {
      setError("请先写下你的问题。");
      return;
    }

    if (trimmed.length < 2) {
      setError("请把问题写得更完整一些。");
      return;
    }

    if (trimmed.length > 200) {
      setError("这个问题有点长。Yes or No 更适合一个明确、单一的问题。");
      return;
    }

    if (isUnsuitable(trimmed)) {
      setUnsuitable(true);
      return;
    }

    const picked = drawCards();
    const tendency = getResult(picked);
    setCards(picked);
    setResult(tendency);
    setStage("drawing");

    window.setTimeout(() => setRevealed(true), 900);
    window.setTimeout(() => {
      setInterpretation(mockReading(tendency, picked));
      setStage("result");
    }, 2600);
  }

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

        {stage === "input" ? (
          <div className="flex flex-1 flex-col justify-center py-10">
            <p className="text-center text-[12px] uppercase tracking-[0.28em] text-sage">Quick Answer</p>
            <h1 className="mt-5 text-center font-serif text-[42px] leading-none text-ink">Yes or No</h1>
            <p className="mt-3 text-center text-[15px] leading-6 text-ink/58">写下一个可以用“是 / 否”倾向回答的问题。</p>

            <label htmlFor="question" className="mt-10 text-[12px] uppercase tracking-[0.18em] text-ink/48">
              Your Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 220))}
              placeholder="例如：我今天会收到来自Ta的消息吗？"
              className="mt-3 min-h-[132px] max-h-[220px] w-full resize-none rounded-[4px] border border-ink/14 bg-ivory px-4 py-4 text-[16px] leading-7 text-ink shadow-entry outline-none placeholder:text-ink/30 focus:border-ink/32"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-ink/42">
              <span />
              <span>{remaining}</span>
            </div>

            {error ? <p className="mt-4 text-[14px] leading-6 text-[#9C5E55]">{error}</p> : null}

            {unsuitable ? (
              <div className="mt-4 rounded-[4px] border border-[#D4B0A9] bg-[#FFF8F4] p-4 text-[14px] leading-6 text-ink/64">
                <p>这个问题更适合深度占卜。你可以把它改成一个更明确的 Yes / No 问题。</p>
                <Link href="/login" className="mt-3 inline-block border-b border-ink/24 pb-1 text-[12px] uppercase tracking-[0.14em] text-ink/60">
                  Deep Reading
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={startReading}
              className="mt-7 h-12 rounded-full bg-[#6F2638] px-6 text-[13px] uppercase tracking-[0.14em] text-[#FDF8EF] shadow-entry transition active:translate-y-px"
            >
              开始占卜
            </button>
            <p className="mt-5 text-center text-[12px] leading-5 text-ink/42">不需要登录，不进入项目记忆。</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-8">
            <p className="text-center text-[12px] uppercase tracking-[0.28em] text-sage">Yes or No</p>
            <p className="mx-auto mt-5 max-w-[320px] text-center font-serif text-[22px] leading-7 text-ink">{question}</p>

            <div {...(cards.length ? cardSaveHandlers : {})} className="mt-8 flex justify-center gap-3">
              {cards.map((card, index) => (
                <MiniCard key={`${card.number}-${card.nameEn}`} card={card} revealed={revealed} index={index} />
              ))}
            </div>

            {stage === "drawing" ? (
              <p className="mt-8 text-center text-[13px] uppercase tracking-[0.2em] text-ink/44">正在解读……</p>
            ) : (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                <div className="text-center">
                  <p className="font-serif text-[44px] leading-none text-ink">{result}</p>
                  <p className="mt-2 text-[15px] text-ink/58">
                    {result === "YES" ? "更倾向于“是”" : result === "NO" ? "更倾向于“否”" : "目前不够明确"}
                  </p>
                </div>

                <article className="mt-7 rounded-[4px] border border-ink/12 bg-ivory px-5 py-5 text-[15px] leading-7 text-ink/68 shadow-entry">
                  {interpretation}
                </article>

                <div className="mt-7 grid gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="h-12 rounded-full bg-[#6F2638] px-6 text-[13px] uppercase tracking-[0.14em] text-[#FDF8EF] shadow-entry"
                  >
                    再问一个问题
                  </button>
                  <Link href="/" className="h-12 rounded-full border border-ink/14 px-6 text-center text-[13px] uppercase leading-[48px] tracking-[0.14em] text-ink/58">
                    返回首页
                  </Link>
                  <Link href="/login" className="text-center text-[12px] leading-5 text-ink/42">
                    想更深入地问这件事？
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
