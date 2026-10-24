"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { deepSpreads, getDeepSpread, type DeepSpreadId } from "@/lib/deep-spreads";
import { completePaidRequestKey, getPaidSiteSession, paidSiteEnabled, paidSiteRequest, stablePaidRequestKey } from "@/lib/paid-local/site-bridge";
import { clearDrawDraft, readDrawDraft, recoverDrawTokens, saveDrawDraft } from "@/lib/paid-local/draw-draft";
import type { PaidDrawSession } from "@/lib/paid-local/types";
import { generateDeepReading, saveReading } from "@/lib/project-store";
import { SpreadLayout } from "./SpreadLayout";
import { ShuffleRitual } from "./ShuffleRitual";
import { QuietCardBack } from "@/components/QuietCardBack";

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function CardFan({ session, busy, onPick }: { session: PaidDrawSession; busy: boolean; onPick: (token: string) => void }) {
  const fan = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; mouse: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => { if (fan.current) fan.current.scrollLeft = (fan.current.scrollWidth - fan.current.clientWidth) / 2; }, [session.id]);
  return <div>
    <div ref={fan} aria-label="可滑动的半圆牌扇" className="reading-card-scroll overflow-x-auto overscroll-x-contain rounded-xl [touch-action:pan-x] select-none"
      onPointerDown={(event) => { if (busy) return; suppressClick.current = false; drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false, mouse: event.pointerType === "mouse" }; }}
      onPointerMove={(event) => {
        const start = drag.current; if (!start) return;
        if (Math.abs(event.clientX - start.x) > 8) { start.moved = true; suppressClick.current = true; }
        if (start.moved && start.mouse) { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.scrollLeft = start.left - (event.clientX - start.x); }
      }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onClickCapture={(event) => { if (event.detail > 0 && suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <div className="relative h-[205px] w-[1000px]" role="group" aria-label="36 张洗好的背面牌">
        {session.deck.map((card, index) => {
          const angle = -72 + index * 144 / 35;
          const radians = angle * Math.PI / 180;
          return <button key={card.token} type="button" disabled={busy || card.picked} onClick={() => onPick(card.token)} aria-label={`抽取牌扇第 ${index + 1} 张${card.picked ? "，已抽出" : "背面牌"}`}
            style={{ left: 500 + Math.sin(radians) * 430 - 29, top: 24 + (1 - Math.cos(radians)) * 130, transform: `rotate(${angle * 0.55}deg)`, zIndex: index + 1 }}
            className={`absolute h-[88px] w-[58px] rounded-[4px] bg-[#FFFDF8] shadow-entry transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E2638] ${card.picked ? "pointer-events-none opacity-0" : "hover:-translate-y-3 hover:ring-1 hover:ring-[#6E2638]/35 disabled:opacity-65"}`}>
            <QuietCardBack />
          </button>;
        })}
      </div>
    </div>
    <p className="-mt-4 text-center text-xs text-ink/45">左右滑动牌扇，点选与你有感应的一张牌</p>
  </div>;
}

export function DivinationExperience({ projectId, historyCount, ruleEngineTrialAllowed, onHistory, onComplete }: { projectId: string; historyCount: number; ruleEngineTrialAllowed: boolean; onHistory: () => void; onComplete: (readingId: string, notice?: string) => void }) {
  const [question, setQuestion] = useState("");
  const [spreadId, setSpreadId] = useState<DeepSpreadId>("three_card");
  const [choices, setChoices] = useState(["", "", ""]);
  const [session, setSession] = useState<PaidDrawSession | null>(null);
  const [pending, setPending] = useState<PaidDrawSession | null>(null);
  const [pendingQueuedCount, setPendingQueuedCount] = useState(0);
  const [queued, setQueued] = useState<string[]>([]);
  const queuedRef = useRef<string[]>([]);
  const draftOwner = useRef("");
  const [phase, setPhase] = useState<"setup" | "shuffle" | "shuffling" | "picking" | "interpreting">("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [useRuleEngineTrial, setUseRuleEngineTrial] = useState(false);
  const picking = useRef(false);
  const spread = getDeepSpread(session && (phase === "picking" || phase === "interpreting") ? session.spread : spreadId);
  const selectedCount = (session?.selected.length || 0) + queued.length;
  function updateQueued(tokens:string[]) { queuedRef.current=tokens; setQueued(tokens); }
  useEffect(() => { document.querySelector('[data-divination-scroll="true"]')?.scrollTo({ top: 0 }); }, [phase]);
  useEffect(() => {
    if (!paidSiteEnabled) return;
    let active = true;
    const owner=getPaidSiteSession()?.userId||""; draftOwner.current=owner;
    void (async()=>{
      let value=await paidSiteRequest<PaidDrawSession|null>(`projects/${projectId}/draw-session`);
      const draft=readDrawDraft(owner,projectId);
      if(!value&&draft)value=await paidSiteRequest<PaidDrawSession>(`draw-sessions/${draft.sessionId}`).catch(()=>null);
      if(active&&getPaidSiteSession()?.userId===owner){setPending(value);setPendingQueuedCount(value?recoverDrawTokens(value,draft).length:0);}
    })().catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  function beginShuffle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const size = getDeepSpread(spreadId).choiceCount || 0;
    const values = choices.slice(0, size).map((value) => value.trim().toLowerCase());
    if (!question.trim()) { setError("先写下这次想问的具体问题。"); return; }
    if (size && (values.some((value) => !value) || new Set(values).size !== size)) { setError(`请填写 ${size} 个不同的具体选项。`); return; }
    setError(""); setPhase("shuffle");
  }
  async function start() {
    if (busy || !question.trim()) { if (!question.trim()) setError("先写下这次想问的具体问题。"); return; }
    setError(""); setBusy(true); setPhase("shuffling");
    const selected = getDeepSpread(spreadId);
    try {
      if (!paidSiteEnabled) {
        const reading = await saveReading({ projectId, question, spreadType: spreadId, explicitSource: ruleEngineTrialAllowed && useRuleEngineTrial ? "rule_engine" : undefined });
        setPhase("interpreting");
        await Promise.all([generateDeepReading(reading.id), pause(1400)]);
        onComplete(reading.id); return;
      }
      const values = choices.slice(0, selected.choiceCount || 0).map((value) => value.trim());
      const owner=getPaidSiteSession()?.userId||"";
      const scope = `manual:${projectId}:${spreadId}:${question.trim()}:${JSON.stringify(values)}`;
      const [value] = await Promise.all([
        paidSiteRequest<PaidDrawSession>("draw-session", { projectId, question, spread: spreadId, choices: values, requestKey: stablePaidRequestKey(scope) }), pause(1300)
      ]);
      if(!owner||getPaidSiteSession()?.userId!==owner)throw new Error("登录账号已变化，请重新进入这次抽牌。");
      completePaidRequestKey(scope);
      draftOwner.current=owner;
      updateQueued([]);setPendingQueuedCount(0);saveDrawDraft(draftOwner.current,value,[]);
      setSession(value); setPending(value); setPhase("picking");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "暂时没有洗牌成功，请重试。"); setPhase("setup"); }
    finally { setBusy(false); }
  }

  async function finish(value: PaidDrawSession) {
    if (!value.readingId) return;
    setPhase("interpreting");
    try {
      await Promise.all([paidSiteRequest("unlock", { readingId: value.readingId }), pause(1500)]);
      onComplete(value.readingId);
    } catch (cause) { onComplete(value.readingId, cause instanceof Error ? cause.message : "解读暂未完成，原牌已经保存，可以重试。"); }
  }
  async function syncPicks(value:PaidDrawSession,tokens:string[],back=false) {
    if(picking.current)return;
    picking.current = true; setBusy(true); setError("");
    try {
      if(!draftOwner.current||getPaidSiteSession()?.userId!==draftOwner.current)throw new Error("登录账号已变化，请重新进入这次抽牌。");
      const saved = tokens.length ? await paidSiteRequest<PaidDrawSession>("draw-picks", {sessionId:value.id,tokens,expectedCount:value.selected.length}) : value;
      if(getPaidSiteSession()?.userId!==draftOwner.current)throw new Error("登录账号已变化，请重新进入这次抽牌。");
      updateQueued([]);setPendingQueuedCount(0);setSession(saved);setPending(saved.state==="picking"?saved:null);
      if(saved.state==="completed"){
        clearDrawDraft(draftOwner.current,projectId,saved.id);
        await pause(600);await finish(saved);
      }else{
        saveDrawDraft(draftOwner.current,saved,[]);
        if(back)setPhase("setup");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "抽牌暂未同步，选择已保留，请恢复网络后重试。");
      if(getPaidSiteSession()?.userId===draftOwner.current){
        const recovered=await paidSiteRequest<PaidDrawSession>(`draw-sessions/${value.id}`).catch(()=>null);
        if(recovered){
          setSession(recovered);updateQueued(recoverDrawTokens(recovered,readDrawDraft(draftOwner.current,projectId)));
          if(recovered.state==="completed"){clearDrawDraft(draftOwner.current,projectId,recovered.id);await finish(recovered);}
        }
      }
    } finally { picking.current = false; setBusy(false); }
  }
  function pick(token:string) {
    if(!session||picking.current||queuedRef.current.includes(token)||session.deck.find(card=>card.token===token)?.picked)return;
    const owner=getPaidSiteSession()?.userId||"";
    if(!owner||owner!==draftOwner.current){setError("登录账号已变化，请重新进入这次抽牌。");return;}
    const tokens=[...queuedRef.current,token];
    if(session.selected.length+tokens.length>spread.positions.length)return;
    setError("");
    const persisted=saveDrawDraft(owner,session,tokens);
    updateQueued(tokens);setPendingQueuedCount(tokens.length);
    // If browser storage is unavailable, immediately sync to the server rather
    // than claim that an in-memory selection survives a refresh.
    if(!persisted||session.selected.length+tokens.length===spread.positions.length)void syncPicks(session,tokens);
  }
  async function resume(value:PaidDrawSession){
    draftOwner.current=getPaidSiteSession()?.userId||"";
    setSession(value);setQuestion(value.question);setSpreadId(value.spread);setChoices([...value.choices,"","",""] .slice(0,3));
    updateQueued(recoverDrawTokens(value,readDrawDraft(draftOwner.current,projectId)));setPhase("picking");
    if(value.state==="completed")await finish(value);
  }

  if (phase === "shuffle") return <ShuffleRitual question={question} spreadName={spread.name} onBack={() => setPhase("setup")} onReady={() => void start()} />;

  if (phase === "shuffling" || phase === "interpreting") return <section className="flex min-h-[55dvh] flex-col items-center justify-center py-10 text-center" aria-live="polite">
    <div className="relative h-40 w-40" aria-hidden="true">{[-18,0,18].map((angle) => <div key={angle} style={{ transform: `translateX(${angle}px) rotate(${angle}deg)` }} className="absolute left-10 top-5 h-28 w-20 animate-pulse rounded-md bg-[#FFFDF8] shadow-paper motion-reduce:animate-none"><QuietCardBack /></div>)}</div>
    <p className="font-serif text-3xl">{phase === "shuffling" ? "切牌中" : "正在解读"}</p><p className="mt-4 max-w-xs text-sm leading-7 text-ink/50">{phase === "shuffling" ? "轻轻切好这副牌，准备展开牌扇。" : "你的牌已全部归位，正在结合牌阵与问题梳理解读。"}</p>
  </section>;

  if (phase === "picking" && session) return <section className="py-5 sm:py-8">
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={busy} onClick={() => void syncPicks(session,queuedRef.current,true)} className="inline-flex min-h-10 items-center gap-2 text-xs text-ink/50"><ArrowLeft size={14} />暂存并返回</button><span className="text-xs text-[#6E2638]" aria-live="polite">已抽 {selectedCount} / {spread.positions.length} 张</span></div>
    <h1 className="mt-3 font-serif text-2xl">{spread.name}</h1><p className="mt-2 break-words text-sm leading-6 text-ink/60">{session.question}</p>
    <div className="mt-6 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div><SpreadLayout spreadId={spread.id} cards={session.selected} pendingCount={queued.length} choices={session.choices} compact /><p className="mt-3 text-center text-xs leading-6 text-ink/45" aria-live="polite">{busy ? "牌正在归位…" : `下一张 → ${spread.positions[selectedCount]?.label || "牌面已完整"}`}</p></div>
      <div className="min-w-0"><CardFan session={{...session,deck:session.deck.map(card=>({...card,picked:card.picked||queued.includes(card.token)}))}} busy={busy} onPick={pick} />
        {!selectedCount && <button type="button" disabled={busy} onClick={() => setPhase("shuffle")} className="mx-auto mt-5 flex min-h-10 items-center gap-2 text-xs text-[#6E2638]"><RotateCcw size={14} />再洗一次</button>}
        {selectedCount===spread.positions.length&&!busy&&<button type="button" onClick={()=>void syncPicks(session,queuedRef.current)} className="mx-auto mt-5 flex min-h-11 items-center rounded-full bg-[#6E2638] px-6 text-sm text-[#FFF9F2]">同步并开始解读</button>}
        <p className="mt-4 text-center text-[11px] leading-5 text-ink/40">选择会在本机暂存，选满后统一翻牌并解读，使用 1 花瓣；解读失败不扣花瓣。</p>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-[#6E2638]/15 p-3 text-sm leading-6 text-[#8E4D4A]">{error}</p>}
  </section>;

  return <form onSubmit={beginShuffle} className="py-6 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.2em] text-clay/65">A question, a little clarity</p>{historyCount > 0 && <button type="button" onClick={onHistory} className="min-h-10 text-xs text-[#6E2638]">查看历史解读（{historyCount}）<ArrowRight size={13} className="ml-1 inline" /></button>}</div>
    <h1 className="mt-4 font-serif text-3xl sm:text-4xl">这一次，你想问什么？</h1><p className="mt-3 text-sm leading-7 text-ink/50">先放下一个具体的问题，再选择适合它的牌阵。</p>
    {pending && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6E2638]/15 bg-[#FFFDF8] p-4"><div className="min-w-0"><p className="text-sm">有一次尚未完成的抽牌 · {pending.selected.length+pendingQueuedCount}/{getDeepSpread(pending.spread).positions.length} 张</p><p className="mt-1 max-w-xs truncate text-xs text-ink/45">{pending.question}</p></div><button type="button" onClick={() => void resume(pending)} className="min-h-10 text-sm text-[#6E2638]">继续抽牌</button></div>}
    <label htmlFor="deep-question" className="mt-7 block text-sm text-ink/65">你的问题</label><textarea id="deep-question" value={question} onChange={(event) => { setQuestion(event.target.value); setError(""); }} maxLength={300} required rows={3} placeholder="例如：未来一个月，这段关系会怎样发展？" className="mt-3 w-full resize-y rounded-xl border border-ink/15 bg-[#FFFDF8] p-4 text-base leading-7 outline-none focus:border-[#6E2638]/45" />
    <p className="mt-1 text-right text-xs text-ink/35">{question.length}/300</p>
    <fieldset className="mt-5"><legend className="text-sm text-ink/65">选择牌阵</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{deepSpreads.filter((item) => paidSiteEnabled || ["three_card","five_card_linear"].includes(item.id)).map((item) => <label key={item.id} className={`relative cursor-pointer rounded-xl border p-4 ${item.id === spreadId ? "border-[#6E2638]/65 bg-[#6E2638]/[0.035]" : "border-ink/10 bg-[#FFFDF8]/75"}`}>
      <input type="radio" name="deep-spread" value={item.id} checked={item.id === spreadId} onChange={() => { setSpreadId(item.id); setError(""); }} className="sr-only peer" /><span className="absolute inset-0 rounded-xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6E2638]" />
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl">{item.name}</h2><p className="mt-1 text-xs text-clay/65">{item.positions.length} 张 · {item.subtitle.replace(/^.+? · /, "")}</p></div>{item.id === spreadId && <Check size={16} className="shrink-0 text-[#6E2638]" />}</div>
      <div className="mt-3 flex items-center gap-4"><div className="w-20 shrink-0"><SpreadLayout spreadId={item.id} miniature /></div><p className="text-xs leading-6 text-ink/55">{item.suitable}</p></div>
    </label>)}</div></fieldset>
    <section className="mt-4 rounded-xl border border-ink/10 bg-[#FFFDF8]/70 p-4"><p className="text-sm text-[#6E2638]">{getDeepSpread(spreadId).name} · 牌位与阅读方式</p><p className="mt-2 text-xs leading-6 text-ink/55">{getDeepSpread(spreadId).rules}</p><p className="mt-2 text-xs leading-6 text-ink/40">提问参考：{getDeepSpread(spreadId).example}</p></section>
    {getDeepSpread(spreadId).choiceCount && <fieldset className="mt-5"><legend className="text-sm text-ink/65">写清楚要比较的选项（目标与时间范围保持一致）</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{Array.from({ length: getDeepSpread(spreadId).choiceCount! }, (_, index) => <label key={index} className="text-xs text-ink/55">选项 {String.fromCharCode(65 + index)}<input required value={choices[index]} maxLength={80} onChange={(event) => setChoices((values) => values.map((value, at) => at === index ? event.target.value : value))} placeholder={index === 0 ? "例如：留在目前的工作" : index === 1 ? "例如：接受新公司的邀请" : "例如：先学习再求职"} className="mt-2 h-12 w-full rounded-lg border border-ink/15 bg-[#FFFDF8] px-3 text-base outline-none focus:border-[#6E2638]/45" /></label>)}</div></fieldset>}
    {ruleEngineTrialAllowed && !paidSiteEnabled && <label className="mt-5 flex items-center gap-2 text-xs text-ink/50"><input type="checkbox" checked={useRuleEngineTrial} onChange={(event) => setUseRuleEngineTrial(event.target.checked)} />试用 V2 规则解读</label>}
    {error && <p role="alert" className="mt-4 text-sm text-[#8E4D4A]">{error}</p>}
    <div className="mt-6 flex flex-wrap items-center gap-4"><button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#6E2638] px-8 text-sm text-[#FFF9F2] disabled:opacity-50"><Sparkles size={16} />洗牌，开始这次占卜</button><p className="text-xs leading-6 text-ink/45">{paidSiteEnabled ? "自己选满牌位后使用 1 花瓣，含 2 次追问。" : "选择问题与牌阵后开始解读。"}</p></div>
  </form>;
}
