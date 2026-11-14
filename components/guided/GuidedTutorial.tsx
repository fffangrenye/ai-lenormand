"use client";

import { ArrowDown, BookOpen, ChevronLeft, ChevronRight, Layers, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const seenKey = "flora:onion-reading-guide:v1";

const slides = [
  {
    title: "写下一个主问题",
    description: "说清这次想看什么。愿意的话，可以补一点背景，让推荐更贴近你的处境。",
    artwork: <div className="w-full max-w-[250px] rounded-xl border border-[#715A80]/15 bg-[#FFFDF8] px-4 py-3 text-left shadow-sm">
      <p className="font-serif text-sm text-[#574463]">这一次，你想问什么？</p>
      <p className="mt-2 rounded-lg border border-[#715A80]/20 bg-[#F9F5F9] px-3 py-2 text-xs leading-5 text-ink/80">这段关系接下来怎样相处会更自然？</p>
      <p className="mt-2 text-[11px] text-ink/60">想补充的背景 · 可选</p>
      <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#6E2638] px-3 py-1.5 text-[10px] text-white"><Sparkles size={10} />开始洋葱解牌</span>
    </div>,
  },
  {
    title: "选一个角度，再抽牌",
    description: "每轮可选推荐题、换一组，或自己写。翻开后先看这一张的解读，下一轮会顺着刚才的线索继续。",
    artwork: <div className="w-full max-w-[250px] rounded-xl border border-[#715A80]/15 bg-[#FFFDF8] px-4 py-3 text-left shadow-sm">
      <p className="font-serif text-sm text-[#574463]">客观现状</p>
      <p className="mt-1 text-[11px] text-ink/60">先看看最近的联系有什么变化。</p>
      <p className="mt-2 rounded-lg border border-[#715A80]/40 bg-[#715A80]/10 px-2.5 py-1.5 text-xs leading-5 text-[#574463]">最近有哪些看得见的变化？</p>
      <div className="mt-1.5 flex justify-between gap-1 text-[10px] text-[#715A80]"><span>换一组</span><span>自己输入问题</span></div>
      <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#6E2638] px-3 py-1.5 text-[10px] text-white"><Sparkles size={10} />选好了，抽第 1 张</span>
    </div>,
  },
  {
    title: "九张抽完，看综合解读",
    description: "洋葱解牌会把九轮线索连起来，回到最初的问题，给出可以尝试的下一步。中途退出也能从记录续接。",
    artwork: <div className="flex w-full max-w-[236px] flex-col items-center gap-1.5">
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <span key={index} className="grid h-[25px] w-[20px] place-items-center rounded-[3px] border border-[#715A80]/30 bg-[#FFFDF8] text-[#715A80]"><Sparkles size={10} strokeWidth={1} /></span>)}
      </div>
      <ArrowDown size={13} strokeWidth={1.5} className="text-[#715A80]/80" />
      <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#715A80]/15 bg-[#FFFDF8] px-3 py-2 text-xs text-[#574463] shadow-sm"><Layers size={14} />九张牌的综合解读</div>
    </div>,
  },
] satisfies { title: string; description: string; artwork: ReactNode }[];

const iconButton = "grid size-11 place-items-center rounded-full text-[#715A80] hover:bg-[#715A80]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#715A80] disabled:opacity-30";

export function GuidedTutorial() {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const openedByButton = useRef(false);
  const [index, setIndex] = useState(0);

  function open(manual: boolean) {
    const element = dialog.current;
    if (!element || element.open) return;
    openedByButton.current = manual;
    element.showModal();
    setIndex(0);
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem(seenKey)) return;
    } catch {
      // The guide is still available when browser storage is restricted.
    }
    open(false);
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(seenKey, "1"); } catch { /* Optional device preference. */ }
    dialog.current?.close();
    if (openedByButton.current) trigger.current?.focus();
  }

  function goTo(next: number) {
    if (next < 0 || next >= slides.length || !track.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current.scrollTo({ left: next * track.current.clientWidth, behavior: reducedMotion ? "instant" : "smooth" });
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    goTo(index + (event.key === "ArrowLeft" ? -1 : 1));
  }

  const title = "洋葱解牌使用说明";

  return <>
    <button ref={trigger} type="button" onClick={() => open(true)} aria-haspopup="dialog" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[#715A80]/25 bg-[#FFFDF8] px-3 text-sm text-[#574463] hover:bg-[#715A80]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#715A80]">
      <BookOpen size={15} aria-hidden="true" />使用说明
    </button>
    <dialog ref={dialog} aria-labelledby="guided-tutorial-title" onCancel={event => { event.preventDefault(); dismiss(); }} className="m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-[420px] overflow-y-auto overscroll-contain rounded-2xl border border-[#715A80]/20 bg-[#FFFDF8] text-ink shadow-paper backdrop:bg-ink/40">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-2 sm:px-5">
        <h2 id="guided-tutorial-title" className="font-serif text-lg text-[#574463]">{title}</h2>
        <button type="button" onClick={dismiss} aria-label="关闭使用说明" className={iconButton}><X size={18} aria-hidden="true" /></button>
      </div>
      <div ref={track} role="group" aria-label="教程，可以左右滑动" tabIndex={0} onKeyDown={handleKeyboard} onScroll={event => {
        const { scrollLeft, clientWidth } = event.currentTarget;
        if (clientWidth) setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(scrollLeft / clientWidth))));
      }} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, slideIndex) => <section key={slide.title} aria-hidden={index !== slideIndex} className="w-full shrink-0 snap-start snap-always space-y-2 px-4 sm:px-5">
          <div aria-hidden="true" className="grid h-[clamp(138px,26dvh,184px)] place-items-center rounded-xl border border-[#715A80]/15 bg-gradient-to-br from-[#F5EEF6] via-[#F8F3F3] to-[#F5F0E6] px-3">
            {slide.artwork}
          </div>
          <h3 className="pt-1 font-serif text-xl text-[#574463]">{slide.title}</h3>
          <p className="min-h-[3rem] text-sm leading-6 text-ink/75">{slide.description}</p>
        </section>)}
      </div>
      <div className="flex items-center justify-between px-4 sm:px-5">
        <button type="button" className={iconButton} aria-label="上一张" disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <div className="flex items-center" aria-label="教程页码">{slides.map((slide, slideIndex) =>
          <button key={slide.title} type="button" aria-label={`第 ${slideIndex + 1} 张：${slide.title}`} aria-current={index === slideIndex ? "step" : undefined} onClick={() => goTo(slideIndex)} className="grid h-11 w-8 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#715A80]">
            <span aria-hidden="true" className={index === slideIndex ? "h-2 w-5 rounded-full bg-[#715A80]" : "size-2 rounded-full bg-[#715A80]/30"} />
          </button>
        )}</div>
        <button type="button" className={iconButton} aria-label="下一张" disabled={index === slides.length - 1} onClick={() => goTo(index + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div className="px-4 pb-4 sm:px-5">
        <button type="button" onClick={dismiss} className="min-h-11 w-full rounded-full bg-[#6E2638] px-4 text-sm font-medium text-white hover:bg-[#5A2030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E2638]">知道了，去玩一下</button>
      </div>
    </dialog>
  </>;
}
