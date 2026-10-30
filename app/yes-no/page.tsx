"use client";

import Link from "@/components/SiteLink";
import { QuietCardBack } from "@/components/QuietCardBack";
import { AccountMenu } from "@/components/AccountMenu";
import { ServiceNotice } from "@/components/ServiceNotice";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";

import { yesNoDeck, getYesNoResult, ResultKind, LenormandCard } from "@/lib/yes-no";

import { consumeYesNoQuota, getYesNoQuotaSnapshot, getYesNoServerSnapshot, subscribeYesNoQuota, YES_NO_DAILY_LIMIT, YES_NO_QUOTA_CHANGED, YES_NO_QUOTA_KEY } from "@/lib/yes-no-quota";

type Stage = "input" | "drawing" | "result";

function YesNoQuotaNotice({ used }: { used: number }) {
  const loaded = used >= 0;
  const remainingUses = loaded ? Math.max(0, YES_NO_DAILY_LIMIT - used) : 0;
  return (
    <section aria-label="YES OR NO 今日次数" className="mt-6 w-full rounded-2xl border border-[#6E2638]/15 bg-[#FFFDF8]/75 p-4 text-left sm:p-5">
      <p aria-live="polite" className="text-[13px] leading-7 text-ink/65">
        {loaded ? <>今日 YES OR NO 剩余 <span className="font-serif text-lg text-[#6E2638]">{remainingUses}</span> 次<span className="text-ink/45"> · 北京时间每日零点更新</span></> : used === -2 ? "正在读取今日 YES OR NO 次数…" : "暂时无法读取今日次数，请允许浏览器本地存储。"}
      </p>
      <div role="progressbar" aria-label="今日 YES OR NO 剩余次数" aria-valuemin={0} aria-valuemax={YES_NO_DAILY_LIMIT} aria-valuenow={loaded ? remainingUses : undefined} aria-valuetext={loaded ? `今日剩余 ${remainingUses} 次，共 ${YES_NO_DAILY_LIMIT} 次` : undefined} aria-busy={used === -2} className="mt-3 flex gap-2">
        {Array.from({ length: YES_NO_DAILY_LIMIT }, (_, index) => (
          <div key={index} aria-hidden="true" className={`h-1.5 flex-1 rounded-full transition-colors ${index < remainingUses ? "bg-[#6E2638]/55" : "bg-[#6E2638]/10"}`} />
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-6 text-ink/50">YES OR NO功能在升级开发中，为防止用户与开发访问冲突，YES OR NO暂时限量，敬请期待</p>
      {used === -1 && <Link href="/deep" className="mt-2 inline-flex min-h-11 items-center text-[13px] text-[#6F2638] underline underline-offset-4">前往深度解读</Link>}
    </section>
  );
}

const deepReadingInvitations: Record<ResultKind, string> = {
  YES: "有推进的空间，想看看关键机会和下一步吗？",
  NO: "想进一步了解阻碍，以及可以调整的地方吗？",
  UNCLEAR: "想展开看看，哪些因素让答案尚不明确？"
};

function drawCards() {
  const pool = [...yesNoDeck];
  const picked: LenormandCard[] = [];

  while (picked.length < 3) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function isUnsuitable(question: string) {
  const patterns = ["怎么办", "怎么看", "为什么", "未来会怎么样", "人生", "关系未来", "几个月", "长期"];
  return patterns.some((pattern) => question.includes(pattern));
}

function MiniCard({ card, revealed, index }: { card: LenormandCard; revealed: boolean; index: number }) {
  return (
    <motion.div
      className="aspect-[101/148] w-full max-w-[120px] min-w-0 [perspective:900px]"
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
          <QuietCardBack />
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
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const used = useSyncExternalStore(subscribeYesNoQuota, getYesNoQuotaSnapshot, getYesNoServerSnapshot);
  const quotaExhausted = used >= YES_NO_DAILY_LIMIT;

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);

  const remaining = useMemo(() => 200 - question.length, [question]);
  const cardSaveHandlers = useCardSpreadLongPressSave(
    () => cards.map((card) => ({ src: getLenormandCardImagePath(card.number), label: `${card.nameEn} / ${card.nameZh}` })),
    "yes-or-no-cards.png",
    () =>
      trackAnalyticsEvent("save_cards", {
        surface: "yes_no",
        result,
        cardNumbers: cards.map((card) => card.number).join(",")
      })
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

  async function startReading() {
    if (startingRef.current || stage !== "input") return;
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

    startingRef.current = true;
    setStarting(true);
    try {
      const picked = drawCards();
      const tendency = getYesNoResult(picked);
      const reading = mockReading(tendency, picked);
      // Record a completed local draw before the animation. The lock coordinates tabs.
      const claim = () => consumeYesNoQuota(window.localStorage);
      const claimed = navigator.locks?.request
        ? await navigator.locks.request(YES_NO_QUOTA_KEY, claim)
        : claim();
      window.dispatchEvent(new Event(YES_NO_QUOTA_CHANGED));
      if (!claimed.ok) {
        if (claimed.reason === "storage") setError("暂时无法保存今日次数，请允许浏览器本地存储后重试，或使用深度解读。");
        return;
      }
      trackAnalyticsEvent("yes_no_submit", {
        questionLength: trimmed.length,
        result: tendency,
        cardNumbers: picked.map((card) => card.number).join(",")
      });
      setCards(picked);
      setResult(tendency);
      setStage("drawing");
      window.setTimeout(() => setRevealed(true), 900);
      window.setTimeout(() => {
        setInterpretation(reading);
        setStage("result");
      }, 2600);
    } catch {
      setError("暂时无法读取今日次数，请稍后重试，或使用深度解读。");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-5 pb-8 pt-5">
        <header className="flex items-center justify-between">
          <Link prefetch={false} href="/" className="font-serif text-[18px] leading-none tracking-[0.04em] text-ink/86">
            Flora Lenormand
          </Link>
          <AccountMenu />
        </header>

        {stage === "input" ? (
          quotaExhausted ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <p className="text-[12px] uppercase tracking-[0.28em] text-sage">Yes or No</p>
              <h1 className="mt-5 font-serif text-[30px] leading-10 text-ink">今日 3 次免费体验已用完</h1>
              <p className="mt-4 max-w-sm text-[14px] leading-7 text-ink/60">明天北京时间 00:00 恢复次数。想继续梳理这个问题的原因、阻碍和下一步，可以使用深度解读。</p>
              <YesNoQuotaNotice used={used} />
              <Link href="/deep" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#6F2638] px-8 py-3 text-[14px] text-[#FDF8EF]">
                前往深度解读<ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <p className="mt-3 text-[12px] leading-6 text-ink/50">1 花瓣 · 完整解读 · 含 2 次追问</p>
              <Link href="/" className="mt-5 inline-flex min-h-11 items-center text-[12px] text-ink/50">返回首页</Link>
            </div>
          ) : (
          <div className="flex flex-1 flex-col justify-center py-10">
            <p className="text-center text-[12px] uppercase tracking-[0.28em] text-sage">Quick Answer</p>
            <h1 className="mt-5 text-center font-serif text-[42px] leading-none text-ink">Yes or No</h1>
            <p className="mt-3 text-center text-[15px] leading-6 text-ink/58">写下一个可以用“是 / 否”倾向回答的问题。</p>
            <YesNoQuotaNotice used={used} />

            <label htmlFor="question" className="mt-6 text-[12px] uppercase tracking-[0.18em] text-ink/48">
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
                <p>这个问题更适合深度解读。你可以把它改成一个更明确的 Yes / No 问题。</p>
                <Link prefetch={false} href="/login" className="mt-3 inline-block border-b border-ink/24 pb-1 text-[12px] uppercase tracking-[0.14em] text-ink/60">
                  Deep Reading
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void startReading()}
              disabled={starting || used < 0}
              className="mt-7 h-12 rounded-full bg-[#6F2638] px-6 text-[13px] uppercase tracking-[0.14em] text-[#FDF8EF] shadow-entry transition active:translate-y-px disabled:opacity-50"
            >
              抽牌看倾向
            </button>
            <p className="mt-5 text-center text-[12px] leading-5 text-ink/42">不需要登录，不进入项目记忆。</p>
          </div>
          )
        ) : (
          <div className="flex flex-1 flex-col py-8">
            <p className="text-center text-[12px] uppercase tracking-[0.28em] text-sage">Yes or No</p>
            <p className="mx-auto mt-5 max-w-[320px] text-center font-serif text-[22px] leading-7 text-ink">{question}</p>
            <YesNoQuotaNotice used={used} />

            <div {...(cards.length ? cardSaveHandlers : {})} className="mx-auto mt-8 flex w-full max-w-[400px] justify-center gap-2 sm:gap-4">
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
                  这是一份快速倾向参考，仅依据三张牌的正负倾向给出简答，未结合具体问题、牌位与组合关系展开分析，可能与实际情况不符。如果想结合你的具体情况，进一步梳理这件事的原因、阻碍和下一步，可以使用深度解读。
                </article>

                <aside aria-label="进一步了解这个问题" className="mt-6 rounded-[6px] border border-[#C9CEBC]/65 bg-[#F2F1E9]/70 px-5 py-6 text-center sm:px-8">
                  <p className="font-serif text-[17px] leading-8 text-ink/80">
                    {deepReadingInvitations[result]}
                  </p>
                  <Link prefetch={false} href="/deep" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6F2638] px-6 py-3 text-[14px] text-[#FDF8EF] transition-colors hover:bg-[#582032] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6F2638] sm:w-auto sm:min-w-[224px]">
                    看看原因与下一步
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <p className="mt-3 text-[12px] leading-6 text-ink/50">三牌深入解读 · 1 花瓣 · 含 2 次追问</p>
                </aside>

                <ServiceNotice kind="yesNo" expanded />

                <div className="mt-6 grid gap-3">
                  {quotaExhausted ? (
                    <p role="status" className="text-center text-[13px] leading-7 text-ink/60">今日 3 次免费体验已用完。明天再来，或点击上方按钮，继续深度解读。</p>
                  ) : (
                    <button
                      type="button"
                      onClick={reset}
                      className="h-12 rounded-full border border-ink/14 px-6 text-[13px] tracking-[0.1em] text-ink/65 transition-colors hover:bg-ink/[0.03]"
                    >
                      再问一个问题
                    </button>
                  )}
                  <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center justify-center text-[12px] tracking-[0.1em] text-ink/45 hover:text-ink/70">
                    返回首页
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
