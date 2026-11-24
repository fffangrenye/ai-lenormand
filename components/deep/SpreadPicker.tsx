"use client";

import { Check, ChevronDown } from "lucide-react";
import type { DeepSpread, DeepSpreadId } from "@/lib/deep-spreads";
import { SpreadLayout } from "./SpreadLayout";

export function SpreadPicker({ spreads, selected, onSelect }: {
  spreads: DeepSpread[]; selected: DeepSpread; onSelect: (id: DeepSpreadId) => void;
}) {
  return <fieldset className="mt-10 min-w-0 sm:mt-12">
    <legend className="flex w-full items-baseline justify-between gap-3"><span className="font-serif text-[22px] text-ink/90">选择牌阵</span><span className="deep-eyebrow">FIND YOUR SPREAD</span></legend>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">{spreads.map(item => <label key={item.id} className={`group relative flex cursor-pointer items-center gap-4 rounded-[22px] border px-4 py-5 transition-[border-color,background-color,box-shadow] duration-200 sm:px-5 ${item.id === selected.id ? "border-[#6E2638]/35 bg-[#FFFDF8] shadow-[0_8px_24px_-18px_rgba(110,38,56,0.3)]" : "border-ink/[0.07] bg-[#FFFDF8]/55 hover:border-[#6E2638]/20 hover:bg-[#FFFDF8]/85"}`}>
      <input type="radio" name="deep-spread" value={item.id} checked={item.id === selected.id} onChange={() => onSelect(item.id)} className="peer sr-only" />
      <span className="pointer-events-none absolute inset-0 rounded-[22px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6E2638]" />
      <div className="w-[60px] shrink-0 text-[#6E2638]/65 sm:w-[68px]" aria-hidden="true"><SpreadLayout spreadId={item.id} miniature /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="font-serif text-[20px] leading-7 text-ink/90">{item.name}</h2><span className="shrink-0 text-[10px] tracking-[0.12em] text-clay/80">{String(item.positions.length).padStart(2, "0")} CARDS</span></div>
        <p className="mt-2 text-[13px] leading-[1.8] text-ink/55">{item.suitable}</p>
      </div>
      {item.id === selected.id && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#6E2638] text-[#FFFDF8]"><Check size={11} strokeWidth={2} aria-hidden="true" /><span className="sr-only">已选择</span></span>}
    </label>)}</div>
    <details key={selected.id} className="mt-4 rounded-2xl border border-ink/[0.06] bg-[#FFFDF8]/35 px-4 sm:px-5">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[13px] text-ink/60 [&::-webkit-details-marker]:hidden"><span>{selected.name} · 牌位与阅读方式</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="border-t border-ink/[0.06] pb-4 pt-3 text-sm leading-7 text-ink/65"><p>{selected.rules}</p><p className="mt-2 text-ink/50">提问参考：{selected.example}</p></div>
    </details>
  </fieldset>;
}
