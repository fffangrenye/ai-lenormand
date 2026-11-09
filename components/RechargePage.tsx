"use client";
import Link from "@/components/SiteLink";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Flower2, Ticket } from "lucide-react";
import { AccountFrame } from "./AccountPages";
import { FeedbackContact, money, paymentButton } from "./PaymentBits";
import { paidOnlineSiteEnabled, PaidSiteError, paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { CardCatalog } from "@/lib/paid-local/card-catalog";
import { paidConfig } from "@/lib/paid-local/config";
import { getXianyuPurchaseLinks } from "@/lib/xianyu-purchase";

const packageLabels: Record<string, string> = { ten: "单次最划算", five: "灵活补充", single: "单次解读" };

function XianyuPurchaseLink({ purchaseUrl, credits, featured }: { purchaseUrl: string; credits: number; featured: boolean }) {
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
    <a href={mobile ? links.appUrl : links.webUrl} target={mobile ? undefined : "_blank"} rel="noopener noreferrer" onClick={()=>{if(mobile)setAttempted(true);}} className={`${paymentButton} w-full gap-1 !px-3 ${featured ? "bg-[#6E2638] !text-white hover:!bg-[#582032]" : ""}`} aria-label={`${mobile ? "打开闲鱼 App 购买" : "前往闲鱼购买"} ${credits} 花瓣`}>{mobile ? "打开闲鱼 App 购买" : "前往闲鱼购买"}<ArrowUpRight size={14} aria-hidden="true"/></a>
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
  const packages = [...(catalog?.packages ?? [])].sort((a, b) => Number(b.ready) - Number(a.ready) || b.credits - a.credits);
  const five = packages.find(item => item.id === "five" && item.ready);
  useEffect(()=>{
    let active=true;
    void paidSiteRequest<CardCatalog>("card-catalog").then(data=>{if(active)setCatalog(data);}).catch(cause=>{
      if(!active)return;
      if(cause instanceof PaidSiteError && cause.status===401)router.replace(`/login?returnTo=${encodeURIComponent(`/recharge${readingId ? `?readingId=${encodeURIComponent(readingId)}` : ""}`)}`);
      else setError(cause instanceof Error ? cause.message : "套餐暂时无法读取，请刷新后重试。");
    });
    return()=>{active=false;};
  },[router,readingId]);
  return <AccountFrame title="补充花瓣">
    <p className="-mt-3 max-w-xl text-sm leading-7 text-ink/65">1 花瓣解锁 1 次完整深度解读，含同一问题的 {paidConfig.followUpsPerReading} 次追问。花瓣长期有效，可以分开使用。</p>
    <section className="mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border border-[#6E2638]/15 bg-[#6E2638]/[0.025] px-4 py-3 sm:px-5" aria-label="购买与兑换">
      <div>
        <p className="text-sm text-ink/75">闲鱼付款 <span aria-hidden="true">→</span> 收到充值码 <span aria-hidden="true">→</span> 回 Flora 兑换</p>
        <p className="mt-1 text-xs leading-5 text-ink/55">兑换后，花瓣到账至当前账号。</p>
      </div>
      <Link prefetch={false} href={redeemUrl} className={`${paymentButton} gap-2 !px-4`}><Ticket size={16} aria-hidden="true"/>已有充值码？立即兑换</Link>
    </section>
    {readingId && packages.some(item => item.id === "single" && item.ready) && <a href="#petal-single" className="mt-3 inline-flex min-h-10 items-center text-sm text-[#6E2638] underline underline-offset-4">只想继续这次解读？查看 1 花瓣</a>}
    {!paidOnlineSiteEnabled && <p className="mt-3 text-xs leading-6 text-[#6E2638]">本地预览 · 兑换码仅供本机测试，请勿在闲鱼付款。</p>}
    {paidOnlineSiteEnabled && catalog && !packages.some(item => item.ready) && <p className="mt-3 text-xs leading-6 text-[#6E2638]">充值库存准备中，已有正式充值码仍可兑换。</p>}
    {error && <p role="alert" className="mt-6 text-sm text-[#6E2638]">{error}</p>}
    {!catalog && !error && <p role="status" className="py-10 text-sm text-ink/50">正在读取套餐…</p>}
    <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="花瓣套餐">
      {packages.map(item => {
        const featured = item.id === "ten" && item.ready;
        const savings = featured && five && five.credits * 2 === item.credits ? 2 * five.amountCents - item.amountCents : 0;
        return <article key={item.id} id={`petal-${item.id}`} className={`flex min-w-0 scroll-mt-6 flex-col rounded-2xl border p-5 sm:p-6 ${featured ? "border-[#6E2638]/45 bg-[#FCF4F0] shadow-sm" : "border-ink/10 bg-[#FFFDF8]"}`}>
          <div className="flex items-center justify-between gap-2">
            <Flower2 size={22} className="shrink-0 text-[#6E2638]/80" aria-hidden="true"/>
            {(featured || item.id !== "ten") && <span className={`rounded-full px-2.5 py-1 text-xs ${featured ? "bg-[#6E2638]/10 text-[#6E2638]" : "bg-ink/5 text-ink/60"}`}>{packageLabels[item.id]}</span>}
          </div>
          <h2 className="mt-4 font-serif text-3xl text-ink">{item.credits} 花瓣</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">{item.credits} 次完整解读 + {item.credits * paidConfig.followUpsPerReading} 次追问</p>
          <p className="mt-4 text-2xl font-medium text-[#6E2638]">{money(item.amountCents)}<span className="ml-2 text-xs font-normal text-ink/55">实付</span></p>
          <p className="mt-1 text-xs leading-5 text-ink/60">每次完整解读{item.amountCents % item.credits ? "约 " : " "}{money(item.amountCents / item.credits)}，含 {paidConfig.followUpsPerReading} 次追问</p>
          {savings > 0 && <p className="mt-2 text-xs leading-5 text-[#6E2638]">比买两份 5 花瓣省 {money(savings)}</p>}
          <div className="mt-auto pt-5">
            {item.ready ? <XianyuPurchaseLink purchaseUrl={item.purchaseUrl} credits={item.credits} featured={featured}/> : <button disabled className={`${paymentButton} w-full !px-3`}>{paidOnlineSiteEnabled && item.id!=="ten" ? "充值准备中" : "商品审核中"}</button>}
          </div>
        </article>;
      })}
    </section>
    {catalog && <p className="mt-4 text-xs text-ink/50">首次及后续充值均为以上固定价格。</p>}
    <Link prefetch={false} href="/profile" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm text-[#6E2638]">查看我的花瓣与兑换记录<ArrowUpRight size={15}/></Link>
    <FeedbackContact/>
  </AccountFrame>;
}
