"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type HomeCard = {
  number: string;
  titleEn: string;
  titleZh: string;
  body: string;
  href: string;
  tone: "sage" | "rose" | "blue";
  icon: "sprig" | "scale" | "book";
  idleX: number;
  idleY: number;
  idleRotate: number;
};

const cards: HomeCard[] = [
  {
    number: "01",
    titleEn: "Daily Reading",
    titleZh: "每日运势",
    body: "为你的一天找到宁静的清晰感",
    href: "/daily",
    tone: "sage",
    icon: "sprig",
    idleX: -36,
    idleY: 12,
    idleRotate: -8
  },
  {
    number: "02",
    titleEn: "Yes or No",
    titleZh: "是与否",
    body: "对你的选择，快速思考一下",
    href: "/yes-no",
    tone: "rose",
    icon: "scale",
    idleX: 0,
    idleY: -8,
    idleRotate: 0
  },
  {
    number: "03",
    titleEn: "Deep Reading",
    titleZh: "深度占卜",
    body: "穿越复杂故事，登录后记住",
    href: "/deep",
    tone: "blue",
    icon: "book",
    idleX: 36,
    idleY: 12,
    idleRotate: 8
  }
];

const toneStyle = {
  sage: {
    card: "bg-[#eaebe3] border-[#CDD0C6]",
    ink: "text-[#8B9484]",
    title: "text-[#687764]",
    number: "text-[#687764]/58",
    english: "text-[#687764]/74",
    wash: "bg-[#E8ECE1]"
  },
  rose: {
    card: "bg-[#f5e9e3] border-[#E0C7C2]",
    ink: "text-[#BD918A]",
    title: "text-[#A87670]",
    number: "text-[#A87670]/58",
    english: "text-[#A87670]/74",
    wash: "bg-[#F0D8D3]"
  },
  blue: {
    card: "bg-[#dde3ea] border-[#BFCBD5]",
    ink: "text-[#758999]",
    title: "text-[#687E90]",
    number: "text-[#687E90]/58",
    english: "text-[#687E90]/74",
    wash: "bg-[#D3E0EA]"
  }
};

function LenormandLineArt({ icon }: { icon: HomeCard["icon"] }) {
  if (icon === "scale") {
    return (
      <svg viewBox="0 0 132 116" className="h-[96px] w-[126px]" aria-hidden="true">
        <path d="M66 19v62M38 36h56M38 36 18 69h40L38 36Zm56 0L74 69h40L94 36Z" fill="none" stroke="currentColor" strokeWidth="2.45" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 69c6 6 31 6 38 0M75 69c6 6 31 6 38 0M56 82h20M50 92h32M45 100h42M66 10v9M56 22c4-8 16-11 25-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M66 39l4.5 9 9 4.5-9 4.5-4.5 9-4.5-9-9-4.5 9-4.5L66 39Z" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" opacity="0.62" />
        <path d="M85 16l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM48 12l1.4 2.8 2.8 1.4-2.8 1.4L48 20.4l-1.4-2.8-2.8-1.4 2.8-1.4L48 12Z" fill="currentColor" opacity="0.48" />
      </svg>
    );
  }

  if (icon === "book") {
    return (
      <svg viewBox="0 0 132 116" className="h-[96px] w-[126px]" aria-hidden="true">
        <path d="M35 82c12-8 25-7 31 3 6-10 19-11 31-3V41c-12-8-25-7-31 3-6-10-19-11-31-3v41Z" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinejoin="round" />
        <path d="M66 44v41M43 51c8-2 15-1 19 5M43 61c8-2 15-1 19 5M89 51c-8-2-15-1-19 5M89 61c-8-2-15-1-19 5" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.52" />
        <path d="M26 38c-10 5-15 13-14 24 14-2 23-9 28-23M106 38c10 5 15 13 14 24-14-2-23-9-28-23M30 29C20 24 11 27 6 38c13 4 24 1 31-8M102 29c10-5 19-2 24 9-13 4-24 1-31-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.74" />
        <path d="M66 18c-5 6-5 12 0 18 5-6 5-12 0-18ZM66 18v-7M55 25c-9-2-16 1-21 9M77 25c9-2 16 1 21 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
        <path d="M29 91h74" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.46" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 132 116" className="h-[96px] w-[126px]" aria-hidden="true">
      <path d="M60 93c10-28 11-56 2-82" fill="none" stroke="currentColor" strokeWidth="2.45" strokeLinecap="round" />
      <path d="M58 42C37 29 24 38 20 56c18 2 30-3 38-14ZM65 53c23-10 34 2 34 21-18 0-29-7-34-21ZM58 67c-19-5-31 6-32 21 16 0 27-6 32-21ZM68 33c12-18 28-18 40-7-12 13-26 15-40 7Z" fill="none" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="round" />
      <path d="M86 77c11-4 20 1 24 10-10 6-21 2-24-10ZM43 29c-8-9-17-9-27-2 8 8 18 9 27 2Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" opacity="0.7" />
      <path d="M89 55h15M96.5 47.5V62.5M100 51l-7 8M93 51l7 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.48" />
      <path d="M84 83c-12 5-20 11-24 19M62 88c5 3 7 8 7 13" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" opacity="0.52" />
      <path d="M92 91l11-11M103 80l-1 9M103 80h-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.58" />
    </svg>
  );
}

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
  const tone = toneStyle[card.tone];

  return (
    <Link
      href={card.href}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      aria-label={card.titleZh}
      className={`group relative flex h-full w-full flex-col items-center overflow-hidden rounded-[6px] border p-2.5 text-center shadow-[0_16px_28px_rgba(33,31,27,0.14),0_0_24px_rgba(241,232,211,0.56)] outline-none transition focus-visible:ring-1 focus-visible:ring-ink/35 ${active ? "animate-[homeCardBreathe_4.8s_ease-in-out_infinite]" : ""} ${tone.card}`}
    >
      <PaperTexture />
      <div className="relative flex h-full w-full flex-col items-center rounded-[4px] border border-ink/10 px-2.5 py-3">
        <div>
          <p className={`font-sans text-[12px] leading-none ${tone.number}`}>{card.number}</p>
          <p className={`home-card-title mt-3 whitespace-nowrap text-[23px] leading-none ${tone.title}`}>{card.titleZh}</p>
        </div>

        <div className={`mt-5 grid h-[106px] w-[126px] place-items-center ${tone.ink}`}>
          <LenormandLineArt icon={card.icon} />
        </div>

        <p className={`mt-1 font-serif text-[12px] italic leading-none ${tone.english}`}>{card.titleEn}</p>
        <p className="mt-auto max-w-none whitespace-nowrap font-sans text-[10px] leading-none text-[#817C72]">{card.body}</p>
      </div>
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
            AI Lenormand
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
                  className="absolute left-1/2 top-1/2 h-[246px] w-[168px] [perspective:1000px]"
                  animate={{
                    x: card.idleX,
                    y: card.idleY,
                    rotate: card.idleRotate,
                    scale: 1
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ marginLeft: -84, marginTop: -123, transformOrigin: "50% 88%" }}
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
                  className="h-[246px] w-[168px] [perspective:1000px]"
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
