"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { CodeReceipt } from "@/lib/paid-local/types";

export function CodeHistory({refreshKey=""}:{refreshKey?:string}) {
  const [items,setItems]=useState<CodeReceipt[]>([]),[error,setError]=useState("");
  useEffect(()=>{let active=true;void paidSiteRequest<CodeReceipt[]>("redemptions").then(data=>{if(active){setItems(data);setError("");}}).catch(()=>{if(active)setError("兑换记录暂时无法读取，请刷新后重试。");});return()=>{active=false;};},[refreshKey]);
  return <section className="mt-8" aria-label="充值码兑换记录"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl">兑换记录</h2><Link prefetch={false} href="/redeem" className="inline-flex min-h-11 items-center text-sm text-[#6E2638]">兑换充值码</Link></div>
    {error && <p role="alert" className="py-4 text-sm">{error}</p>}
    <ul className="mt-3 divide-y divide-ink/10">{items.map(item=><li key={item.id} className="py-5 text-sm"><div className="flex flex-wrap justify-between gap-3"><span>{item.credits} 花瓣 · 码尾号 {item.codeSuffix}</span><span className="text-[#6E2638]">{item.state==="refunded" ? "退款已登记" : "已兑换"}</span></div><p className="mt-2 text-xs leading-6 text-ink/45">{new Date(item.redeemedAt).toLocaleString("zh-CN")}{item.state==="refunded" && ` · 已调整 ${item.refundedCredits} 花瓣`}{item.refundReview && " · 部分权益待人工核对"}</p></li>)}</ul>
    {!items.length && !error && <p className="py-8 text-sm text-ink/45">还没有充值码兑换记录。</p>}
  </section>;
}
