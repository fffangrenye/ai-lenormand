"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Flower2 } from "lucide-react";
import { AccountFrame } from "./AccountPages";
import { FeedbackContact, paymentButton } from "./PaymentBits";
import { CodeHistory } from "./RedemptionHistory";
import { paidOnlineSiteEnabled, paidSiteRequest, PaidSiteError } from "@/lib/paid-local/site-bridge";
import type { PaidSummary, RedemptionResult } from "@/lib/paid-local/types";

export function RedeemClient() {
  const router=useRouter(),params=useSearchParams(),inFlight=useRef(false);
  const [account,setAccount]=useState<PaidSummary|null>(null),[code,setCode]=useState(""),[result,setResult]=useState<RedemptionResult|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const readingId=params.get("readingId")||"";
  useEffect(()=>{let active=true;void paidSiteRequest<PaidSummary>("summary").then(data=>{if(active)setAccount(data);}).catch(cause=>{
    if(!active)return;
    if(cause instanceof PaidSiteError && cause.status===401)router.replace(`/login?returnTo=${encodeURIComponent(`/redeem${readingId ? `?readingId=${encodeURIComponent(readingId)}` : ""}`)}`);
    else setError(cause instanceof Error ? cause.message : "账户读取失败，请刷新后重试。");
  });return()=>{active=false;};},[router,readingId]);
  const submit=async()=>{
    if(inFlight.current || !code.trim())return;
    inFlight.current=true;setBusy(true);setError("");setResult(null);
    try{
      const data=await paidSiteRequest<RedemptionResult>("redeem",{code,readingId,expectedUserId:account?.user.id});
      setResult(data);setCode("");setAccount(previous=>previous ? {...previous,balance:data.balance} : previous);
    }catch(cause){
      if(cause instanceof PaidSiteError && cause.status===401)router.replace(`/login?returnTo=${encodeURIComponent(`/redeem${readingId ? `?readingId=${encodeURIComponent(readingId)}` : ""}`)}`);
      setError(cause instanceof Error ? cause.message : "未能确认兑换结果。请保留充值码并重试，成功兑换不会重复到账。");
    }finally{inFlight.current=false;setBusy(false);}
  };
  return <AccountFrame title="兑换充值码">
    <p className="-mt-3 text-sm leading-7 text-ink/55">粘贴你在闲鱼收到的充值码，花瓣将加入当前登录账号。</p>
    <p className="mt-3 text-xs leading-6 text-[#6E2638]">{paidOnlineSiteEnabled ? "仅支持本站正式充值码，本地测试码不可兑换。" : "本地测试 · 仅接受 FLLOCAL 开头的测试码，不可正式售卖。"}</p>
    {account && <p className="mt-5 text-sm text-ink/55">当前账号：{account.user.label}<span className="mt-2 block text-xs">可用花瓣：{account.balance.available}</span></p>}
    <form className="mt-7 rounded-2xl border border-ink/10 bg-[#FFFDF8] p-6 sm:p-8" onSubmit={e=>{e.preventDefault();void submit();}}>
      <label htmlFor="flora-recharge-code" className="block text-sm">充值码</label>
      <input id="flora-recharge-code" name="code" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} maxLength={100} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="粘贴完整充值码" className="mt-3 min-h-14 w-full min-w-0 rounded-xl border border-ink/15 bg-transparent px-4 font-mono text-sm focus:border-[#6E2638] focus:outline-none" aria-describedby="code-help"/>
      <p id="code-help" className="mt-3 text-xs leading-6 text-ink/45">每个码仅可兑换一次。请确认当前账号正确，不要公开或转发充值码。</p>
      <button disabled={!account || busy || !code.trim()} className={`${paymentButton} mt-5 w-full bg-[#6E2638] !text-white sm:w-auto`}>{busy ? "正在兑换…" : "立即兑换"}</button>
    </form>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#6E2638]/20 p-4 text-sm leading-7 text-[#6E2638]">{error}</p>}
    {result && <section role="status" aria-live="polite" className="mt-6 rounded-2xl border border-[#6E2638]/20 bg-[#6E2638]/[0.035] p-6">
      <CheckCircle2 size={28} className="text-[#6E2638]" aria-hidden="true"/><h2 className="mt-4 font-serif text-2xl">{result.alreadyRedeemed ? "这枚充值码已兑换到你的账号" : "兑换成功"}</h2>
      <p className="mt-3 text-sm leading-7">{result.alreadyRedeemed ? `之前已到账 ${result.receipt.credits} 花瓣，本次未重复增加。` : `已获得 ${result.receipt.credits} 花瓣，可用于 ${result.receipt.credits} 次完整解读，每次包含 2 次追问。`}</p>
      <p className="mt-4 flex items-center gap-2 text-lg text-[#6E2638]"><Flower2 size={20}/>当前可用 {result.balance.available} 花瓣</p>
      <Link prefetch={false} href={result.receipt.returnPath} className={`${paymentButton} mt-5`}>{result.receipt.readingId ? "返回原问题，继续解读" : "查看我的花瓣"}</Link>
    </section>}
    <Link prefetch={false} href="/recharge" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#6E2638]">还没有充值码？前往购买</Link>
    {account && <CodeHistory refreshKey={result?.receipt.id||""}/>}
    <FeedbackContact/>
  </AccountFrame>;
}
