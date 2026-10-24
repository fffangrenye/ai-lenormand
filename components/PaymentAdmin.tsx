"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { paidSiteRequest, PaidSiteError, stablePaidRequestKey, completePaidRequestKey } from "@/lib/paid-local/site-bridge";
import type { PaymentAdminOverview } from "@/lib/paid-local/types";
import { money, orderState, channelName, paymentButton } from "./PaymentBits";
import { RedemptionAdmin } from "./RedemptionAdmin";
const auditLabel: Record<string, string> = { refund_request: "申请退款", refund_succeeded: "退款成功", refund_failed: "退款失败", reconcile_and_reissue: "核款与补发", compensation: "花瓣补偿" };
const refundLabel = { pending: "处理中", succeeded: "已完成", failed: "未完成，已恢复花瓣" };

export function PaymentAdmin() {
  const [data, setData] = useState<PaymentAdminOverview | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [user, setUser] = useState("");
  const [count, setCount] = useState(1);
  const refresh = useCallback(async () => { setData(await paidSiteRequest<PaymentAdminOverview>("admin")); }, []);
  useEffect(() => { void refresh().catch(cause => { if (!(cause instanceof PaidSiteError && cause.status === 401)) setError(cause instanceof Error ? cause.message : "后台读取失败"); }); }, [refresh]);
  const act = async (work: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (cause) { if (cause instanceof PaidSiteError && cause.status === 401) setData(null); setError(cause instanceof Error ? cause.message : "操作未完成，请重新查询记录。"); } finally { setBusy(false); }
  };
  const perform = (action: string, body: Record<string, unknown>) => act(async () => {
    const scope = `admin:${action}:${JSON.stringify(body)}:${reason.trim()}`;
    await paidSiteRequest(`admin/${action}`, { ...body, reason: reason.trim(), requestKey: stablePaidRequestKey(scope) });
    completePaidRequestKey(scope); setNotice("处理已记录，请查看最新订单、余额与操作日志。"); await refresh();
  });
  const users = data?.users.filter(item => `${item.id} ${item.label}`.toLowerCase().includes(search.toLowerCase())) || [];
  const orders = data?.orders.filter(item => `${item.id} ${item.userId}`.toLowerCase().includes(search.toLowerCase())) || [];
  const inputClass = "min-h-11 rounded-lg border border-ink/15 bg-[#FFFDF8] px-3 text-sm";
  return <main className="min-h-dvh bg-paper px-4 py-8 text-ink sm:px-8"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5"><div><Link prefetch={false} href="/" className="text-xs text-ink/50">Flora Lenormand · 返回首页</Link><h1 className="mt-3 font-serif text-3xl">本地支付管理</h1></div>{data && <button disabled={busy} onClick={() => void act(async () => { await paidSiteRequest("admin/logout", {}); setData(null); })} className={paymentButton}>退出管理</button>}</header>
    <p className="mt-5 text-xs leading-6 text-[#6E2638]">仅本机模拟环境。此处不会向微信或 Waffo 发起真实扣款或退款。管理登录有效期为 2 小时。</p>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#6E2638]/25 p-4 text-sm">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl border border-ink/10 p-4 text-sm">{notice}</p>}
    {!data ? <form onSubmit={event => { event.preventDefault(); void act(async () => { await paidSiteRequest("admin/session", { key }); setKey(""); await refresh(); }); }} className="mt-10 max-w-lg rounded-2xl border border-ink/10 bg-[#FFFDF8] p-6"><h2 className="font-serif text-2xl">管理员登录</h2><p className="mt-3 text-sm leading-7 text-ink/55">打开本机项目下的 <code>.local-paid/admin-access.txt</code>，复制口令到下方。不要向访客公开该文件或口令。</p><label className="mt-5 block text-sm">管理口令<input type="password" autoComplete="current-password" value={key} onChange={e => setKey(e.target.value)} className={`${inputClass} mt-2 w-full`} /></label><button disabled={busy || !key} className={`${paymentButton} mt-5`}>登录本地后台</button></form> : <>
      <section className="mt-7 grid gap-4 rounded-2xl border border-ink/10 bg-[#FFFDF8] p-5 sm:grid-cols-2"><label className="text-xs text-ink/55">按账号或订单号搜索<input value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} mt-2 w-full`} /></label><label className="text-xs text-ink/55">本次处理原因（所有资金与次数操作必填）<input maxLength={300} value={reason} onChange={e => setReason(e.target.value)} className={`${inputClass} mt-2 w-full`} /></label><button disabled={busy} onClick={() => void act(refresh)} className={`${paymentButton} justify-self-start`}>刷新全部记录</button></section>
      <RedemptionAdmin />
      <section className="mt-8"><h2 className="font-serif text-2xl">用户与花瓣</h2><div className="mt-4 overflow-x-auto rounded-xl border border-ink/10"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr className="bg-[#6E2638]/5">{["账号", "可用", "预留", "已消耗", "充值记录"].map(x => <th key={x} className="p-4 font-normal">{x}</th>)}</tr></thead><tbody>{users.map(item => <tr key={item.id} className="border-t border-ink/10"><td className="p-4">{item.label}<span className="mt-1 block text-ink/40">{item.id}</span></td><td className="p-4">{item.available}</td><td className="p-4">{item.reserved}</td><td className="p-4">{item.consumed}</td><td className="p-4">{item.firstPurchaseUsed ? "有记录" : "无记录"}</td></tr>)}</tbody></table></div>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void perform("compensate", { userId: user, count }); }}><label className="text-xs">补偿账号<select required value={user} onChange={e => setUser(e.target.value)} className={`${inputClass} ml-2`}><option value="">请选择</option>{data.users.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label className="text-xs">花瓣<input type="number" min={1} max={100} required value={count} onChange={e => setCount(Number(e.target.value))} className={`${inputClass} ml-2 w-20`} /></label><button disabled={busy || !reason.trim() || !user} className={paymentButton}>记录并补偿花瓣</button></form></section>
      <section className="mt-10"><h2 className="font-serif text-2xl">订单与退款</h2><p className="mt-2 text-xs text-ink/45">最近 200 笔。核款会查询模拟渠道凭据；重复补发不会重复增加花瓣。</p><div className="mt-5 space-y-4">{orders.map(order => <article key={order.id} className="rounded-2xl border border-ink/10 bg-[#FFFDF8] p-5"><div className="flex flex-wrap justify-between gap-3"><p className="text-sm">{order.userId} · {order.credits} 花瓣 · {money(order.amountCents)}<span className="mt-2 block text-xs text-ink/45">{channelName(order.channel)} · {orderState[order.state]} · {order.fulfillment === "granted" ? "已发放" : "未发放"}{order.promotionVersion && " · 首充五折"}</span></p><Link prefetch={false} href={`/recharge/mock?order=${order.id}`} className="text-xs text-[#6E2638] underline">用户订单页</Link></div><p className="mt-3 break-all text-xs text-ink/45">{order.id} · {new Date(order.createdAt).toLocaleString("zh-CN")}</p>
      <div className="mt-4 flex flex-wrap gap-3">{["pending", "processing", "paid"].includes(order.state) && <button disabled={busy || !reason.trim()} onClick={() => void perform("reconcile", { orderId: order.id })} className={paymentButton}>核款并补发</button>}{["paid", "partially_refunded", "review"].includes(order.state) && <button disabled={busy || !reason.trim()} onClick={() => void perform("refund-request", { orderId: order.id, userId: order.userId })} className={paymentButton}>申请退还未用花瓣</button>}</div>
      {order.refunds.map(refund => <div className="mt-4 border-t border-ink/10 pt-4 text-xs leading-6" key={refund.id}><p>退款 {money(refund.amountCents)} · {refund.credits} 花瓣 · {refundLabel[refund.state]} · {refund.reason}</p>{refund.state === "pending" && <div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || !reason.trim()} onClick={() => void perform("refund-complete", { refundId: refund.id, success: true })} className={paymentButton}>模拟渠道退款成功</button><button disabled={busy || !reason.trim()} onClick={() => void perform("refund-complete", { refundId: refund.id, success: false })} className={paymentButton}>模拟退款失败并恢复花瓣</button></div>}</div>)}</article>)}{!orders.length && <p className="py-8 text-sm text-ink/45">没有匹配的订单。</p>}</div></section>
      <section className="mt-10"><h2 className="font-serif text-2xl">闲鱼订单与退款核对</h2><p className="mt-3 text-xs leading-6 text-ink/55">仅向渠道查单并同步花瓣状态。资金退款须在闲鱼订单处理；此处不会发起真实转账。已使用或预留部分出现退款时会标记待核对。</p><button disabled={busy} className={`${paymentButton} mt-3`} onClick={()=>void act(async()=>{const result=await paidSiteRequest<{ok:boolean}>("admin/xianyu-sync",{});setNotice(result.ok ? "渠道状态已同步。" : "部分订单未能同步，保留上次核实状态。");await refresh();})}>向闲鱼查询最新状态</button><ul className="mt-4 divide-y divide-ink/10">{data.xianyuOrders?.filter(item=>`${item.id} ${item.userId} ${item.xianyuOrderNo||""}`.includes(search)).map(item=><li key={item.id} className="py-4 text-sm"><p>{item.userId} · {item.credits} 花瓣 · {money(item.amountCents)} · {item.state}</p><p className="mt-2 break-all text-xs text-ink/50">网站订单 {item.id}<br/>闲鱼订单 {item.xianyuOrderNo||"尚未收到付款"}</p><p className="mt-2 text-xs">已核实退款 {money(item.refundedCents)} · 冻结 {item.heldCredits} 花瓣 · 撤回 {item.refundedCredits} 花瓣{item.refundReview && " · 需人工核对已使用／预留部分"}</p></li>)}</ul></section>
      <section className="mt-10"><h2 className="font-serif text-2xl">操作日志</h2><p className="mt-2 text-xs text-ink/45">最近 200 条，保存处理原因与操作对象。</p><ul className="mt-4 divide-y divide-ink/10">{data.audit.map(entry => <li key={entry.id} className="py-4 text-xs leading-6"><p>{auditLabel[entry.action] || entry.action} · {entry.reason}</p><p className="break-all text-ink/40">{new Date(entry.createdAt).toLocaleString("zh-CN")} · {entry.actor} · {entry.target}</p></li>)}</ul></section>
    </>}
  </div></main>;
}
