"use client";

import Link from "next/link";
import { DailyCheckInPage } from "@/components/DailyCheckInPage";
import { paidSiteEnabled } from "@/lib/paid-local/site-bridge";
import { dailyDeck, readingForDailyCard, type DailyFortuneCard as LenormandCard } from "@/lib/daily-fortune";
import { QuietCardBack } from "@/components/QuietCardBack";
import { AccountMenu } from "@/components/AccountMenu";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";

type Stage = "idle" | "drawing" | "result";

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
    "daily-reading-cards.png",
    () =>
      trackAnalyticsEvent("save_cards", {
        surface: "daily",
        cardNumber: card?.number,
        cardName: card?.nameEn
      })
  );

  return (
    <div {...(revealed ? saveHandlers : {})} className="mx-auto h-[300px] w-[194px] touch-callout-none [perspective:1000px]">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <QuietCardBack />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {card ? <DailyCardFace card={card} /> : null}
        </div>
      </motion.div>
    </div>
  );
}

function ClassicDailyPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [card, setCard] = useState<LenormandCard | null>(null);

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);
  const [revealed, setRevealed] = useState(false);

  function startDaily() {
    const picked = dailyDeck[Math.floor(Math.random() * dailyDeck.length)];
    trackAnalyticsEvent("daily_draw", {
      cardNumber: picked.number,
      cardName: picked.nameEn,
      tone: picked.tone
    });
    setCard(picked);
    setStage("drawing");
    window.setTimeout(() => setRevealed(true), 620);
    window.setTimeout(() => setStage("result"), 1700);
  }

  const reading = card ? readingForDailyCard(card) : null;

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-5 pb-8 pt-5">
        <header className="flex items-center justify-between">
          <Link prefetch={false} href="/" className="font-serif text-[18px] leading-none tracking-[0.04em] text-ink/86">
            Flora Lenormand
          </Link>
          <AccountMenu />
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
                <Link prefetch={false} href="/" className="h-12 rounded-full bg-[#6F2638] px-6 text-center text-[13px] uppercase leading-[48px] tracking-[0.14em] text-[#FDF8EF] shadow-entry">
                  返回首页
                </Link>
                <Link prefetch={false} href="/yes-no" className="h-12 rounded-full border border-ink/14 px-6 text-center text-[13px] uppercase leading-[48px] tracking-[0.14em] text-ink/58">
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

export default function DailyPage() { return paidSiteEnabled ? <DailyCheckInPage /> : <ClassicDailyPage />; }
