"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Flower2, Ticket } from "lucide-react";
import { AccountFrame } from "./AccountPages";
import { FeedbackContact, money, paymentButton } from "./PaymentBits";
import { paidOnlineSiteEnabled, PaidSiteError, paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { CardCatalog } from "@/lib/paid-local/card-catalog";
import { getXianyuPurchaseLinks } from "@/lib/xianyu-purchase";

function XianyuPurchaseLink({ purchaseUrl, credits }: { purchaseUrl: string; credits: number }) {
  const [mobile,setMobile]=useState(false),[attempted,setAttempted]=useState(false),[copyStatus,setCopyStatus]=useState("");
  const links=getXianyuPurchaseLinks(purchaseUrl);
  useEffect(()=>{
    setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1));
  },[]);
  if(!links)return <button disabled className={`${paymentButton} mt-auto !px-3`}>购买链接准备中</button>;
  const copyLink=async()=>{
    try {await navigator.clipboard.writeText(links.shareUrl);setCopyStatus("已复制，请打开闲鱼 App 粘贴商品链接。");}
    catch {setCopyStatus("暂时无法自动复制，请长按下方链接复制。");}
  };
  return <div className="mt-auto">
    <a href={mobile ? links.appUrl : links.webUrl} target={mobile ? undefined : "_blank"} rel="noopener noreferrer" onClick={()=>{if(mobile)setAttempted(true);}} className={`${paymentButton} w-full gap-1 !px-3`} aria-label={`${mobile ? "打开闲鱼 App 购买" : "前往闲鱼购买"} ${credits} 花瓣`}>{mobile ? "打开闲鱼 App 购买" : "前往闲鱼购买"}<ArrowUpRight size={14}/></a>
    {mobile && <p className="mt-3 text-center text-[11px] leading-5 text-ink/45">已登录闲鱼 App，可直接使用 App 内账号</p>}
    {attempted && <div className="mt-4 rounded-lg border border-ink/10 p-3 text-xs leading-6">
      <p className="text-ink/60">没有打开闲鱼？可复制商品链接，在闲鱼 App 中粘贴打开。微信内请尝试右上角「在浏览器打开」。</p>
      <div className="mt-2 flex flex-wrap gap-x-4"><button type="button" onClick={()=>void copyLink()} className="min-h-10 text-[#6E2638] underline underline-offset-4">复制商品链接</button><a href={links.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-[#6E2638] underline underline-offset-4">网页购买</a></div>
      <input aria-label={`${credits} 花瓣商品分享链接`} readOnly value={links.shareUrl} onFocus={event=>event.currentTarget.select()} className="mt-2 min-h-10 w-full rounded border border-ink/10 bg-transparent px-2 text-[11px]"/>
      {copyStatus && <p role="status" className="mt-2 text-[#6E2638]">{copyStatus}</p>}
      <p className="mt-2 text-ink/45">付款后回到此页，点击「兑换充值码」。</p>
    </div>}
  </div>;
}

export function RechargeClient() {
  const router=useRouter(),params=useSearchParams();
  const [catalog,setCatalog]=useState<CardCatalog|null>(null),[error,setError]=useState("");
  const readingId=params.get("readingId")||"";
  const redeemUrl=`/redeem${readingId ? `?readingId=${encodeURIComponent(readingId)}` : ""}`;
  useEffect(()=>{
    let active=true;
    void paidSiteRequest<CardCatalog>("card-catalog").then(data=>{if(active)setCatalog(data);}).catch(cause=>{
      if(!active)return;
      if(cause instanceof PaidSiteError && cause.status===401)router.replace(`/login?returnTo=${encodeURIComponent(`/recharge${readingId ? `?readingId=${encodeURIComponent(readingId)}` : ""}`)}`);
      else setError(cause instanceof Error ? cause.message : "套餐暂时无法读取，请刷新后重试。");
    });
    return()=>{active=false;};
  },[router,readingId]);
  return <AccountFrame title="充值花瓣">
    <p className="-mt-3 max-w-xl text-sm leading-7 text-ink/60">1 花瓣解锁 1 次完整深度解读，包含同一问题的 2 次追问，长期有效。</p>
    <p className="mt-4 text-xs leading-6 text-[#6E2638]">{paidOnlineSiteEnabled ? catalog?.packages.some(item=>item.ready) ? "在闲鱼付款后领取充值码，返回 Flora 兑换，花瓣将加入当前登录账号。" : "充值库存准备中，暂未开放购买。已有正式充值码仍可兑换。" : "本地预览 · 兑换码仅供本机测试。正式发码库存尚未配置，请先勿付款。"}</p>
    {error && <p role="alert" className="mt-6 text-sm text-[#6E2638]">{error}</p>}
    {!catalog && !error && <p role="status" className="py-10 text-sm text-ink/50">正在读取套餐…</p>}
    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="花瓣套餐">{catalog?.packages.map(item=><article key={item.id} className="flex flex-col rounded-2xl border border-ink/10 bg-[#FFFDF8] p-6">
      <Flower2 size={23} className="text-[#6E2638]/75" aria-hidden="true"/>
      <h2 className="mt-6 font-serif text-4xl">{item.credits}<span className="ml-2 text-sm text-ink/50">花瓣</span></h2>
      <p className="mt-3 text-xs leading-6 text-ink/50">{item.credits} 次完整解读<br/>每次包含 2 次追问</p>
      <p className="mb-6 mt-6 text-2xl text-[#6E2638]">{money(item.amountCents)}<span className="ml-2 text-xs text-ink/40">人民币</span></p>
      {item.ready ? <XianyuPurchaseLink purchaseUrl={item.purchaseUrl} credits={item.credits}/> : <button disabled className={`${paymentButton} mt-auto !px-3`}>{paidOnlineSiteEnabled && item.id!=="ten" ? "充值准备中" : "商品审核中"}</button>}
    </article>)}</section>
    <p className="mt-4 text-xs text-ink/45">首次及后续充值均为以上固定价格。</p>
    <section className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#6E2638]/15 bg-[#6E2638]/[0.025] p-6">
      <div><h2 className="flex items-center gap-2 font-serif text-2xl"><Ticket size={21} className="text-[#6E2638]"/>已有充值码</h2><p className="mt-2 text-sm leading-7 text-ink/55">闲鱼付款后领取充值码，回到这里兑换到当前账号。</p></div>
      <Link prefetch={false} href={redeemUrl} className={`${paymentButton} bg-[#6E2638] !text-white`}>兑换充值码</Link>
    </section>
    <ol className="mt-8 grid gap-3 text-xs leading-6 text-ink/50 sm:grid-cols-3"><li>01 · 选择套餐，在闲鱼付款</li><li>02 · 在闲鱼领取对应充值码</li><li>03 · 返回 Flora 兑换，花瓣到账</li></ol>
    <Link prefetch={false} href="/profile" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm text-[#6E2638]">查看我的花瓣与兑换记录<ArrowUpRight size={15}/></Link>
    <FeedbackContact/>
  </AccountFrame>;
}
