"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Flower2, LogOut, UserRound } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { getDeepSpread } from "@/lib/deep-spreads";
import { FeedbackContact, OrderList } from "@/components/PaymentBits";
import { CodeHistory } from "./RedemptionHistory";
import { PaidSiteError, paidSiteEnabled, paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { PaidOverview, LocalOrder } from "@/lib/paid-local/types";
import { getSession, signOut } from "@/lib/project-store";

export function AccountFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-dvh bg-paper px-4 pb-12 text-ink sm:px-8">
    <div className="mx-auto w-full max-w-[960px]">
      <header className="flex h-[72px] items-center justify-between gap-3 border-b border-ink/10">
        <Link href="/deep" className="inline-flex min-h-11 items-center gap-2 text-xs text-ink/60"><ArrowLeft size={15} />返回占卜</Link>
        <Link href="/" className="hidden font-serif text-xl sm:block">Flora Lenormand</Link><AccountMenu />
      </header>
      <div className="py-8 sm:py-12"><p className="text-xs uppercase tracking-[0.2em] text-clay/65">My Flora</p><h1 className="mt-3 font-serif text-3xl sm:text-4xl">{title}</h1></div>
      {children}
    </div>
  </main>;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ProfileClient() {
  const router = useRouter();
  const [wallet, setWallet] = useState<PaidOverview | null>(null);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"usage" | "ledger" | "orders">("usage");
  const [period, setPeriod] = useState("all");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!paidSiteEnabled) {
        if (!getSession()) router.replace("/login?returnTo=%2Fprofile");
        else setError("消费管理正在本地预览，正式站暂未开放。");
        return;
      }
      const [account, purchases] = await Promise.all([paidSiteRequest<PaidOverview>(), paidSiteRequest<LocalOrder[]>("orders")]);
      setWallet(account); setOrders(purchases);
    } catch (cause) {
      if (cause instanceof PaidSiteError && cause.status === 401) router.replace("/login?returnTo=%2Fprofile");
      else setError(cause instanceof Error ? cause.message : "暂时无法读取账户，请重试。");
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void refresh(); const focus = () => { void refresh(); }; window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [refresh]);
  const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
  const usage = wallet?.readings.filter((reading) => reading.state === "completed" && new Date(reading.completedAt || reading.createdAt).getTime() >= cutoff).sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)) || [];
  const ledger = wallet?.ledger.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff) || [];
  return <AccountFrame title="用户主页">
    {loading && !wallet && <p role="status" className="py-12 text-sm text-ink/50">正在读取你的账户…</p>}
    {error && <div role="alert" className="mb-6 rounded-xl border border-[#6E2638]/20 p-4 text-sm"><p>{error}</p><button type="button" onClick={() => void refresh()} className="mt-3 text-[#6E2638] underline">重新读取</button></div>}
    {wallet && <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#6E2638]/15 bg-[#6E2638]/5 text-[#6E2638]"><UserRound size={22} /></span><div className="min-w-0"><h2 className="truncate text-base">{wallet.user.label}</h2><p className="mt-1 text-xs text-ink/40">我的花瓣与消费记录</p></div></div>
        <button type="button" onClick={() => { signOut(); router.replace("/"); }} className="inline-flex min-h-11 items-center gap-2 text-xs text-ink/50"><LogOut size={14} />退出登录</button>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="账户余额">
        <div className="rounded-2xl bg-[#6E2638] p-6 text-[#FFF9F2] sm:row-span-2"><div className="flex items-center gap-2 text-xs text-white/65"><Flower2 size={15} />可用花瓣</div><p className="mt-4 font-serif text-5xl">{wallet.balance.available}<span className="ml-2 text-sm text-white/60">花瓣</span></p><p className="mt-3 text-xs text-white/60">花瓣长期有效，随时继续你的故事。</p><Link href="/recharge" className="mt-6 inline-flex min-h-10 items-center gap-5 rounded-full bg-[#FFF9F2] px-5 text-sm text-[#6E2638]">充值花瓣<ArrowUpRight size={15} /></Link></div>
        <div className="rounded-2xl border border-ink/10 bg-[#FFFDF8]/80 p-5"><p className="text-xs text-ink/45">累计用于解读</p><p className="mt-3 font-serif text-3xl">{wallet.balance.consumed}<span className="ml-2 text-xs text-ink/45">花瓣</span></p></div>
        <div className="rounded-2xl border border-ink/10 bg-[#FFFDF8]/80 p-5"><p className="text-xs text-ink/45">正在解读中</p><p className="mt-3 font-serif text-3xl">{wallet.balance.reserved}<span className="ml-2 text-xs text-ink/45">花瓣</span></p></div>
        <p className="col-span-1 rounded-xl border border-ink/8 px-5 py-4 text-xs leading-6 text-ink/50 sm:col-span-2">1 花瓣可解锁 1 次深度解读，包含 2 次追问。抽牌不扣花瓣，解读失败会返还预留的花瓣。</p>
      </section>
      <Link href="/daily#daily-calendar" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6E2638]/15 bg-[#FFFDF8]/70 p-5"><span><span className="block font-serif text-xl">每日签到与牌面日历</span><span className="mt-2 block text-xs leading-6 text-ink/50">每连续签到满 3 天，赠送 1 花瓣。漏签重新计数，跨月连签有效。</span></span><span className="inline-flex items-center gap-2 text-sm text-[#6E2638]">去看看<ArrowUpRight size={15} /></span></Link>
      <section className="mt-10" aria-label="消费管理">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10">
          <div className="flex gap-5" aria-label="消费记录类型">
            {([['usage', '解读消耗'], ['ledger', '花瓣流水'], ['orders', '充值订单']] as const).map(([id, label]) => <button type="button" aria-pressed={tab === id} onClick={() => setTab(id)} key={id} className={`min-h-12 border-b-2 text-sm ${tab === id ? "border-[#6E2638] text-[#6E2638]" : "border-transparent text-ink/45"}`}>{label}</button>)}
          </div>
          {tab !== "orders" && <select aria-label="记录时间范围" value={period} onChange={(event) => setPeriod(event.target.value)} className="mb-2 h-9 rounded-full border border-ink/10 bg-transparent px-3 text-xs text-ink/50"><option value="all">全部时间</option><option value="30">最近 30 天</option><option value="7">最近 7 天</option></select>}
        </div>
        <div className="min-h-[220px]" aria-live="polite">
          {tab === "usage" && (usage.length ? <ul className="divide-y divide-ink/8">{usage.map((reading) => <li key={reading.id} className="flex items-center justify-between gap-4 py-5"><div className="min-w-0"><Link href={reading.projectId ? `/deep/project/${reading.projectId}?view=history` : "/deep"} className="block truncate text-sm hover:text-[#6E2638]">{reading.question}</Link><p className="mt-2 text-xs text-ink/40">{dateLabel(reading.completedAt || reading.createdAt)} · {getDeepSpread(reading.spread).name} · 剩余 {reading.followUpsRemaining} 次追问</p></div><span className="shrink-0 text-sm text-[#6E2638]">−1 花瓣</span></li>)}</ul> : <EmptyRecord text="这段时间还没有解读消耗。抽牌后解锁的记录会出现在这里。" />)}
          {tab === "ledger" && (ledger.length ? <><ul className="divide-y divide-ink/8">{ledger.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 py-5"><div className="min-w-0"><p className="break-words text-sm">{({ welcome: "首次体验赠送", legacy_launch: "老用户启用赠送", reserve: "深度解读 · 预留花瓣", consume: "深度解读 · 完成扣除", release: "解读未完成 · 花瓣返还" } as Record<string, string>)[entry.kind] || entry.reason}</p><p className="mt-2 text-xs text-ink/40">{dateLabel(entry.createdAt)}{entry.reservedDelta > 0 ? " · 当时预留可用余额" : entry.consumedDelta > 0 ? " · 解读完成" : ""}</p></div><div className="shrink-0 text-right text-sm text-[#6E2638]">{entry.availableDelta === 0 ? `消耗 ${entry.consumedDelta} 花瓣` : `${entry.availableDelta > 0 ? "+" : "−"}${Math.abs(entry.availableDelta)} 花瓣`}</div></li>)}</ul><p className="py-3 text-xs leading-5 text-ink/40">展示最近 200 条花瓣变动；预留与结算属于同一笔解读，不会重复扣除。</p></> : <EmptyRecord text="这段时间没有花瓣变动。" />)}
          {tab === "orders" && <><CodeHistory />{orders.length>0 && <details className="mt-8 text-sm text-ink/50"><summary className="min-h-11 cursor-pointer">之前的本地模拟订单</summary><OrderList orders={orders}/></details>}</>}
        </div>
      </section>
    </>}
    <FeedbackContact />
  </AccountFrame>;
}

function EmptyRecord({ text }: { text: string }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 text-center"><Flower2 size={24} className="text-clay/35" /><p className="max-w-sm text-sm leading-7 text-ink/45">{text}</p></div>;
}


