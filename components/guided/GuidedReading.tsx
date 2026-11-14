"use client";

import { ArrowLeft, ArrowRight, Pencil, Plus, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "@/components/SiteLink";
import { AccountMenu } from "@/components/AccountMenu";
import { GuidedCardTable } from "@/components/guided/GuidedCardTable";
import { GuidedTutorial } from "@/components/guided/GuidedTutorial";
import { ReadingSafetyDialog } from "@/components/deep/ReadingSafetyDialog";
import { lenormandCards } from "@/lib/lenormand-cards";
import { guidedCardCount, guidedPetalPrice, guidedReadingDescription, guidedReadingTitle, type GuidedSession } from "@/lib/guided-reading/details";
import { isReadingSafetyCode, type ReadingSafetyCode } from "@/lib/paid-local/reading-safety";
import { paidLocalAIEnabled, paidLocalSiteEnabled, paidOnlineSiteEnabled, paidSiteRequest, PaidSiteError, restorePaidSiteSession } from "@/lib/paid-local/site-bridge";

type HistoryItem = { id: string; question: string; step: number; complete: boolean };
const login = "/login?returnTo=%2Fguided";
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#6E2638] px-6 text-sm font-medium text-[#FFF9F2] transition-colors hover:bg-[#5A2030] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E2638]";
const panel = "rounded-2xl border border-ink/15 bg-[#FFFDF8] p-5 sm:p-7";
const cardProgress = (session: GuidedSession) => !session.final && !session.plan;
const focusOption = "min-h-14 min-w-0 rounded-xl border border-ink/15 bg-white/60 px-3 py-3 text-left text-sm leading-6 transition hover:border-[#6E2638]/40 active:scale-[0.98] aria-pressed:border-[#6E2638]/65 aria-pressed:bg-[#6E2638]/10 aria-pressed:text-[#6E2638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E2638] motion-reduce:transition-none";
const textAction = "inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-[#6E2638] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E2638] disabled:opacity-50";

function GetPetals({ busy, onTestCredits }: { busy: boolean; onTestCredits: () => void }) {
  return paidLocalSiteEnabled
    ? <button type="button" disabled={busy} onClick={onTestCredits} className={textAction}>补充本地测试花瓣</button>
    : <Link href="/recharge" prefetch={false} className={textAction}>补充花瓣</Link>;
}

export function GuidedReading() {
  const [access, setAccess] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [session, setSession] = useState<GuidedSession | null>(null);
  const [question, setQuestion] = useState("");
  const [focus, setFocus] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [customQuestion, setCustomQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
  const [creditsNotice, setCreditsNotice] = useState("");
  const [safety, setSafety] = useState<ReadingSafetyCode | null>(null);
  const active = useRef(false);
  const request = useRef<{ input: string; id: string } | null>(null);
  const table = useRef<HTMLElement>(null);
  const latestRound = useRef<HTMLElement>(null);
  const customInput = useRef<HTMLTextAreaElement>(null);
  const openSession = (value: GuidedSession) => {
    setSession(value);
    setHistory(items => [{
      id: value.id, question: value.question, step: value.cards.length, complete: Boolean(value.final),
    }, ...items.filter(item => item.id !== value.id)].slice(0, 20));
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!await restorePaidSiteSession()) {
        if (mounted) setAccess("guest");
        return;
      }
      const items = await paidSiteRequest<HistoryItem[]>("guided");
      if (mounted) { setHistory(items); setAccess("ready"); }
    })().catch(() => { if (mounted) setAccess("error"); });
    return () => { mounted = false; };
  }, []);

  async function submit(action: string, fields?: Record<string, unknown>) {
    if (active.current) return false;
    active.current = true;
    setBusy(true);
    setError("");
    setNeedsCredits(false);
    setCreditsNotice("");
    const withRequestId = action === "guided/start";
    if (withRequestId) {
      const input = JSON.stringify([action, fields]);
      if (request.current?.input !== input) request.current = { input, id: crypto.randomUUID() };
    }
    try {
      let next = await paidSiteRequest<GuidedSession>(action, withRequestId ? { ...fields, requestId: request.current!.id } : fields);
      openSession(next);
      if (withRequestId) request.current = null;
      if (action !== "guided/advance") {
        setSelection(null);
        setUseCustom(false);
        setCustomQuestion("");
        setGroupIndex(0);
        requestAnimationFrame(() => {
          const destination = action === "guided/draw" ? latestRound.current : table.current;
          destination?.scrollIntoView({ block: action === "guided/draw" ? "nearest" : "start" });
        });
      }
      while (cardProgress(next)) {
        next = await paidSiteRequest<GuidedSession>("guided/advance", { id: next.id });
        openSession(next);
      }
    } catch (cause) {
      if (cause instanceof PaidSiteError && cause.code === "NO_CREDITS") {
        setNeedsCredits(true);
        setError(cause.message);
      } else if (cause instanceof PaidSiteError && isReadingSafetyCode(cause.code)) setSafety(cause.code);
      else if (cause instanceof PaidSiteError && cause.code === "DRAW_CHANGED" && session) {
        try {
          openSession(await paidSiteRequest<GuidedSession>(`guided/${session.id}`));
          setSelection(null);
          setUseCustom(false);
          setCustomQuestion("");
          setGroupIndex(0);
        } catch {
          setError("读取抽牌进度失败，请从记录里重新打开。");
        }
      } else setError(cause instanceof Error ? cause.message : "暂时无法完成，请稍后重试。");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function addTestCredits() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    try {
      await paidSiteRequest("guided/test-credits", { requestId: crypto.randomUUID() });
      setNeedsCredits(false);
      setError("");
      setCreditsNotice("本地测试余额已更新，可以继续。");
    } catch {
      setError("暂时无法补充本地测试花瓣，请稍后再试。");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  const cards = session?.cards.map(number => lenormandCards[number - 1]) ?? [];
  const step = cards.length;
  const current = session?.rounds.at(-1);
  const completed = Boolean(session?.final);
  const displayedIndex = completed ? reviewIndex ?? step - 1 : step - 1;
  const displayedRound = session?.rounds[displayedIndex];
  const reviewRounds = completed ? session?.rounds ?? [] : session?.rounds.slice(0, -1) ?? [];
  const groups = session?.plan?.groups ?? [];
  const visibleGroup = groups[groupIndex] ?? [];
  const selectedQuestion = useCustom ? customQuestion.trim() : selection ?? "";
  const status = current && !current.interpretation
    ? `正在解读第 ${step} 张牌…`
    : step === guidedCardCount
      ? "正在汇总九张牌…"
      : `正在准备第 ${step + 1} 张的推荐问题…`;
  function draw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session?.plan && selectedQuestion) void submit("guided/draw", { id: session.id, step, planId: session.plan.id, question: selectedQuestion, custom: useCustom });
  }

  function reviewCard(index: number) {
    setReviewIndex(index);
    requestAnimationFrame(() => latestRound.current?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <main className="min-h-dvh bg-paper pb-12 text-ink">
      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
          <Link href="/" prefetch={false} className="font-serif text-lg">Flora Lenormand</Link>
          <AccountMenu />
        </header>

        <div className="mb-6 mt-7">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-3xl text-[#6E2638] sm:text-4xl">{guidedReadingTitle}</h1>
            {!session && <GuidedTutorial />}
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/65">{guidedReadingDescription}。{paidOnlineSiteEnabled || paidLocalAIEnabled ? "AI 生成 · 娱乐与自我探索" : "本地预览 · 模拟回应"}</p>
        </div>

        {error && !session && <p role="alert" className="mb-4 rounded-lg bg-[#6E2638]/5 p-3 text-sm text-[#8E4D4A]">{error}</p>}
        {needsCredits && !session && <GetPetals busy={busy} onTestCredits={() => void addTestCredits()} />}
        {creditsNotice && !session && <p role="status" className="mb-3 text-sm text-ink/65">{creditsNotice}</p>}
        {access === "loading" && <p role="status" className="text-sm text-ink/65">正在打开洋葱解牌…</p>}
        {access === "error" && <p role="alert">洋葱解牌暂时无法加载，请刷新后重试。</p>}
        {access === "guest" && <section className={panel}>
          <p className="mb-4 text-sm text-ink/70">登录后可以继续上一次抽牌，也能回看完整解读。</p>
          <Link href={login} prefetch={false} className={primary}>{paidLocalSiteEnabled ? "选择体验账号" : "登录后开始"} <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>}

        {access === "ready" && !session && <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(235px,0.65fr)]">
          <form className={panel} onSubmit={event => { event.preventDefault(); if (question.trim()) void submit("guided/start", { question: question.trim(), focus: focus.trim() }); }}>
            <fieldset disabled={busy} className="min-w-0">
              <label htmlFor="guided-question" className="font-serif text-2xl">这一次，你想问什么？</label>
              <textarea id="guided-question" required maxLength={300} rows={3} value={question} onChange={event => setQuestion(event.target.value)} placeholder="例如：未来三个月，我和他的关系会怎样发展？" className="mt-3 w-full rounded-xl border border-ink/15 bg-white/65 p-3 text-base focus-visible:outline-[#6E2638]" />
              <label htmlFor="guided-focus" className="mt-4 block text-sm text-ink/75">想补充的背景 <span className="text-ink/50">· 可选</span></label>
              <textarea id="guided-focus" rows={2} maxLength={200} value={focus} onChange={event => setFocus(event.target.value)} placeholder="例如：最近联系少了，我想看看以后怎样沟通。" className="mb-4 mt-2 w-full rounded-xl border border-ink/15 bg-white/65 p-3 text-base focus-visible:outline-[#6E2638]" />
              <button type="submit" className={primary} disabled={busy || !question.trim()} aria-describedby="guided-price"><Sparkles size={16} aria-hidden="true" />{busy ? "正在准备牌桌…" : "开始洋葱解牌"}</button>
              <div id="guided-price" className="mt-3">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold text-[#6E2638]">测试期间限定 · {guidedPetalPrice.test} 花瓣 / 局</span>
                  <span className="text-ink/60">常规价 <s>{guidedPetalPrice.regular} 花瓣</s></span>
                </p>
                <p className="mt-1 text-xs leading-5 text-ink/65">抽第一张时一次扣除，含九轮解读和最终汇总。</p>
                {paidOnlineSiteEnabled && <p className="mt-1 text-xs leading-5 text-ink/65">必要的问题和解读会交给 DeepSeek 处理，进度保存在账号内。<Link href="/privacy" prefetch={false} className="ml-1 underline underline-offset-2">隐私政策</Link></p>}
              </div>
            </fieldset>
          </form>
          {history.length > 0 && <section className={panel}>
            <h2 className="font-serif text-xl">洋葱解牌记录</h2>
            <ul className="mt-3 divide-y divide-ink/10">
              {history.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void submit(`guided/${item.id}`)} className="w-full py-3 text-left text-sm text-[#6E2638]">
                <span className="block break-words">{item.question}</span><span className="mt-1 block text-xs text-ink/55">{item.complete ? "已完成 · 回看" : `已抽 ${item.step}/9 · 继续`}</span>
              </button></li>)}
            </ul>
          </section>}
        </div>}

        {session && <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={busy} onClick={() => { setSession(null); setReviewIndex(null); setError(""); setNeedsCredits(false); setCreditsNotice(""); }} className="inline-flex min-h-11 items-center gap-2 text-sm text-[#6E2638] disabled:opacity-50"><ArrowLeft size={15} aria-hidden="true" />返回提问与记录</button>
            <p className="text-sm text-[#6E2638]" role="status">已抽 {step} / 9 张</p>
          </div>
          <div className="mx-auto max-w-2xl space-y-4">
            <section ref={table} className={panel + " scroll-mt-3"} aria-label="洋葱解牌牌桌">
              <p className="mb-1 text-center text-xs text-ink/60">主问题</p>
              <h2 className="mb-5 break-words text-center font-serif text-xl leading-8">{session.question}</h2>
              <GuidedCardTable session={session} selectedIndex={displayedIndex} onSelect={completed ? reviewCard : undefined} />
            </section>
            {displayedRound && <section id="guided-card-interpretation" ref={latestRound} className={panel} aria-labelledby="guided-card-heading" aria-live="polite">
              <h2 id="guided-card-heading" className="font-serif text-xl">第 {displayedIndex + 1} 张 · {cards[displayedIndex].nameZh}</h2>
              {displayedRound.question && <p className="mt-2 break-words text-sm leading-6 text-[#6E2638]">{displayedRound.question}</p>}
              {displayedRound.interpretation && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-8">{displayedRound.interpretation}</p>}
            </section>}
            {reviewRounds.length > 0 && <details key={completed ? "all" : "earlier"} className={panel}>
              <summary className="cursor-pointer text-sm text-[#6E2638]">{completed ? "回看九张解读" : `回看前 ${reviewRounds.length} 张的解读`}</summary>
              <ol className="mt-4 space-y-4">
                {reviewRounds.map((item, index) => <li key={cards[index].number} className="break-words text-sm leading-7">
                  <p className="font-medium">第 {index + 1} 张 · {cards[index].nameZh}</p>
                  {item.question && <p className="text-[#6E2638]">{item.question}</p>}
                  <p className="whitespace-pre-wrap">{item.interpretation}</p>
                </li>)}
              </ol>
            </details>}
            {session.final && <section className={panel}>
              <h2 className="font-serif text-xl">九张综合解读</h2>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8" aria-live="polite">{session.final}</p>
              <button type="button" onClick={() => { setSession(null); setReviewIndex(null); setQuestion(""); setFocus(""); }} className={primary + " mt-5"}><Plus size={16} aria-hidden="true" />再来一局</button>
            </section>}
            {session.messages.length > 0 && <details className={panel}>
              <summary className="cursor-pointer text-sm text-[#6E2638]">回看之前的对话</summary>
              <ul className="mt-3 space-y-3">
                {session.messages.map(item => <li key={item.id} className="break-words text-sm leading-7">
                  <span className="mr-2 text-xs text-[#6E2638]">{item.role === "user" ? "你补充的内容" : "引导"}</span>{item.text}
                </li>)}
              </ul>
            </details>}
            {cardProgress(session) && <section className={panel}>
              {busy ? <p className="text-sm text-ink/65" role="status">{status}</p> : <>
                <p className="text-sm text-ink/65" role={error ? "alert" : undefined}>{error || "可以从这里继续上次的进度。"}</p>
                <button type="button" onClick={() => void submit("guided/advance", { id: session.id })} className={primary + " mt-3"}>{error ? "重试这一步" : "继续"}</button>
              </>}
            </section>}
            {session.plan && step < guidedCardCount && <form className={panel} onSubmit={draw}>
              <fieldset disabled={busy} className="min-w-0">
                <legend className="font-serif text-xl">第 {step + 1} 轮 · {session.plan.topic}</legend>
                <p id="guided-round-hint" className="mb-4 mt-2 text-sm leading-6 text-ink/65">{session.plan.hint}</p>
                {useCustom && <textarea id="guided-custom-question" ref={customInput} aria-label="围绕主问题填写想看的角度" aria-describedby="guided-round-hint" rows={2} maxLength={200} value={customQuestion} onChange={event => setCustomQuestion(event.target.value)} placeholder="用自己的话写下这一轮想问的问题。" className="mb-3 w-full rounded-xl border border-ink/15 bg-white/65 p-3 text-base focus-visible:outline-[#6E2638]" />}
                <div role="group" aria-label="推荐问题" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {visibleGroup.map(item => <button type="button" key={item} aria-pressed={!useCustom && selection === item} onClick={() => { setUseCustom(false); setSelection(item); }} className={focusOption}>
                    <span className="break-words">{item}</span>
                  </button>)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button type="button" className={textAction} onClick={() => {
                    setGroupIndex(index => (index + 1) % groups.length);
                    setSelection(null);
                  }}>
                    <RotateCw size={14} aria-hidden="true" />换一组
                  </button>
                  <span className="text-xs text-ink/60" role="status">第 {groupIndex + 1} / {groups.length} 组</span>
                </div>
                {error && <p role="alert" className="mt-2 text-sm text-[#8E4D4A]">{error}</p>}
                {needsCredits && <GetPetals busy={busy} onTestCredits={() => void addTestCredits()} />}
                {creditsNotice && <p role="status" className="mt-2 text-sm text-ink/65">{creditsNotice}</p>}
                {step === 0 && session.petalPrice > 0 && <p className="mt-2 text-xs leading-5 text-ink/65">抽第一张时扣除 {session.petalPrice} 花瓣。</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <button type="submit" disabled={busy || !selectedQuestion} className={primary + " px-4 sm:px-6"}>
                    <Sparkles size={16} aria-hidden="true" />{busy ? "正在准备翻牌…" : `选好了，抽第 ${step + 1} 张`}
                  </button>
                  <button type="button" className={textAction + " ml-auto aria-expanded:font-semibold"} aria-expanded={useCustom} onClick={() => {
                    setUseCustom(true);
                    requestAnimationFrame(() => customInput.current?.focus());
                  }}>
                    <Pencil size={14} aria-hidden="true" />自己输入问题
                  </button>
                </div>
              </fieldset>
            </form>}
          </div>
        </>}
        {safety && <ReadingSafetyDialog code={safety} followUp={Boolean(session)} onClose={() => setSafety(null)} />}
      </div>
    </main>
  );
}
