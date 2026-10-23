"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { paidOnlineSiteEnabled, paidSiteRequest, stablePaidRequestKey, completePaidRequestKey } from "@/lib/paid-local/site-bridge";
import type { CodeAdminOverview } from "@/lib/paid-local/types";
import { money, paymentButton } from "./PaymentBits";
const stateLabel:Record<string,string>={active:"未兑换",redeemed:"已兑换",disabled:"已停用",refunded:"退款已登记"};
const actionLabel:Record<string,string>={generate:"生成",export:"导出未兑换码",disable:"停用",refund:"退款核对"};
export function RedemptionAdmin() {
  const [data,setData]=useState<CodeAdminOverview|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [packageId,setPackageId]=useState("single"),[quantity,setQuantity]=useState(3),[reason,setReason]=useState(""),[search,setSearch]=useState(""),[busy,setBusy]=useState(false);
  const [exportText,setExportText]=useState("");
  const inFlight=useRef(false);
  const refresh=useCallback(async()=>{setData(await paidSiteRequest<CodeAdminOverview>("admin/codes"));},[]);
  useEffect(()=>{let active=true;void paidSiteRequest<CodeAdminOverview>("admin/codes").then(result=>{if(active)setData(result);}).catch(()=>{if(active)setError("充值码管理暂时无法读取，请重新登录后台或刷新。");});return()=>{active=false;};},[]);
  const perform=async(action:string,body:Record<string,unknown>)=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");setNotice("");
    const scope=`codes:${action}:${JSON.stringify(body)}:${reason.trim()}`,requestKey=stablePaidRequestKey(scope);
    try{
      const result=await paidSiteRequest<{filename?:string;codes?:string[];previouslyExported?:boolean}>(`admin/codes/${action}`,{...body,reason:reason.trim(),requestKey});
      if(action==="export" && result.codes && result.filename){
        if(!result.codes.length){setNotice("该批次没有可导出的未兑换码。");}
        else {const content=result.codes.join("\r\n")+"\r\n";setExportText(content);const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(result.previouslyExported ? `注意：这是同一批已导出的充值码，剩余 ${result.codes.length} 个未兑换码。若已导入闲管家，不能再次导入。` : `首次导出 ${result.codes.length} 个${paidOnlineSiteEnabled ? "正式充值码" : "本地测试码"}，一行一个。每批只导入闲管家一次。`);}
      }else setNotice(action==="generate" ? "充值码已生成。请在对应批次导出。" : "处理已记录；这里只调整对应权益，不执行闲鱼资金退款。");
      completePaidRequestKey(scope);await refresh();
    }catch(cause){setError(cause instanceof Error ? cause.message : "操作失败，请刷新核对。");}
    finally{inFlight.current=false;setBusy(false);}
  };
  const input="min-h-11 rounded-lg border border-ink/15 bg-[#FFFDF8] px-3 text-sm";
  const codes=data?.codes.filter(x=>`${x.id} ${x.suffix} ${x.userId||""} ${x.batchId}`.toLowerCase().includes(search.toLowerCase()))||[];
  return <section className="mt-10 border-t border-ink/10 pt-8" aria-label="充值码管理">
    <h2 className="font-serif text-2xl">充值码管理</h2><p className="mt-3 text-xs leading-6 text-[#6E2638]">{!paidOnlineSiteEnabled && "仅本地测试码，不可正式售卖。"}后台列表只显示尾号，完整码仅在导出时提供；再次导出会得到同一批未兑换码，不能重复导入库存。</p>
    {error && <p role="alert" className="mt-4 text-sm text-[#6E2638]">{error}</p>}{notice && <p role="status" className="mt-4 text-sm leading-7">{notice}</p>}
    {exportText && <div className="mt-4 rounded-xl border border-ink/10 p-4"><label className="block text-xs">本次导出的充值码（下载未开始时可手动复制）<textarea readOnly value={exportText} rows={4} spellCheck={false} className="mt-2 w-full rounded-lg border border-ink/10 bg-[#FFFDF8] p-3 font-mono text-xs"/></label><button type="button" onClick={()=>setExportText("")} className={`${paymentButton} mt-3`}>隐藏完整码</button></div>}
    <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void perform("generate",{packageId,quantity});}}>
      <label className="text-xs">套餐<select value={packageId} onChange={e=>setPackageId(e.target.value)} className={`${input} mt-2 block`}><option value="single">1 花瓣 · ¥4.99</option><option value="five">5 花瓣 · ¥14.99</option><option value="ten">10 花瓣 · ¥24.99</option></select></label>
      <label className="text-xs">数量<input type="number" min={1} max={500} required value={quantity} onChange={e=>setQuantity(Number(e.target.value))} className={`${input} mt-2 block w-24`}/></label>
      <label className="min-w-0 flex-1 text-xs">操作原因<input required maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：本地兑换流程测试" className={`${input} mt-2 block w-full`}/></label>
      <button disabled={busy||!reason.trim()} className={paymentButton}>生成充值码</button>
    </form>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{data?.batches.map(batch=><article key={batch.id} className="rounded-xl border border-ink/10 bg-[#FFFDF8] p-4 text-xs leading-6"><p className="text-sm">{batch.credits} 花瓣 · {money(batch.priceCents)} · 共 {batch.quantity} 个</p><p className="mt-2">未兑换 {batch.available} · 已兑换 {batch.redeemed} · 停用 {batch.disabled} · 退款 {batch.refunded}</p><p className="mt-2 text-[#6E2638]">{batch.exportedAt ? "已导出 · 若已导入闲管家，请勿重复入库" : "尚未导出"}</p><p className="mt-1 break-all text-ink/40">批次 {batch.id}<br/>{batch.reason}</p><button disabled={busy||!reason.trim()||!batch.available} type="button" onClick={()=>void perform("export",{batchId:batch.id})} className={`${paymentButton} mt-3`}>{batch.exportedAt ? "重新下载未兑换码 TXT" : "导出未兑换码 TXT"}</button></article>)}</div>
    <label className="mt-6 block text-xs">查码、批次或兑换账号<input value={search} onChange={e=>setSearch(e.target.value)} className={`${input} mt-2 block w-full`} placeholder="输入码尾号、批次号或账号"/></label>
    <ul className="mt-4 divide-y divide-ink/10">{codes.map(item=><li key={item.id} className="py-4 text-xs leading-6"><p className="text-sm">尾号 {item.suffix} · {item.credits} 花瓣 · {stateLabel[item.state]||item.state}</p><p className="mt-1 break-all text-ink/45">码记录 {item.id}{item.userId && ` · 兑换账号 ${item.userId}`}</p>{item.state==="refunded" && <p>已调整 {item.refundedCredits} 花瓣{item.refundReview && " · 已使用／预留部分待核对，可在结束后再次处理"}</p>}
      <div className="mt-3 flex flex-wrap gap-3">{item.state==="active" && <button type="button" disabled={busy||!reason.trim()} className={paymentButton} onClick={()=>void perform("disable",{codeId:item.id})}>停用未兑换码</button>}{["active","redeemed","disabled","refunded"].includes(item.state) && <button type="button" disabled={busy||!reason.trim()||(item.state==="refunded"&&!item.refundReview)} className={paymentButton} onClick={()=>void perform("refund",{codeId:item.id})}>登记已核实的全额退款</button>}</div>
    </li>)}</ul>
    <p className="mt-4 text-xs leading-6 text-ink/50">退款先在闲鱼核实并处理钱款，再登记此处。未兑换码会作废；已兑换码只撤回本笔尚未使用的花瓣，已使用或解读中部分进入人工核对。此处不发起转账。</p>
    <details className="mt-5 text-xs"><summary className="min-h-10 cursor-pointer">充值码操作日志（最近 200 条）</summary><ul className="divide-y divide-ink/10">{data?.audit.map(item=><li key={item.id} className="py-3 leading-6"><p>{actionLabel[item.action]||item.action} · {item.reason}</p><p className="break-all text-ink/40">{item.target} · {new Date(item.createdAt).toLocaleString("zh-CN")}</p></li>)}</ul></details>
  </section>;
}
