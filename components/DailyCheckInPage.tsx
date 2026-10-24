"use client";

import Link from "@/components/SiteLink";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flower2, Gift, X } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { QuietCardBack } from "./QuietCardBack";
import { calendarDaySlots, moveCalendarMonth } from "@/lib/check-in-calendar";
import { getLenormandCardImagePath } from "@/lib/lenormand-cards";
import { PaidSiteError, paidSiteRequest, subscribePaidSiteRefresh } from "@/lib/paid-local/site-bridge";
import type { DailyCheckInResult, DailyCheckInState, DailyFortuneEntry } from "@/lib/paid-local/types";

function FortuneText({ entry }: { entry: DailyFortuneEntry }) {
  const sections = [["今日整体", entry.fortune.overall], ["感情与人际", entry.fortune.love], ["工作 / 学习", entry.fortune.work], ["留意一下", entry.fortune.caution], ["给今天的你", entry.fortune.advice]];
  return <div className="space-y-5">{sections.map(([label, text]) => <section key={label}><h3 className="font-serif text-lg text-ink/85">{label}</h3><p className="mt-2 text-sm leading-7 text-ink/60">{text}</p></section>)}</div>;
}

function FortuneDialog({ entry, onDismiss }: { entry: DailyFortuneEntry; onDismiss: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} onClose={onDismiss} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }} aria-labelledby="daily-detail-title" className="m-auto max-h-[88dvh] w-[calc(100%_-_2rem)] max-w-[560px] overflow-y-auto rounded-2xl border border-ink/15 bg-[#FFFDF8] p-0 text-ink shadow-paper backdrop:bg-[#211F1B]/30">
    <div className="p-5 sm:p-7"><header className="flex items-start justify-between gap-3"><div><p className="text-xs text-clay/70">{entry.date} · 每日牌</p><h2 id="daily-detail-title" className="mt-2 font-serif text-2xl">{entry.card.nameZh}<span className="ml-2 text-sm text-ink/40">{entry.card.nameEn}</span></h2></div><button autoFocus type="button" onClick={() => ref.current?.close()} aria-label="关闭当日运势" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10"><X size={17} /></button></header>
      <div className="my-6 flex items-center gap-5"><img src={getLenormandCardImagePath(entry.card.number)} alt={entry.card.nameZh} className="h-[144px] w-24 rounded-md object-fill shadow-paper" /><p className="text-sm leading-7 text-clay/75">{entry.card.keywords.join(" · ")}</p></div><FortuneText entry={entry} /><p className="mt-6 text-xs leading-6 text-ink/35">这是当天保存的运势，查看历史不会重新抽牌或扣除花瓣。</p>
    </div>
  </dialog>;
}

export function DailyCheckInPage() {
  const router = useRouter();
  const autoCheckIn = useRef(false);
  const calendarAnchorHandled = useRef(false);
  const [data, setData] = useState<DailyCheckInState | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rewardNotice, setRewardNotice] = useState("");
  const [selected, setSelected] = useState<DailyFortuneEntry | null>(null);
  const working = useRef(false); const mounted = useRef(false); const sequence = useRef(0);
  const owner = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => { autoCheckIn.current = new URLSearchParams(window.location.search).get("checkin") === "1"; }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current; setLoading(true);
    try {
      const value = await paidSiteRequest<DailyCheckInState>(`daily${month ? `?month=${month}` : ""}`);
      if (!mounted.current || request !== sequence.current) return;
      if (owner.current !== value.userId) { setSelected(null); setNotice(""); setRewardNotice(""); }
      owner.current = value.userId; setData(value); setNeedsLogin(false); setError("");
    } catch (cause) {
      if (!mounted.current || request !== sequence.current) return;
      if (cause instanceof PaidSiteError && cause.status === 401) { owner.current = null; setNeedsLogin(true); setData(null); setSelected(null); setNotice(""); setRewardNotice(""); }
      else setError(cause instanceof Error ? cause.message : "暂时没有读到签到记录，请重试。");
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [month]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const focus = () => { if (!working.current) void refresh(); };
    const unsubscribe=subscribePaidSiteRefresh(focus);
    return () => { mounted.current = false; unsubscribe(); };
  }, [refresh]);
  useEffect(() => {
    if (!data) return;
    const delay = Math.max(200, Date.parse(data.nextResetAt) - Date.parse(data.serverNow) + 200);
    const midnight = window.setTimeout(() => { setNotice(""); setRewardNotice(""); void refresh(); }, delay);
    return () => window.clearTimeout(midnight);
  }, [data, refresh]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    // The calendar is inserted after the account request; the initial URL anchor may arrive earlier.
    if (!data || loading || calendarAnchorHandled.current) return;
    calendarAnchorHandled.current = true;
    if (window.location.hash === "#daily-calendar") document.getElementById("daily-calendar")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [data, loading, reduceMotion]);

  const signInAndDraw = useCallback(async () => {
    if (working.current || !data) return;
    working.current = true; sequence.current++; setBusy(true); setError(""); setNotice(""); setRewardNotice("");
    const beforeRewards = data.totalRewards;
    try {
      const value = await paidSiteRequest<DailyCheckInResult>("daily-check-in", {});
      if (!mounted.current) return;
      // The result always includes this server day's saved card; it cannot be chosen by the browser.
      setData(value); setMonth(null); setLoading(false);
      if (value.newlyCheckedIn && !reduceMotion) { setRevealed(false); timer.current = setTimeout(() => { if (mounted.current) setRevealed(true); }, 160); }
      else setRevealed(true);
      setNotice(value.newlyCheckedIn ? "今日签到完成，这张牌已经为你保存。" : "今天已经签到，还是为你保留这同一张牌。");
      if (value.grantedMilestones.length) setRewardNotice(`连续签到 ${value.currentStreak} 天，${value.grantedMilestones.length} 花瓣已到账，可解锁完整解读与 2 次追问。`);
    } catch (cause) {
      // A response can be lost after commit. Recover the saved day instead of drawing again.
      try {
        const restored = await paidSiteRequest<DailyCheckInState>("daily");
        if (mounted.current) {
          setData(restored); setMonth(null); setLoading(false); setRevealed(true);
          if (restored.todayEntry) { setNotice("今日牌已保存，签到记录已同步。"); if (restored.totalRewards > beforeRewards) setRewardNotice("签到奖励已到账，可以在我的主页查看花瓣记录。"); }
          else setError(cause instanceof Error ? cause.message : "暂时没有签到成功，请重试。");
        }
      } catch { if (mounted.current) setError(cause instanceof Error ? cause.message : "暂时没有签到成功，请重试。"); }
    } finally { working.current = false; if (mounted.current) { setBusy(false); setLoading(false); } }
  }, [data, reduceMotion]);
  useEffect(() => {
    if (!autoCheckIn.current || loading) return;
    if (needsLogin) { autoCheckIn.current = false; router.replace("/login?returnTo=%2Fdaily%3Fcheckin%3D1"); return; }
    if (!data) return;
    autoCheckIn.current = false;
    const url = new URL(window.location.href); url.searchParams.delete("checkin");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    void signInAndDraw();
  }, [data, loading, needsLogin, router, signInAndDraw]);
  const todayEntry = data?.todayEntry;
  const entries = new Map(data?.entries.map((entry) => [entry.date, entry]) || []);
  const checked = Boolean(todayEntry);

  return <main className="min-h-dvh bg-paper px-4 pb-14 pt-5 text-ink sm:px-6"><div className="mx-auto w-full max-w-[960px]">
    <header className="flex items-center justify-between gap-3"><Link prefetch={false} href="/" className="font-serif text-lg tracking-[0.04em] text-ink/85">Flora Lenormand</Link><AccountMenu /></header>
    <div className="py-9 text-center sm:py-12"><p className="text-[11px] uppercase tracking-[0.25em] text-sage">A card for your day</p><h1 className="mt-4 font-serif text-4xl">今日运势</h1><p className="mt-4 text-sm leading-7 text-ink/50">抽一张今日牌，也为自己留下一个小小的签到。</p><a href="#daily-calendar" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sage/25 bg-ivory px-5 text-xs text-sage transition hover:border-sage/50"><CalendarDays size={16} />我的牌面日历<ChevronRight size={13} /></a></div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-[#6E2638]/20 p-4 text-sm leading-6 text-[#8E4D4A]">{error}<button onClick={() => void refresh()} type="button" className="ml-3 underline">重新读取</button></div>}
    {loading && !data && !needsLogin && <p role="status" className="py-6 text-center text-sm text-ink/45">正在翻开你的签到记录…</p>}
    {needsLogin && <section className="mx-auto max-w-md rounded-2xl border border-ink/10 bg-[#FFFDF8]/80 p-6 text-center"><div className="mx-auto h-48 w-32 rounded-md shadow-paper"><QuietCardBack /></div><h2 className="mt-6 font-serif text-2xl">把今天留在日历里</h2><p className="mt-3 text-sm leading-7 text-ink/55">登录后，今日牌、签到和奖励会保存在你的账号里。每天同一张牌，每连续签到满 3 天赠送 1 花瓣。</p><Link prefetch={false} href="/login?returnTo=%2Fdaily%3Fcheckin%3D1" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#6E2638] px-7 text-sm text-[#FFF9F2]">登录，领取今日牌</Link></section>}
    {data && <>
      <section aria-label="签到奖励进度" className="rounded-2xl border border-[#6E2638]/15 bg-[#FFFDF8]/75 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs text-clay/70"><Gift size={15} />每天见面的小礼物</p><h2 className="mt-2 font-serif text-2xl">已连续签到 {data.currentStreak} 天</h2><p className="mt-2 text-xs leading-6 text-ink/50">每连续签到满 {data.rewardEvery} 天赠 1 花瓣，漏签重新计数，跨月连签有效。</p><p className="mt-1 text-[11px] text-ink/35">一共留下了 {data.totalDays} 天的牌面记录</p></div><button type="button" disabled={checked || busy || loading} onClick={() => void signInAndDraw()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#6E2638] px-5 text-sm text-[#FFF9F2] disabled:bg-[#6E2638]/10 disabled:text-[#6E2638]/70">{checked ? <Check size={15} /> : <Flower2 size={15} />}{checked ? "今日已签到" : busy ? "正在保存今日牌…" : "签到，领取今日运势"}</button></div>
        <div className="mt-5 flex gap-2" aria-label={`本轮签到 ${data.cycleDays}/${data.rewardEvery}`}>{Array.from({ length: data.rewardEvery }, (_, index) => <div key={index} className={`h-1.5 flex-1 rounded-full ${index < data.cycleDays ? "bg-[#6E2638]/55" : "bg-[#6E2638]/10"}`} />)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-6 text-ink/50"><p>{data.cycleDays === data.rewardEvery ? `本轮 ${data.rewardEvery} 天奖励已到账 · 下一份还需 ${data.nextRewardIn} 天` : `本轮 ${data.cycleDays}/${data.rewardEvery} 天 · 再签到 ${data.nextRewardIn} 天可得 1 花瓣`}</p><Link prefetch={false} href="/profile" className="text-[#6E2638]">已获 {data.totalRewards} 花瓣 · 查看记录</Link></div>
      </section>
      {notice && <p role="status" className="mt-4 text-center text-sm leading-7 text-sage">{notice}</p>}
      {rewardNotice && <div role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-[#6E2638]/20 bg-[#6E2638]/[0.04] p-4 text-sm leading-7 text-[#6E2638]"><Gift size={19} className="mt-1 shrink-0" /><p>{rewardNotice}</p></div>}
      <section aria-label="今日牌与运势" className={`my-9 grid items-start gap-8 ${todayEntry ? "sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10" : ""}`}>
        <div className="text-center"><p className="mb-4 text-xs tracking-[0.12em] text-clay/65">{data.today} · 北京时间</p><motion.div animate={{ rotateY: revealed ? 0 : 90 }} transition={{ duration: reduceMotion ? 0 : 0.45 }} className="mx-auto h-[276px] w-[184px] rounded-md bg-[#FFFDF8] shadow-paper">{todayEntry && revealed ? <img src={getLenormandCardImagePath(todayEntry.card.number)} alt={`今日牌：${todayEntry.card.nameZh}`} className="h-full w-full rounded-md object-fill" /> : <QuietCardBack />}</motion.div>
          {todayEntry ? <><h2 className="mt-5 font-serif text-2xl">{todayEntry.card.nameZh}</h2><p className="mt-2 text-xs text-ink/40">{todayEntry.card.keywords.join(" · ")}</p><p className="mt-3 text-xs leading-6 text-ink/40">当天再次打开，仍然是这张牌。</p></> : <><button type="button" disabled={busy || loading} onClick={() => void signInAndDraw()} className="mt-6 min-h-12 rounded-full bg-[#6E2638] px-8 text-sm text-[#FFF9F2] disabled:opacity-50">{busy ? "正在抽取…" : "抽取今日牌"}</button><p className="mt-3 text-xs leading-6 text-ink/45">抽牌自动签到，每日牌不扣花瓣。</p></>}
        </div>{todayEntry && <article className="rounded-2xl border border-ink/10 bg-[#FFFDF8]/60 p-5 sm:p-6"><FortuneText entry={todayEntry} /></article>}
      </section>
      <section id="daily-calendar" aria-labelledby="daily-calendar-title" className="scroll-mt-5 rounded-2xl border border-ink/10 bg-[#FFFDF8]/75 p-3 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-5"><div><h2 id="daily-calendar-title" className="font-serif text-2xl">牌面日历</h2><p className="mt-2 text-xs leading-6 text-ink/45">点击有牌的日期，重温那天的运势。</p></div><div className="flex items-center gap-1"><button type="button" disabled={loading || busy || data.month <= "1970-01"} onClick={() => setMonth(moveCalendarMonth(data.month, -1))} aria-label="上一个月" className="grid h-11 w-10 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30"><ChevronLeft size={18} /></button><p aria-live="polite" className="min-w-24 text-center text-sm">{data.month.replace("-", " 年 ")} 月</p><button type="button" disabled={loading || busy || data.month >= data.today.slice(0, 7)} onClick={() => setMonth(moveCalendarMonth(data.month, 1))} aria-label="下一个月" className="grid h-11 w-10 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30"><ChevronRight size={18} /></button></div></div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <p key={day} className="py-2 text-center text-xs text-ink/35">{day}</p>)}{calendarDaySlots(data.month).map((date, index) => {
          if (!date) return <div key={`empty-${index}`} aria-hidden="true" />;
          const entry = entries.get(date); const isToday = date === data.today; const future = date > data.today;
          return <button key={date} type="button" disabled={!entry && (!isToday || busy || loading)} onClick={() => { if (entry) setSelected(entry); else void signInAndDraw(); }} aria-label={`${date}，${entry ? entry.card.nameZh + "，查看当日运势" : isToday ? "今日待签到，抽取今日牌" : future ? "尚未到来" : "未签到"}`} className={`flex min-h-[88px] min-w-0 flex-col items-center rounded-lg border px-0.5 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E2638] sm:min-h-[130px] sm:px-2 ${isToday ? "border-[#6E2638]/45 bg-[#6E2638]/[0.035]" : "border-ink/[0.06]"} ${entry ? "hover:bg-[#6E2638]/[0.045]" : "disabled:cursor-default"}`}><span className={`text-[11px] sm:text-xs ${future ? "text-ink/20" : isToday ? "text-[#6E2638]" : "text-ink/45"}`}>{Number(date.slice(-2))}{isToday && <span className="sr-only">（今天）</span>}</span>{entry ? <><img src={getLenormandCardImagePath(entry.card.number)} alt="" className="mt-1 aspect-[2/3] w-[min(75%,54px)] rounded-[3px] object-fill" /><span className="mt-1 max-w-full truncate text-[9px] text-ink/65 sm:text-[11px]">{entry.card.nameZh}</span></> : <span className="my-auto text-[9px] leading-5 text-ink/25 sm:text-[11px]">{isToday ? "待抽" : future ? "·" : "未签"}</span>}</button>;
        })}</div><p className="mt-4 px-1 text-[11px] leading-6 text-ink/40">按北京时间每天更新；不补签、不重抽。断签后连签进度重计，跨月可接着连签，历史牌面和已得花瓣一直保留。</p>
      </section><p className="mt-6 text-center text-xs leading-6 text-ink/35">每日运势供娱乐与自我梳理。奖励花瓣与其他花瓣一样，可解锁一次完整深度解读及两次追问。</p>
    </>}
    {selected && <FortuneDialog entry={selected} onDismiss={() => setSelected(null)} />}
  </div></main>;
}
