"use client";
import Link from "@/components/SiteLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { paidSiteRequest, stablePaidRequestKey, completePaidRequestKey } from "@/lib/paid-local/site-bridge";
import type { XianyuCatalog, XianyuOrder } from "@/lib/paid-local/types";
import { money, paymentButton } from "./PaymentBits";

function label(order:XianyuOrder) {
  if(order.refundReview)return "退款需人工核对";
  if([1,2,3,8].includes(order.refundStatus))return "退款处理中 · 本单未用花瓣已冻结";
  if(order.refundedCents)return order.refundedCents===order.amountCents ? "已退款" : "部分退款";
  return ({pending:"等待闲鱼付款",paid:"花瓣已到账",review:"付款待核实",expired:"充值码已到期"} as Record<string,string>)[order.state] || "正在核对";
}
export function XianyuPayments({readingId="",historyOnly=false}:{readingId?:string;historyOnly?:boolean}) {
  const [catalog,setCatalog]=useState<XianyuCatalog|null>(null),[active,setActive]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
  const alive=useRef(true),sequence=useRef(0);
  const refresh=useCallback(async()=>{const seq=++sequence.current;try{const data=await paidSiteRequest<XianyuCatalog>("xianyu");if(alive.current && seq===sequence.current){setCatalog(data);setError("");}}catch{if(alive.current)setError("暂时无法同步闲鱼订单，请稍后重试。");}},[]);
  useEffect(()=>{alive.current=true;void refresh();const focus=()=>void refresh();window.addEventListener("focus",focus);const timer=setInterval(()=>{if(!document.hidden)void refresh();},15000);return()=>{alive.current=false;++sequence.current;clearInterval(timer);window.removeEventListener("focus",focus);};},[refresh]);
  const current=catalog?.orders.find(x=>x.id===active);
  const create=async(id:string)=>{if(busy)return;setBusy(true);setError("");const scope=`xianyu:${id}:${readingId}`;try{const result=await paidSiteRequest<XianyuOrder>("xianyu/checkout",{packageId:id,readingId,requestKey:stablePaidRequestKey(scope)});if(alive.current){setActive(result.id);setCopied(false);await refresh();}completePaidRequestKey(scope);}catch(cause){if(alive.current)setError(cause instanceof Error ? cause.message : "未能创建充值单。");}finally{if(alive.current)setBusy(false);}};
  if(!catalog && !error)return null;
  return <section className="mt-8 rounded-2xl border border-[#6E2638]/20 bg-[#FFFDF8] p-5 sm:p-7" aria-label="闲鱼充值">
    <h2 className="font-serif text-2xl">{historyOnly ? "闲鱼充值订单" : "通过闲鱼购买花瓣"}</h2>
    {!historyOnly && <><p className="mt-3 text-sm leading-7 text-ink/60">先在这里生成专属充值码，再到闲鱼填写充值码并付款。系统核实后，花瓣会记入当前账号。</p>{!catalog?.enabled && <p role="status" className="mt-3 text-sm text-[#6E2638]">正在准备套餐和联调，尚未开放真实购买，请暂勿付款。</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{catalog?.packages.map(item=><button key={item.id} disabled={busy || !catalog.enabled || !item.ready} className={`${paymentButton} flex-col !items-start !rounded-xl !p-4`} onClick={()=>void create(item.id)}><span>{item.credits} 花瓣</span><span className="mt-2 text-xl text-[#6E2638]">{money(item.amountCents)}</span><span className="mt-2 text-xs text-ink/50">{item.ready && catalog.enabled ? "生成充值码" : "套餐待开放"}</span></button>)}</div></>}
    {error && <p role="alert" className="mt-4 text-sm text-[#6E2638]">{error}</p>}
    {catalog && !catalog.syncOk && catalog.orders.some(x=>x.state==="paid") && <p role="status" className="mt-3 text-xs leading-6">渠道同步暂未完成。当前展示上次核实结果，请稍后刷新。</p>}
    {current && <div className="mt-5 rounded-xl border border-ink/10 p-4"><h3 className="font-serif text-xl">{label(current)}</h3><p className="mt-3 text-sm">{current.credits} 花瓣 · {money(current.amountCents)}</p>
      {current.state==="pending" && <><label className="mt-4 block text-xs">本单充值码<input readOnly value={current.accountCode} className="mt-2 w-full rounded-lg border border-ink/20 bg-transparent p-3 font-mono text-sm" onFocus={e=>e.currentTarget.select()}/></label><button className={`${paymentButton} mt-3`} onClick={()=>void navigator.clipboard.writeText(current.accountCode).then(()=>setCopied(true)).catch(()=>setError("请长按或选中上方充值码复制。"))}>{copied ? "已复制" : "复制充值码"}</button>{catalog?.enabled && <a className={`${paymentButton} ml-3 mt-3`} href={current.purchaseUrl} target="_blank" rel="noopener noreferrer">前往闲鱼购买</a>}<ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-ink/60"><li>复制充值码，在闲鱼商品的“网站充值码”中完整粘贴。</li><li>确认商品档次和应付金额一致，每单购买 1 份。</li><li>付款后回到本页查看结果，无需再次付款。</li></ol><p className="mt-3 text-xs leading-6 text-ink/50">充值码约 30 分钟有效。过期后已付款的订单会保留核实；如填错账号或金额，请联系反馈邮箱。</p></>}
      {current.state==="pending" && <button className={`${paymentButton} mt-3`} disabled={busy} onClick={()=>{setBusy(true);void paidSiteRequest("xianyu/cancel",{orderId:current.id}).then(()=>refresh()).catch(()=>setError("暂未作废，请刷新订单状态。")).finally(()=>{if(alive.current)setBusy(false);});}}>作废本次充值码</button>}
      {current.state==="pending" && <p className="mt-2 text-xs leading-6 text-ink/50">作废充值码不会撤销闲鱼订单。已经付款时请等待核实，勿重复购买。</p>}
      {current.state==="paid" && !current.refundedCents && !current.heldCredits && ![1,2,3,8].includes(current.refundStatus) && <Link prefetch={false} href={current.returnPath} className={`${paymentButton} mt-4`}>{current.readingId ? "返回原问题，继续解读" : "查看我的花瓣"}</Link>}
      {current.xianyuOrderNo && <p className="mt-3 break-all text-xs text-ink/50">闲鱼订单号：{current.xianyuOrderNo}</p>}
      {current.refundedCents>0 && <p className="mt-3 text-sm">已核实退款 {money(current.refundedCents)}；调整 {current.refundedCredits} 花瓣。</p>}
      <p className="mt-4 text-xs leading-6 text-ink/60">退款请在闲鱼 App 的“我 → 我买到的 → 对应订单”中申请。平台处理后，网站同步本单花瓣状态；已用部分和异常退款需人工核对。</p>
    </div>}
    {!!catalog?.orders.length && <ul className="mt-5 divide-y divide-ink/10">{catalog.orders.map(item=><li key={item.id}><button className="flex min-h-14 w-full flex-wrap justify-between gap-3 py-3 text-left text-sm" onClick={()=>{setActive(item.id);setCopied(false);}}><span>{item.credits} 花瓣 · {money(item.amountCents)}<span className="mt-1 block text-xs text-ink/40">{new Date(item.createdAt).toLocaleString("zh-CN")}</span></span><span className="text-[#6E2638]">{label(item)}</span></button></li>)}</ul>}
    <button className={`${paymentButton} mt-4`} onClick={()=>void refresh()}>刷新支付与退款状态</button>
  </section>;
}
