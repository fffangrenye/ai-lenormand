"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flower2, Check, ArrowUpRight } from "lucide-react";
import { AccountFrame } from "./AccountPages";
import { FeedbackContact, money, orderState, channelName, paymentButton, OrderList } from "./PaymentBits";
import { PaidSiteError, paidSiteRequest, stablePaidRequestKey, completePaidRequestKey } from "@/lib/paid-local/site-bridge";
import type { LocalOrder, PaymentCatalog, PaymentChannel } from "@/lib/paid-local/types";
import { XianyuPayments } from "./XianyuPayments";

export function MockRechargeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [catalog, setCatalog] = useState<PaymentCatalog | null>(null);
  const [selected, setSelected] = useState("five");
  const [channel, setChannel] = useState<PaymentChannel>("wechat");
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [qr, setQR] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [clock, setClock] = useState(Date.now());
  const context = useRef("");
  const orderId = useRef("");
  const alive = useRef(true);
  const handleError = useCallback((cause: unknown) => {
    if (!alive.current) return;
    if (cause instanceof PaidSiteError && cause.status === 401) router.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    else setError(cause instanceof Error ? cause.message : "操作未完成，请查询原订单后重试。");
  }, [router]);
  const refresh = useCallback(async () => {
    const requestedOrder = orderId.current;
    const [data, current] = await Promise.all([paidSiteRequest<PaymentCatalog>("catalog"), requestedOrder ? paidSiteRequest<LocalOrder>(`orders/${requestedOrder}`) : Promise.resolve(null)]);
    if (alive.current && requestedOrder === orderId.current) { setCatalog(data); setOrder(current); setClock(Date.now()); }
  }, []);
  useEffect(() => {
    alive.current = true;
    const params = new URLSearchParams(query);
    if (["single", "five", "ten"].includes(params.get("package") || "")) setSelected(params.get("package")!);
    context.current = params.get("readingId") || ""; orderId.current = params.get("order") || "";
    void refresh().catch(handleError);
    const focus = () => { void refresh().catch(handleError); }; window.addEventListener("focus", focus);
    return () => { alive.current = false; window.removeEventListener("focus", focus); };
  }, [query, refresh, handleError]);
  useEffect(() => {
    setQR(""); let cancelled = false;
    if (order?.state === "pending") void paidSiteRequest<{ dataUrl: string }>(`orders/${order.id}/qr`).then(data => { if (!cancelled) setQR(data.dataUrl); }).catch(handleError);
    return () => { cancelled = true; };
  }, [order?.id, order?.state, handleError]);
  useEffect(() => {
    if (!order || !["pending", "processing"].includes(order.state)) return;
    const id = setInterval(() => { setClock(Date.now()); if (!document.hidden) void refresh().catch(handleError); }, 3000);
    return () => clearInterval(id);
  }, [order?.id, order?.state, refresh, handleError]);
  const act = async (fn: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError("");
    try { await fn(); } catch (cause) { handleError(cause); } finally { if (alive.current) setBusy(false); }
  };
  const create = () => act(async () => {
    const scope = `checkout:${selected}:${channel}:${context.current}`;
    const created = await paidSiteRequest<LocalOrder>("orders", { packageId: selected, channel, readingId: context.current, requestKey: stablePaidRequestKey(scope) });
    completePaidRequestKey(scope); orderId.current = created.id; setOrder(created);
    window.history.replaceState(null, "", `/recharge/mock?order=${created.id}`); await refresh();
  });
  const orderAction = (action: string, extra: Record<string, unknown> = {}) => act(async () => {
    if (!order) return;
    const updated = await paidSiteRequest<LocalOrder>(action, { orderId: order.id, ...extra }); setOrder(updated); await refresh();
  });
  const refund = () => act(async () => {
    if (!order) return; const scope = `refund:${order.id}:${reason.trim()}`;
    setOrder(await paidSiteRequest<LocalOrder>("refund-request", { orderId: order.id, reason: reason.trim(), requestKey: stablePaidRequestKey(scope) }));
    completePaidRequestKey(scope); setReason(""); await refresh();
  });
  const reset = () => act(async () => {
    context.current = order?.readingId || context.current; orderId.current = ""; setOrder(null); setQR(""); setReason("");
    window.history.replaceState(null, "", `/recharge/mock${context.current ? `?readingId=${encodeURIComponent(context.current)}` : ""}`); await refresh();
  });
  const current = catalog?.packages.find(item => item.id === selected);
  const remaining = order ? Math.max(0, Math.ceil((order.expiresAt - clock) / 60000)) : 0;
  return <AccountFrame title="充值花瓣">
    <p className="-mt-3 max-w-xl text-sm leading-7 text-ink/55">为下一次灵感，留一片花瓣。1 花瓣解锁 1 次完整深度解读，包含 2 次追问，长期有效。</p>
    <p className="mt-4 rounded-xl border border-[#6E2638]/15 bg-[#6E2638]/[0.03] px-4 py-3 text-xs leading-6 text-[#6E2638]">V3 本地体验 · 所有付款与退款均为模拟，不会产生真实扣款。</p>
    {error && <div role="alert" className="mt-5 rounded-xl border border-[#6E2638]/30 p-4 text-sm leading-7">{error}<button className="ml-4 underline" onClick={() => void act(refresh)}>重新查询</button></div>}
    {!catalog && !error && <p className="py-12 text-sm text-ink/50" role="status">正在读取账户与套餐…</p>}
    {catalog && !order && <>
      <div className="mt-8"><h2 className="font-serif text-2xl">选择你的花瓣</h2><p className="mt-3 text-xs leading-6 text-ink/50">1 花瓣 4.99 元，5 花瓣 14.99 元，10 花瓣 24.99 元。首次与后续充值价格相同。</p></div>
      <fieldset className="mt-6 grid gap-4 sm:grid-cols-3"><legend className="sr-only">选择花瓣套餐</legend>{catalog.packages.map(item => <label key={item.id} className={`relative cursor-pointer rounded-2xl border p-6 ${selected === item.id ? "border-[#6E2638] bg-[#6E2638]/[0.04]" : "border-ink/10 bg-[#FFFDF8]"}`}>
        <input type="radio" name="package" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} className="peer sr-only" /><span className="absolute inset-0 rounded-2xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#6E2638]" />
        <span className="flex justify-between text-[#6E2638]"><Flower2 size={22} />{selected === item.id && <Check size={18} />}</span><h3 className="mt-6 font-serif text-3xl">{item.credits} <span className="text-sm text-ink/50">花瓣</span></h3><p className="mt-2 text-xs text-ink/45">{item.credits} 次主解读 · 每次含 2 次追问</p>
        <p className="mt-6 text-2xl text-[#6E2638]">{money(item.amountCents)}</p><p className="mt-2 text-xs text-ink/45">人民币</p>
      </label>)}</fieldset>
      <fieldset className="mt-8"><legend className="mb-4 text-sm">选择支付方式</legend><div className="grid gap-3 sm:grid-cols-2">{(["wechat", "waffo"] as const).map(value => <label key={value} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-5 ${channel === value ? "border-[#6E2638]" : "border-ink/10"}`}><input type="radio" name="channel" checked={channel === value} onChange={() => setChannel(value)} className="accent-[#6E2638]" /><span className="text-sm">{channelName(value)}<span className="ml-2 text-xs text-ink/40">本地模拟</span></span></label>)}</div></fieldset>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FFFDF8] p-6"><p className="text-sm">{current?.credits} 花瓣 · 应付 <strong className="font-normal text-[#6E2638]">{current && money(current.amountCents)}</strong></p><button disabled={busy} onClick={create} className={`${paymentButton} bg-[#6E2638] !text-white`}>{busy ? "正在创建…" : "确认套餐并创建模拟订单"}</button></section>
      {catalog.orders.some(item => ["pending", "processing", "review"].includes(item.state)) && <p className="mt-3 text-xs leading-6 text-[#6E2638]">你有待处理订单，请从下方订单记录继续付款、取消或核实后再新建。</p>}
    </>}
    {order && <section className="mt-7 rounded-2xl border border-ink/10 bg-[#FFFDF8] p-5 sm:p-8" aria-label="订单详情">
      <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs text-ink/45">{channelName(order.channel)} · 本地模拟</p><h2 className="mt-3 font-serif text-2xl">{orderState[order.state]}</h2></div><div className="text-right"><p className="text-2xl text-[#6E2638]">{money(order.amountCents)}</p><p className="mt-2 text-xs text-ink/45">{order.credits} 花瓣{order.promotionVersion ? " · 首充五折" : " · 常规价"}</p></div></div>
      <dl className="mt-5 space-y-2 border-y border-ink/10 py-4 text-xs leading-6 text-ink/50"><div><dt className="inline">订单号：</dt><dd className="inline break-all">{order.id}</dd></div><div><dt className="inline">创建时间：</dt><dd className="inline">{new Date(order.createdAt).toLocaleString("zh-CN")}</dd></div><div><dt className="inline">套餐原价：</dt><dd className="inline">{money(order.regularCents)} · 本次金额已锁定</dd></div></dl>
      {order.state === "pending" && <div className="mt-6 grid items-center gap-5 sm:grid-cols-[220px_1fr]">
        <div className="text-center">{qr ? <img src={qr} width={220} height={220} alt="本地模拟订单二维码，不能付款" className="mx-auto max-w-full" /> : <p className="py-10 text-xs">二维码准备中…</p>}<p className="text-xs text-[#6E2638]">模拟码 · 无法真实付款</p></div>
        <div><h3 className="font-serif text-xl">确认后，试一次模拟付款</h3><p className="mt-3 text-sm leading-7 text-ink/55">订单约 {remaining} 分钟后到期。正式微信 Native 将使用微信“扫一扫”，不支持从相册识别二维码；Waffo 将使用获批后的银行卡收银台。</p><button disabled={busy} onClick={() => orderAction("payment-simulate", { mode: "success" })} className={`${paymentButton} mt-5 bg-[#6E2638] !text-white`}>模拟付款成功</button><button disabled={busy} onClick={() => orderAction("order-cancel")} className={`${paymentButton} ml-3 mt-3`}>取消订单</button></div>
      </div>}
      {order.state === "processing" && <p role="status" className="mt-6 text-sm leading-7">已收到模拟付款，正在等待渠道确认。延迟场景约 15 秒到账，可离开后从用户主页查询。</p>}
      {order.state === "paid" && <div role="status" className="mt-6"><p className="text-lg text-[#6E2638]">{order.fulfillment === "granted" ? `已到账 ${order.credits} 花瓣` : "付款已核实，花瓣待补发"}</p><p className="mt-3 text-sm leading-7 text-ink/55">{order.fulfillment === "granted" ? "花瓣已记入你的账户，重复刷新不会重复发放。" : "本地异常测试已保存付款凭据，可在管理后台核款并补发；无需再次付款。"}</p>{order.fulfillment === "granted" && <Link prefetch={false} href={order.returnPath} className={`${paymentButton} mt-5`}>{order.readingId ? "返回原问题，继续解读" : "查看我的花瓣"}<ArrowUpRight size={15} className="ml-2" /></Link>}</div>}
      {order.state === "review" && <p className="mt-5 text-sm leading-7 text-[#6E2638]">付款凭据与订单不一致，暂不发放花瓣。请联系反馈邮箱并附上订单号，由后台核查或退款。</p>}
      {["failed", "cancelled", "expired"].includes(order.state) && <p className="mt-5 text-sm leading-7 text-ink/55">这笔订单未完成付款，未扣款、未增加花瓣。</p>}
      {order.state === "refunding" && <p className="mt-5 text-sm leading-7">退款申请已记录，对应未使用花瓣已冻结，等待后台完成模拟退款。若退款失败，冻结花瓣会恢复。</p>}
      {order.refunds.map(item => <p key={item.id} className="mt-4 text-xs leading-6 text-ink/55">退款 {money(item.amountCents)} · {item.credits} 花瓣 · {{ pending: "处理中", succeeded: "已完成", failed: "失败，已恢复冻结花瓣" }[item.state]}<br />{item.reason}</p>)}
      <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} onClick={() => orderAction("order-query")} className={paymentButton}>查询支付结果</button>{!["pending", "processing", "review", "refunding"].includes(order.state) && <button disabled={busy} onClick={reset} className={paymentButton}>再选一个套餐</button>}</div>
      {["paid", "partially_refunded", "review"].includes(order.state) && <details className="mt-6 border-t border-ink/10 pt-5"><summary className="cursor-pointer text-sm text-ink/55">申请退还本单未使用花瓣</summary><p className="mt-3 text-xs leading-6 text-ink/50">按本单实付金额和未使用比例向下取整到分；已用于解读的花瓣不退，解读中的预留花瓣需先完成。申请后冻结本单可退花瓣。</p><label className="mt-3 block text-xs">退款原因<input maxLength={300} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-ink/15 bg-transparent p-3 text-sm" /></label><button disabled={busy || !reason.trim()} onClick={refund} className={`${paymentButton} mt-3`}>提交模拟退款申请</button></details>}
      {!["refunding", "refunded", "partially_refunded"].includes(order.state) && <details className="mt-6 border-t border-ink/10 pt-5"><summary className="cursor-pointer text-xs text-ink/40">本地异常场景测试</summary><div className="mt-3 flex flex-wrap gap-2">{(order.state === "pending" ? [["delay", "延迟 15 秒到账"], ["failed", "付款失败"], ["bad_amount", "金额异常待核实"], ["unfulfilled", "已付款但待补发"]] : order.state === "paid" ? [["duplicate", "重复付款通知"]] : []).map(([mode, label]) => <button key={mode} disabled={busy} onClick={() => orderAction("payment-simulate", { mode })} className={paymentButton}>{label}</button>)}</div></details>}
    </section>}
    {catalog && !order && <details className="mt-8"><summary className="cursor-pointer text-sm text-ink/60">我的充值订单（最近 200 笔）</summary><OrderList orders={catalog.orders} /></details>}
    <XianyuPayments readingId={searchParams.get("readingId") || ""} />
    <Link prefetch={false} href="/profile" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#6E2638]">查看用户主页与消费记录<ArrowUpRight size={15} /></Link>
    <FeedbackContact />
  </AccountFrame>;
}
