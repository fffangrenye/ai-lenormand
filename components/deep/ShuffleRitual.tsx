"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hand, RotateCcw, Sparkles } from "lucide-react";
import { QuietCardBack } from "@/components/QuietCardBack";
import { containCard, createShuffleTable, pushShuffleCards, settleShuffleCards, type ShuffleTable } from "@/lib/deep-shuffle-physics";
import { autoShufflePose } from "@/lib/auto-shuffle";

const CARD_IDS = Array.from({ length: 36 }, (_, i) => i);
type Palm = { id: number; x: number; y: number };
type TableControls = { push: (x: number, y: number, nextX: number, nextY: number) => void; keyboard: (key: string) => void };

export function ShuffleRitual({ question, spreadName, onBack, onReady }: { question: string; spreadName: string; onBack: () => void; onReady: () => void }) {
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [progress, setProgress] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const palm = useRef<HTMLDivElement>(null);
  const cardNodes = useRef<(HTMLDivElement | null)[]>([]);
  const table = useRef<ShuffleTable | null>(null);
  const pointer = useRef<Palm | null>(null);
  const controls = useRef<TableControls | null>(null);
  const distance = useRef(0);
  const ready = progress >= 100;

  useEffect(() => {
    const surface = board.current;
    if (!surface) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0; let last = 0; let autoElapsed = 0; let keyboardStep = 0;
    let origins: { x: number; y: number; angle: number }[] = [];
    let disposed = false;

    function paint() {
      const value = table.current; if (!value) return;
      value.cards.forEach((card, i) => {
        const node = cardNodes.current[i]; if (!node) return;
        node.style.width = `${value.cardWidth}px`; node.style.height = `${value.cardHeight}px`;
        node.style.transform = `translate3d(${card.x - value.cardWidth / 2}px,${card.y - value.cardHeight / 2}px,0) rotate(${card.angle}rad)`;
        node.style.zIndex = String(card.layer);
        node.style.boxShadow = mode === "auto" ? (i === 17 || i >= 34 ? "0 2px 5px rgba(68,55,40,0.12)" : "none") : "";
      });
    }
    function resize() {
      const { width, height } = surface!.getBoundingClientRect();
      if (!width || !height) return;
      const previous = table.current; const next = createShuffleTable(width, height);
      if (previous) {
        next.layer = previous.layer;
        next.cards = previous.cards.map((card) => ({ ...card, x: card.x / previous.width * width, y: card.y / previous.height * height, vx: 0, vy: 0, spin: 0 }));
        next.cards.forEach((card) => containCard(next, card));
      }
      table.current = next; pointer.current = null; if (palm.current) palm.current.style.opacity = "0";
      origins = next.cards.map(({ x, y, angle }) => ({ x, y, angle }));
      paint();
    }
    function animate(time: number) {
      frame = 0; if (disposed || !table.current) return;
      const delta = last ? Math.min(40, time - last) : 16.67; last = time;
      const value = table.current;
      if (mode === "auto" && autoElapsed < 5200) {
        autoElapsed = Math.min(5200, autoElapsed + delta);
        value.cards.forEach((card, index) => {
          Object.assign(card, autoShufflePose(value, index, reduce.matches ? 1 : autoElapsed / 5200, origins[index]), { vx: 0, vy: 0, spin: 0, layer: index });
          containCard(value, card);
        });
        setProgress(Math.floor(autoElapsed / 52));
      }
      const moving = mode === "manual" && settleShuffleCards(value, delta / 16.67, reduce.matches);
      paint();
      if (moving || (mode === "auto" && autoElapsed < 5200)) frame = requestAnimationFrame(animate);
      else last = 0;
    }
    function wake() { if (!frame && !disposed) frame = requestAnimationFrame(animate); }
    function push(x: number, y: number, nextX: number, nextY: number) {
      const value = table.current; if (!value) return;
      distance.current += pushShuffleCards(value, x, y, nextX, nextY);
      const next = Math.min(100, Math.floor(distance.current / Math.min(value.width * 3, 1500) * 100));
      setProgress((current) => Math.max(current, next));
      if (reduce.matches) { settleShuffleCards(value, 1, true); paint(); } else wake();
    }
    controls.current = {
      push,
      keyboard(key) {
        const value = table.current; if (!value) return;
        const target = value.cards[(keyboardStep * 7) % value.cards.length];
        const angle = keyboardStep++ * 1.7;
        const x = target.x; const y = target.y;
        const dx = key === "ArrowLeft" ? -100 : key === "ArrowRight" ? 100 : Math.cos(angle + 1.5) * 110;
        const dy = key === "ArrowUp" ? -100 : key === "ArrowDown" ? 100 : Math.sin(angle + 1.5) * 90;
        push(x, y, Math.max(9, Math.min(value.width - 9, x + dx)), Math.max(9, Math.min(value.height - 9, y + dy)));
      }
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(surface);
    if (mode === "auto") wake();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.current = null; pointer.current = null; };
  }, [mode]);

  function changeMode(next: "manual" | "auto") {
    pointer.current = null; distance.current = 0; setProgress(0);
    if (palm.current) palm.current.style.opacity = "0";
    setMode(next);
  }
  function releasePointer() {
    pointer.current = null;
    if (palm.current) palm.current.style.opacity = "0";
  }
  return <section className="mx-auto max-w-[760px] py-5 sm:py-8">
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 text-xs text-ink/50"><ArrowLeft size={14} />返回问题</button>
    <h1 className="mt-4 whitespace-pre-wrap break-words font-serif text-2xl leading-relaxed sm:text-3xl">{question}</h1>
    <p className="mt-2 text-sm text-clay/65">{spreadName} · 洗牌</p>
    <p id="shuffle-help" className="mt-6 text-center text-sm leading-7 text-ink/55">{mode === "auto" ? ready ? "自动洗牌已完成，可以开始选牌。" : "牌在桌面上缓缓混合，把注意力放回你的问题。" : ready ? "牌已经充分混合，也可以继续搓动，准备好再选牌。" : "按住牌堆画圈、推散，让牌在掌心下自由混合。"}</p>
    <div className="mx-auto mt-5 w-full max-w-[640px] rounded-[24px] border border-[#B5AA96]/30 bg-[#EAE5D9]/45 p-2 shadow-[inset_0_1px_5px_rgba(96,79,55,0.035)] sm:p-3">
      <div ref={board} role="button" tabIndex={mode === "manual" ? 0 : -1} aria-label="手动搓牌区域" aria-disabled={mode === "auto"} aria-describedby="shuffle-help"
        onPointerDown={(event) => {
          if (mode !== "manual" || (event.pointerType === "mouse" && event.button !== 0) || pointer.current) return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
          pointer.current = { id: event.pointerId, x, y };
          if (palm.current) { palm.current.style.opacity = "1"; palm.current.style.transform = `translate(${x - 46}px,${y - 46}px)`; }
        }}
        onPointerMove={(event) => {
          const previous = pointer.current; if (!previous || previous.id !== event.pointerId || mode !== "manual") return;
          const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left)); const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
          controls.current?.push(previous.x, previous.y, x, y);
          pointer.current = { id: event.pointerId, x, y };
          if (palm.current) palm.current.style.transform = `translate(${x - 46}px,${y - 46}px)`;
        }}
        onPointerUp={(event) => { if (pointer.current?.id !== event.pointerId) return; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); releasePointer(); }}
        onPointerCancel={(event) => { if (pointer.current?.id === event.pointerId) releasePointer(); }} onLostPointerCapture={releasePointer} onBlur={releasePointer}
        onKeyDown={(event) => {
          if (mode !== "manual" || ![" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault(); controls.current?.keyboard(event.key);
        }}
        className={`relative h-[280px] touch-none select-none overflow-hidden rounded-[18px] bg-[#F3F0E7] outline-none [background-image:radial-gradient(ellipse_at_50%_40%,rgba(255,253,248,0.8),transparent_75%)] focus-visible:ring-2 focus-visible:ring-[#6E2638]/35 sm:h-[300px] ${mode === "manual" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[12px] border border-[#B5AA96]/20" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CARD_IDS.map((index) => <div key={index} ref={(node) => { cardNodes.current[index] = node; }} data-shuffle-card={index} className="absolute left-0 top-0 h-[96px] w-16 rounded-[4px] shadow-[0_1px_2px_rgba(68,55,40,0.19),0_3px_7px_rgba(68,55,40,0.07)]"><QuietCardBack /></div>)}
          <div ref={palm} className="absolute left-0 top-0 z-[100000] h-[92px] w-[92px] rounded-full border border-white/60 bg-white/[0.06] opacity-0 shadow-[0_0_24px_rgba(255,253,248,0.3)]" />
        </div>
      </div>
    </div>
    <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-ink/40"><Hand size={13} className="shrink-0" />{mode === "manual" ? "36 张牌 · 手指或鼠标搓动 · 也可用方向键" : ready ? "36 张牌已洗好，可以继续选牌" : "正在为你自动混合 36 张牌"}</p>
    <div role="progressbar" aria-label="洗牌进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mx-auto mt-5 h-1 max-w-xs overflow-hidden rounded-full bg-[#6E2638]/10"><div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[#6E2638]/50 transition-[width] motion-reduce:transition-none" /></div>
    <p role="status" className="mt-2 text-center text-xs text-ink/45">{ready ? "洗牌完成" : `洗牌进度 ${progress}%`}</p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      {mode === "manual" ? <button type="button" onClick={() => changeMode("auto")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-5 text-sm text-ink/65"><Sparkles size={15} />自动洗牌</button> : <button type="button" onClick={() => changeMode("manual")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-5 text-sm text-ink/65"><RotateCcw size={15} />改为手动搓牌</button>}
      <button type="button" disabled={!ready} onClick={onReady} className="min-h-11 rounded-full bg-[#6E2638] px-6 text-sm text-[#FFF9F2] disabled:opacity-35">洗好了，开始选牌</button>
    </div>
  </section>;
}
