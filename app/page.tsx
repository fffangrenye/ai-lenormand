"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type HomeCard = {
  titleEn: string;
  titleZh: string;
  href: string;
  imageSrc: string;
  idleX: number;
  idleY: number;
  idleRotate: number;
};

const cards: HomeCard[] = [
  {
    titleEn: "Daily Reading",
    titleZh: "每日运势",
    href: "/daily",
    imageSrc: "/cards/home/daily-fortune-final-v2.png",
    idleX: -36,
    idleY: 12,
    idleRotate: -8
  },
  {
    titleEn: "Yes or No",
    titleZh: "是与否",
    href: "/yes-no",
    imageSrc: "/cards/home/yes-or-no-final-v2.png",
    idleX: 0,
    idleY: -8,
    idleRotate: 0
  },
  {
    titleEn: "Deep Reading",
    titleZh: "深度占卜",
    href: "/deep",
    imageSrc: "/cards/home/deep-divination-final2.png",
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
      className={`group relative block h-full w-full overflow-hidden rounded-[10px] shadow-[0_16px_28px_rgba(33,31,27,0.14),0_0_24px_rgba(241,232,211,0.56)] outline-none transition focus-visible:ring-1 focus-visible:ring-ink/35 ${active ? "animate-[homeCardBreathe_4.8s_ease-in-out_infinite]" : ""}`}
    >
      <img src={card.imageSrc} alt={`${card.titleZh} / ${card.titleEn}`} className="h-full w-full object-fill [-webkit-touch-callout:default]" />
    </Link>
  );
}

export default function HomePage() {
  const [drawn, setDrawn] = useState(false);

  return (
    <main className={`min-h-dvh bg-paper text-ink ${drawn ? "overflow-hidden" : "overflow-hidden"}`}>
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-5 pt-5">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[18px] leading-none tracking-[0.04em] text-ink/86">
            Flora Lenormand
          </Link>
          <Link
            href="/login"
            className="border-b border-ink/22 pb-1 text-[12px] uppercase tracking-[0.13em] text-ink/56 transition hover:text-ink"
          >
            Login
          </Link>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center">
          <div className={`relative h-[690px] w-full max-w-[390px] overflow-x-hidden ${drawn ? "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "overflow-y-hidden"}`}>
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
                  className="absolute left-1/2 top-1/2 h-[252px] w-[168px] [perspective:1000px]"
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

            <div className="absolute inset-x-0 top-5 mx-auto flex w-full max-w-[290px] flex-col items-center gap-5 pb-10">
              {cards.map((card, index) => (
                <motion.div
                  key={card.titleEn}
                  className="h-[252px] w-[168px] [perspective:1000px]"
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
                      <CardBack />
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
