"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flower2, RotateCcw, Sparkles } from "lucide-react";
import { deepSpreads, getDeepSpread, type DeepSpreadId } from "@/lib/deep-spreads";
import { completePaidRequestKey, getPaidSiteSession, PaidSiteError, paidRevealConfirmationEnabled, paidSiteEnabled, paidSiteRequest, stablePaidRequestKey } from "@/lib/paid-local/site-bridge";
import { clearDrawDraft, readDrawDraft, recoverDrawTokens, saveDrawDraft } from "@/lib/paid-local/draw-draft";
import { guestDeckSize, saveGuestDraw } from "@/lib/paid-local/guest-draw";
import { isReadingSafetyCode, type ReadingSafetyCode } from "@/lib/paid-local/reading-safety";
import type { PaidDrawSession } from "@/lib/paid-local/types";
import { generateDeepReading, saveReading } from "@/lib/project-store";
import { SpreadLayout } from "./SpreadLayout";
import { SpreadPicker } from "./SpreadPicker";
import { ShuffleRitual } from "./ShuffleRitual";
import { ReadingMemoryPrompt } from "./ReadingMemoryPrompt";
import { RelationshipSetup } from "./RelationshipSetup";
import type { RelationshipContext } from "@/lib/paid-local/relationship-context";
import { ReadingSafetyDialog } from "./ReadingSafetyDialog";
import { QuietCardBack } from "@/components/QuietCardBack";
import { ServiceNotice } from "@/components/ServiceNotice";

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const savedPickCount = (session: PaidDrawSession) => session.selectedTokens?.length ?? session.selected.length;

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
    <p className="-mt-4 text-center text-xs text-ink/45">左右滑动牌扇，点选你想抽取的一张牌</p>
  </div>;
}

export function DivinationExperience({ projectId = "", historyCount = 0, ruleEngineTrialAllowed = false, onHistory, onComplete, guest = false, memoryPrompt }: {
  projectId?: string;
  historyCount?: number;
  ruleEngineTrialAllowed?: boolean;
  onHistory?: () => void;
  onComplete?: (readingId: string, notice?: string) => void;
  guest?: boolean;
  memoryPrompt?: { hasMemory: boolean; maxLength: number; onSave: (memory: string) => Promise<void> };
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [spreadId, setSpreadId] = useState<DeepSpreadId>("three_card");
  const [choices, setChoices] = useState(["", "", ""]);
  const [relationship, setRelationship] = useState<RelationshipContext | undefined>();
  const [session, setSession] = useState<PaidDrawSession | null>(null);
  const [pending, setPending] = useState<PaidDrawSession | null>(null);
  const [pendingQueuedCount, setPendingQueuedCount] = useState(0);
  const [queued, setQueued] = useState<string[]>([]);
  const queuedRef = useRef<string[]>([]);
  const draftOwner = useRef("");
  const [phase, setPhase] = useState<"setup" | "relationship" | "shuffle" | "shuffling" | "picking" | "interpreting">("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [safetyCode, setSafetyCode] = useState<ReadingSafetyCode | null>(null);
  const [showMemoryPrompt, setShowMemoryPrompt] = useState(false);
  const [useRuleEngineTrial, setUseRuleEngineTrial] = useState(false);
  const picking = useRef(false);
  const checking = useRef(false);
  const guestApproval = useRef("");
  const startedDraw = useRef(false);
  const spread = getDeepSpread(session && (phase === "picking" || phase === "interpreting") ? session.spread : spreadId);
  const selectedCount = (session ? savedPickCount(session) : 0) + queued.length;
  const visibleCards = paidRevealConfirmationEnabled ? [] : session?.selected ?? [];
  function updateQueued(tokens:string[]) { queuedRef.current=tokens; setQueued(tokens); }
  useEffect(() => { document.querySelector('[data-divination-scroll="true"]')?.scrollTo({ top: 0 }); }, [phase]);
  useEffect(() => {
    if (!paidSiteEnabled || guest) return;
    let active = true;
    const owner=getPaidSiteSession()?.userId||""; draftOwner.current=owner;
    void (async()=>{
      let value=await paidSiteRequest<PaidDrawSession|null>(`projects/${projectId}/draw-session`);
      const draft=readDrawDraft(owner,projectId);
      if(!value&&draft)value=await paidSiteRequest<PaidDrawSession>(`draw-sessions/${draft.sessionId}`).catch(()=>null);
      if(active&&!startedDraw.current&&getPaidSiteSession()?.userId===owner){setPending(value);setPendingQueuedCount(value?recoverDrawTokens(value,draft).length:0);}
    })().catch(() => undefined);
    return () => { active = false; };
  }, [guest, projectId]);

  function beginShuffle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const size = getDeepSpread(spreadId).choiceCount || 0;
    const values = choices.slice(0, size).map((value) => value.trim().toLowerCase());
    if (!question.trim()) { setError("先写下这次想问的具体问题。"); return; }
    if (size && (values.some((value) => !value) || new Set(values).size !== size)) { setError(`请填写 ${size} 个不同的具体选项。`); return; }
    setError("");
    if (spreadId === "h_seven") { setPhase("relationship"); return; }
    prepareShuffle();
  }

  function prepareShuffle(selection?: RelationshipContext) {
    if (memoryPrompt && !memoryPrompt.hasMemory) {
      setShowMemoryPrompt(true);
      return;
    }
    void continueToShuffle(selection);
  }

  async function continueToShuffle(selection = relationship) {
    if (checking.current) return;
    setShowMemoryPrompt(false);
    if (!paidSiteEnabled) { setPhase("shuffle"); return; }
    checking.current = true;
    setBusy(true);
    setError("");
    try {
      const values = choices.slice(0, getDeepSpread(spreadId).choiceCount || 0).map(value => value.trim());
      const fields = { question: question.trim(), spread: spreadId, choices: values, ...(spreadId === "h_seven" && selection ? { relationship: selection } : {}) };
      if (guest) {
        const { approval } = await paidSiteRequest<{ approval: string }>("guest-review", fields);
        guestApproval.current = approval;
      } else {
        const owner = getPaidSiteSession()?.userId || "";
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fields))));
        const scope = `manual:${projectId}:${Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")}`;
        let value;
        try {
          value = await paidSiteRequest<PaidDrawSession>("draw-session", { ...fields, projectId, requestKey: stablePaidRequestKey(scope) });
        } catch (cause) {
          if (cause instanceof PaidSiteError && isReadingSafetyCode(cause.code)) completePaidRequestKey(scope);
          throw cause;
        }
        if (!owner || getPaidSiteSession()?.userId !== owner) throw new Error("登录账号已变化，请重新进入这次抽牌。");
        completePaidRequestKey(scope);
        startedDraw.current = true;
        draftOwner.current = owner;
        updateQueued([]);
        setPendingQueuedCount(0);
        saveDrawDraft(owner, value, []);
        setSession(value);
        setPending(value);
      }
      setPhase("shuffle");
    } catch (cause) {
      if (cause instanceof PaidSiteError && isReadingSafetyCode(cause.code)) {
        setQuestion("");
        setChoices(["", "", ""]);
        guestApproval.current = "";
        setSafetyCode(cause.code);
        setPhase("setup");
      } else setError(cause instanceof Error ? cause.message : "暂时无法完成问题审查，请稍后重试。");
    } finally {
      checking.current = false;
      setBusy(false);
    }
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
        onComplete?.(reading.id); return;
      }
      const values = choices.slice(0, selected.choiceCount || 0).map((value) => value.trim());
      if (guest) {
        await pause(900);
        setSession({
          id: crypto.randomUUID(), projectId: "", question: question.trim(), spread: spreadId, choices: values,
          ...(spreadId === "h_seven" && relationship ? { relationship } : {}),
          deck: Array.from({ length: guestDeckSize }, (_, index) => ({ token: String(index), picked: false })),
          selected: [], state: "picking", readingId: null
        });
        updateQueued([]);
        setPhase("picking");
        return;
      }
      await pause(1300);
      if (!session || getPaidSiteSession()?.userId !== draftOwner.current) throw new Error("登录账号已变化，请重新进入这次抽牌。");
      setPhase("picking");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "暂时没有洗牌成功，请重试。"); setPhase("setup"); }
    finally { setBusy(false); }
  }

  async function finish(value: PaidDrawSession) {
    if (!value.readingId) return;
    if (paidRevealConfirmationEnabled) {
      onComplete?.(value.readingId);
      return;
    }
    setPhase("interpreting");
    try {
      await Promise.all([paidSiteRequest("unlock", { readingId: value.readingId }), pause(1500)]);
      onComplete?.(value.readingId);
    } catch (cause) {
      if (cause instanceof PaidSiteError && isReadingSafetyCode(cause.code)) {
        setSafetyCode(cause.code);
        setQuestion("");
        setChoices(["", "", ""]);
        setPending(null);
        setSession(null);
        setPhase("setup");
      } else onComplete?.(value.readingId, cause instanceof Error ? cause.message : "解读暂未完成，原牌已经保存，可以重试。");
    }
  }
  async function syncPicks(value:PaidDrawSession,tokens:string[],back=false) {
    if(picking.current)return;
    picking.current = true; setBusy(true); setError("");
    try {
      if(!draftOwner.current||getPaidSiteSession()?.userId!==draftOwner.current)throw new Error("登录账号已变化，请重新进入这次抽牌。");
      const saved = tokens.length ? await paidSiteRequest<PaidDrawSession>("draw-picks", {sessionId:value.id,tokens,expectedCount:savedPickCount(value)}) : value;
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
  function queuePicks(value: PaidDrawSession, tokens: string[]) {
    const total = savedPickCount(value) + tokens.length;
    if (total > spread.positions.length) return;
    if (guest) {
      setError("");
      updateQueued(tokens);
      return;
    }
    const owner = getPaidSiteSession()?.userId || "";
    if (!owner || owner !== draftOwner.current) {
      setError("登录账号已变化，请重新进入这次抽牌。");
      return;
    }
    setError("");
    const persisted = saveDrawDraft(owner, value, tokens);
    updateQueued(tokens);
    setPendingQueuedCount(tokens.length);
    // If browser storage is unavailable, immediately sync to the server rather
    // than claim that an in-memory selection survives a refresh.
    if (!persisted || total === spread.positions.length) void syncPicks(value, tokens);
  }
  function pick(token: string) {
    if (busy || picking.current || session?.state !== "picking" || queuedRef.current.includes(token)) return;
    if (!session.deck.some((card) => card.token === token && !card.picked)) return;
    queuePicks(session, [...queuedRef.current, token]);
  }
  function autoPickRemaining() {
    if (busy || picking.current || session?.state !== "picking") return;
    const tokens = [...queuedRef.current];
    const remaining = spread.positions.length - savedPickCount(session) - tokens.length;
    if (remaining <= 0) return;
    const pool = session.deck.filter((card) => !card.picked && !tokens.includes(card.token));
    if (pool.length < remaining) return;

    const sample = new Uint32Array(1);
    const sampleRange = 2 ** 32;
    for (let index = 0; index < remaining; index++) {
      // Reject the uneven tail so each card in the remaining pool has equal odds.
      const limit = sampleRange - (sampleRange % pool.length);
      do {
        crypto.getRandomValues(sample);
      } while (sample[0] >= limit);
      const [card] = pool.splice(sample[0] % pool.length, 1);
      tokens.push(card.token);
    }
    queuePicks(session, tokens);
  }
  function continueToLogin() {
    if (!session || queuedRef.current.length !== spread.positions.length || picking.current) return;
    try {
      saveGuestDraw({ id: session.id, question: session.question, spread: session.spread, choices: session.choices, relationship: session.relationship, slots: queuedRef.current.map(Number), approval: guestApproval.current || undefined });
      picking.current = true;
      setBusy(true);
      router.push(`/login?returnTo=${encodeURIComponent(`/deep?resumeDraw=${session.id}`)}`);
    } catch {
      setError("浏览器无法暂存选牌。请允许此网站保存数据，然后再试。");
    }
  }
  async function resume(value:PaidDrawSession){
    if (checking.current) return;
    draftOwner.current=getPaidSiteSession()?.userId||"";
    setRelationship(value.relationship);setSession(value);setQuestion(value.question);setSpreadId(value.spread);setChoices([...value.choices,"","",""] .slice(0,3));
    updateQueued(recoverDrawTokens(value,readDrawDraft(draftOwner.current,projectId)));setPhase("picking");
    if(value.state==="completed")await finish(value);
  }

  if (phase === "relationship") return <>
    <RelationshipSetup question={question.trim()} initial={relationship} busy={busy} error={error} onBack={() => { setError(""); setPhase("setup"); }} onContinue={value => { setRelationship(value); prepareShuffle(value); }} />
    {showMemoryPrompt && memoryPrompt && (
      <ReadingMemoryPrompt
        maxLength={memoryPrompt.maxLength}
        onClose={() => setShowMemoryPrompt(false)}
        onSkip={continueToShuffle}
        onSave={async (memory) => {
          await memoryPrompt.onSave(memory);
          continueToShuffle();
        }}
      />
    )}
  </>;

  if (phase === "shuffle") return <ShuffleRitual question={question} spreadName={spread.name} onBack={() => setPhase("setup")} onReady={() => void start()} />;

  if (phase === "shuffling" || phase === "interpreting") return <section className="flex min-h-[55dvh] flex-col items-center justify-center py-10 text-center" aria-live="polite">
    <div className="relative h-40 w-40" aria-hidden="true">{[-18,0,18].map((angle) => <div key={angle} style={{ transform: `translateX(${angle}px) rotate(${angle}deg)` }} className="absolute left-10 top-5 h-28 w-20 animate-pulse rounded-md bg-[#FFFDF8] shadow-paper motion-reduce:animate-none"><QuietCardBack /></div>)}</div>
    <p className="font-serif text-3xl">{phase === "shuffling" ? "切牌中" : "正在解读"}</p><p className="mt-4 max-w-xs text-sm leading-7 text-ink/50">{phase === "shuffling" ? "轻轻切好这副牌，准备展开牌扇。" : "你的牌已全部归位，正在结合牌阵与问题梳理解读。"}</p>
  </section>;

  if (phase === "picking" && session) return <section className="deep-stage">
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={busy} onClick={() => {
      if (guest) { setSession(null); updateQueued([]); setPhase("setup"); }
      else void syncPicks(session,queuedRef.current,true);
    }} className="inline-flex min-h-10 items-center gap-2 text-xs text-ink/50"><ArrowLeft size={14} />{guest ? "返回问题" : "暂存并返回"}</button><span className="text-xs text-[#6E2638]" aria-live="polite">已抽 {selectedCount} / {spread.positions.length} 张</span></div>
    <p className="deep-eyebrow mt-6">CHOOSE YOUR CARDS</p><h1 className="deep-title mt-3">{session.question}</h1><p className="mt-3 text-sm text-ink/55">{spread.name}</p>
    <div className="mt-9 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div><SpreadLayout spreadId={spread.id} cards={visibleCards} pendingCount={selectedCount - visibleCards.length} choices={session.choices} compact /><p className="mt-3 text-center text-xs leading-6 text-ink/45" aria-live="polite">{busy ? "牌正在归位…" : `下一张 → ${spread.positions[selectedCount]?.label || "牌面已完整"}`}</p></div>
      <div className="min-w-0"><CardFan session={{...session,deck:session.deck.map(card=>({...card,picked:card.picked||queued.includes(card.token)}))}} busy={busy} onPick={pick} />
        {selectedCount < spread.positions.length && <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <button type="button" disabled={busy} onClick={autoPickRemaining} className="deep-secondary"><Sparkles size={15} aria-hidden="true" />自动选牌</button>
          {!selectedCount && <button type="button" disabled={busy} onClick={() => setPhase("shuffle")} className="inline-flex min-h-11 items-center gap-2 text-xs text-[#6E2638]"><RotateCcw size={14} />再洗一次</button>}
        </div>}
        {selectedCount === spread.positions.length && (guest || !busy) && <button type="button" disabled={busy} onClick={guest ? continueToLogin : () => void syncPicks(session, queuedRef.current)} className="deep-primary mx-auto mt-5 flex">{guest ? "登录后继续解读" : paidRevealConfirmationEnabled ? "保存选好的牌" : "同步并开始解读"}</button>}
        <p className="mt-5 text-center text-xs leading-6 text-ink/50">{guest ? "选牌免费，登录后保留本次选择。" : paidRevealConfirmationEnabled ? "选满后使用 1 花瓣翻牌，含完整解读与 2 次追问。" : "选牌会暂存，选满后统一解读；失败不扣花瓣。"}</p>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-[#6E2638]/15 p-3 text-sm leading-6 text-[#8E4D4A]">{error}</p>}
  </section>;

  return <>{safetyCode && <ReadingSafetyDialog code={safetyCode} onClose={() => setSafetyCode(null)} />}<form onSubmit={beginShuffle} className="deep-stage">
    <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="deep-eyebrow inline-flex items-center gap-2"><Flower2 size={15} strokeWidth={1.2} aria-hidden="true" />A LITTLE CLARITY</p>{historyCount > 0 && <button type="button" onClick={onHistory} className="min-h-10 text-xs text-[#6E2638]">查看历史解读（{historyCount}）<ArrowRight size={13} className="ml-1 inline" /></button>}</div>
    <h1 className="deep-title mt-6">这一次，你想问什么？</h1><p className="mt-3 text-[15px] leading-7 text-ink/55">一个问题，一点新的视角。</p>
    {pending && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6E2638]/15 bg-[#FFFDF8] p-4"><div className="min-w-0"><p className="text-sm">有一次尚未完成的抽牌 · {savedPickCount(pending)+pendingQueuedCount}/{getDeepSpread(pending.spread).positions.length} 张</p><p className="mt-1 max-w-xs truncate text-xs text-ink/45">{pending.question}</p></div><button type="button" onClick={() => void resume(pending)} className="min-h-10 text-sm text-[#6E2638]">继续抽牌</button></div>}
    <div className="deep-surface group mt-8 p-5 transition-colors focus-within:border-[#6E2638]/30 sm:p-6">
      <label htmlFor="deep-question" className="deep-eyebrow">YOUR QUESTION</label>
      <textarea id="deep-question" aria-label="你的问题" value={question} onChange={(event) => { setQuestion(event.target.value); setError(""); }} maxLength={300} required rows={3} placeholder="What would you like to explore?" className="mt-4 w-full resize-y border-0 bg-transparent p-0 text-[17px] leading-8 text-ink/90 outline-none placeholder:text-ink/30 sm:text-lg" />
      <p className="mt-1 text-right text-[11px] tracking-wide text-ink/35 opacity-0 transition-opacity group-focus-within:opacity-100">{question.length}/300</p>
    </div>
    <SpreadPicker spreads={deepSpreads.filter(item => paidSiteEnabled || ["three_card", "five_card_linear"].includes(item.id))} selected={getDeepSpread(spreadId)} onSelect={id => { setSpreadId(id); setError(""); }} />
    {getDeepSpread(spreadId).choiceCount && <fieldset className="mt-5"><legend className="text-sm text-ink/65">写下要比较的选项</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{Array.from({ length: getDeepSpread(spreadId).choiceCount! }, (_, index) => <label key={index} className="text-xs text-ink/55">选项 {String.fromCharCode(65 + index)}<input required value={choices[index]} maxLength={80} onChange={(event) => setChoices((values) => values.map((value, at) => at === index ? event.target.value : value))} placeholder={index === 0 ? "Stay with my current role" : index === 1 ? "Explore the new opportunity" : "Take time to learn first"} className="mt-2 h-12 w-full rounded-lg border border-ink/15 bg-[#FFFDF8] px-3 text-base outline-none focus:border-[#6E2638]/45" /></label>)}</div></fieldset>}
    {ruleEngineTrialAllowed && !paidSiteEnabled && <label className="mt-5 flex items-center gap-2 text-xs text-ink/50"><input type="checkbox" checked={useRuleEngineTrial} onChange={(event) => setUseRuleEngineTrial(event.target.checked)} />试用 V2 规则解读</label>}
    {error && <p role="alert" className="mt-4 text-sm text-[#8E4D4A]">{error}</p>}
    <ServiceNotice kind="deep" compact />
    <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"><button type="submit" disabled={busy} className="deep-primary w-full sm:w-auto"><Sparkles size={16} />{busy ? "正在审查…" : "开始这次解读"}</button><p className="text-xs leading-6 text-ink/45" aria-live="polite">{busy ? "审查通过后即可洗牌。" : paidRevealConfirmationEnabled ? "选牌免费 · 1 花瓣解锁 · 含 2 次追问" : paidSiteEnabled ? "1 花瓣 · 完整解读与 2 次追问" : "选择问题与牌阵后开始解读。"}</p></div>
    </fieldset>
  </form>
    {showMemoryPrompt && memoryPrompt && (
      <ReadingMemoryPrompt
        maxLength={memoryPrompt.maxLength}
        onClose={() => setShowMemoryPrompt(false)}
        onSkip={continueToShuffle}
        onSave={async (memory) => {
          await memoryPrompt.onSave(memory);
          continueToShuffle();
        }}
      />
    )}
  </>;
}
