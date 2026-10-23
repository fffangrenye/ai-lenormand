"use client";

import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { QuietCardBack } from "@/components/QuietCardBack";
import { TodayCheckIn } from "@/components/TodayCheckIn";
import { HomeEntryArt } from "@/components/HomeEntryArt";
import { useState } from "react";
import { motion } from "framer-motion";

type HomeCard = {
  titleEn: string;
  titleZh: string;
  href: string;
  description: string;
  number: string;
  kind: "daily" | "choice" | "deep";
  color: string;
  idleX: number;
  idleY: number;
  idleRotate: number;
};

// Both the opening card backs and the revealed entries use the same physical size.
const homeCardSizeClass = "h-[252px] w-[168px]";

const cards: HomeCard[] = [
  {
    titleEn: "Daily Fortune",
    titleZh: "每日运势",
    href: "/daily",
    description: "为你清晰地探明一天", number: "01", kind: "daily", color: "#65736A",
    idleX: -36,
    idleY: 12,
    idleRotate: -8
  },
  {
    titleEn: "Yes or No",
    titleZh: "是或否",
    href: "/yes-no",
    description: "对你的选择，快速思考一下", number: "02", kind: "choice", color: "#A16F63",
    idleX: 0,
    idleY: -8,
    idleRotate: 0
  },
  {
    titleEn: "Deep Divination",
    titleZh: "深度占卜",
    href: "/deep",
    description: "登陆后共同穿越复杂的故事", number: "03", kind: "deep", color: "#617179",
    idleX: 36,
    idleY: 12,
    idleRotate: 8
  }
];

function PaperTexture() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(33,31,27,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(33,31,27,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.72),transparent_36%)]" />
    </>
  );
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-[#D8D3C5] bg-[#FFFDF8] p-2 shadow-paper">
      <PaperTexture />
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

function CardFront({ card, active }: { card: HomeCard; active: boolean }) {
  return (
    <Link
      href={card.href}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      aria-label={card.titleZh}
      className="group relative flex h-full w-full flex-col items-center overflow-hidden rounded-[4px] border border-ink/10 bg-[#FFFDF8] px-3 shadow-[0_5px_18px_rgba(33,31,27,0.035)] outline-none transition duration-300 hover:border-ink/25 hover:shadow-[0_8px_24px_rgba(33,31,27,0.06)] focus-visible:ring-2 focus-visible:ring-sage/50"
      style={{ color: card.color }}
    >
      <span className="absolute left-4 top-3 font-serif text-[9px] tracking-[0.16em] opacity-45">{card.number}</span>
      <div className="mt-5 h-[110px] w-[110px] shrink-0"><HomeEntryArt kind={card.kind} /></div>
      <div className="w-full text-center"><h2 className="mt-2 font-serif text-xl leading-7 tracking-[0.12em]">{card.titleZh}</h2><p className="mt-1.5 font-serif text-[10px] leading-4 tracking-[0.04em] opacity-75">{card.titleEn}</p><div className="mx-auto my-3 h-px w-6 bg-current opacity-20" /><p className="text-[9px] leading-5 tracking-[0.02em] opacity-65">{card.description}</p></div>
    </Link>
  );
}

export default function HomePage() {
  const [drawn, setDrawn] = useState(false);

  return (
    <main className={`min-h-dvh bg-paper text-ink ${drawn ? "overflow-hidden" : "overflow-hidden"}`}>
      <section className="mx-auto flex min-h-dvh w-full max-w-[960px] flex-col px-5 pb-5 pt-5">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[18px] leading-none tracking-[0.04em] text-ink/86">
            Flora Lenormand
          </Link>
          <div className="flex items-center gap-2 sm:gap-3"><TodayCheckIn /><AccountMenu /></div>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center">
          <div className={`relative h-[min(690px,calc(100dvh-100px))] min-h-[460px] w-full max-w-[390px] sm:max-w-[820px] overflow-x-hidden ${drawn ? "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "overflow-y-hidden"}`}>
            <button
              type="button"
              onClick={() => setDrawn(true)}
              disabled={drawn}
              aria-label="开启今日雷诺曼之旅"
              className="absolute inset-x-0 top-[112px] z-30 mx-auto h-[260px] w-[270px] touch-manipulation focus:outline-none disabled:pointer-events-none"
            >
              <span className="sr-only">点击卡牌，开启今日雷诺曼之旅</span>
            </button>

            <motion.div
              className="absolute left-1/2 top-[118px] h-[274px] w-[274px]"
              animate={{ y: drawn ? -34 : [0, -9, 0], scale: drawn ? 0.82 : 1, opacity: drawn ? 0 : 1 }}
              transition={drawn ? { duration: 0.62, ease: [0.22, 1, 0.36, 1] } : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ marginLeft: -137 }}
            >
              {cards.map((card, index) => (
                <motion.div
                  key={card.titleEn}
                  className={`absolute left-1/2 top-1/2 ${homeCardSizeClass} [perspective:1000px]`}
                  animate={{
                    x: card.idleX,
                    y: card.idleY,
                    rotate: card.idleRotate,
                    scale: 1
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ marginLeft: -84, marginTop: -126, transformOrigin: "50% 88%" }}
                >
                  <CardBack />
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              initial={false}
              animate={drawn ? { opacity: 0, y: -6 } : { opacity: 1, y: [0, 3, 0] }}
              transition={drawn ? { duration: 0.32 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-x-0 top-[428px] text-center text-[13px] leading-5 text-ink/48"
            >
              点击卡牌，开启今日雷诺曼之旅
            </motion.p>

            <div className="absolute inset-x-0 top-5 mx-auto flex w-full max-w-[300px] flex-col items-center gap-4 pb-10 sm:top-[76px] sm:max-w-none sm:flex-row sm:justify-center sm:gap-6">
              {cards.map((card, index) => (
                <motion.div
                  key={card.titleEn}
                  className={`${homeCardSizeClass} shrink-0 [perspective:1000px]`}
                  initial={false}
                  animate={
                    drawn
                      ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                      : { opacity: 0, y: 150 - index * 8, scale: 0.74, filter: "blur(1.3px)" }
                  }
                  transition={{ duration: 0.72, delay: drawn ? 0.18 + index * 0.16 : 0, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.div
                    className="relative h-full w-full [transform-style:preserve-3d]"
                    animate={{ rotateY: drawn ? 180 : 0 }}
                    transition={{ duration: 0.76, delay: drawn ? 0.58 + index * 0.16 : 0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="absolute inset-0 [backface-visibility:hidden]">
                      <QuietCardBack />
                    </div>
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <CardFront card={card} active={drawn} />
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
