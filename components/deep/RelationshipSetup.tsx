"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Flower2 } from "lucide-react";
import type { RelationshipContext, RelationshipGender } from "@/lib/paid-local/relationship-context";

const options: { value: RelationshipGender; label: string }[] = [
  { value: "woman", label: "女" }, { value: "man", label: "男" }, { value: "unspecified", label: "不指定" }
];

export function RelationshipSetup({ question, initial, busy, error, onBack, onContinue }: {
  question: string; initial?: RelationshipContext; busy: boolean; error: string;
  onBack: () => void; onContinue: (value: RelationshipContext) => void;
}) {
  const [selfGender, setSelfGender] = useState<RelationshipGender | null>(initial?.selfGender ?? null);
  const [otherGender, setOtherGender] = useState<RelationshipGender | null>(initial?.otherGender ?? null);
  return <section className="mx-auto max-w-2xl px-1 pb-12 pt-5 sm:pb-20 sm:pt-8">
    <div className="flex items-center justify-between">
      <button type="button" disabled={busy} onClick={onBack} className="group inline-flex min-h-11 items-center gap-2 rounded-full pr-4 text-sm text-ink/55 transition-colors hover:text-[#6E2638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E2638] disabled:opacity-40"><ArrowLeft size={15} className="transition-transform motion-safe:group-hover:-translate-x-0.5" />返回</button>
      <span className="text-[10px] tracking-[0.22em] text-[#6E2638]/50" aria-label="H 牌阵，双方信息">H · RELATIONSHIP</span>
    </div>
    <header className="mx-auto mt-8 max-w-lg text-center sm:mt-12">
      <Flower2 size={27} strokeWidth={1} className="mx-auto text-[#6E2638]/65" aria-hidden="true" />
      <h1 className="mt-5 font-serif text-[30px] leading-tight tracking-[0.04em] sm:text-[38px]">关于你们</h1>
      <p className="mt-4 text-[15px] leading-7 text-ink/55">选择双方性别，也可以不指定。</p>
      <p className="mx-auto mt-6 max-w-md break-words text-[15px] leading-7 text-ink/75 sm:mt-7">{question}</p>
    </header>
    <form onSubmit={event => { event.preventDefault(); if (!busy && selfGender && otherGender) onContinue({ selfGender, otherGender }); }}>
      <div className="mx-auto mt-8 max-w-xl rounded-[26px] border border-[#6E2638]/[0.06] bg-[#FFFDF8]/80 px-5 shadow-[0_8px_36px_-24px_rgba(73,42,43,0.18)] sm:mt-10 sm:px-8">
        {([
          { name: "self", title: "我方", english: "YOU", value: selfGender, set: setSelfGender },
          { name: "other", title: "对方", english: "THE OTHER", value: otherGender, set: setOtherGender }
        ] as const).map(group => <fieldset key={group.name} disabled={busy} className="m-0 min-w-0 border-0 py-6 first:border-b first:border-solid first:border-[#6E2638]/[0.07] sm:py-8">
          <legend className="sr-only">{group.title}性别</legend>
          <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center sm:gap-6">
            <div className="flex items-baseline gap-3 sm:flex-col sm:gap-1" aria-hidden="true"><span className="font-serif text-[22px] text-ink/85">{group.title}</span><span className="text-[10px] tracking-[0.18em] text-clay/75">{group.english}</span></div>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-[#6E2638]/[0.045] p-1.5">{options.map(option => <label key={option.value} className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-full px-2 text-[14px] transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none ${group.value === option.value ? "bg-[#FFFDF8] text-[#6E2638] shadow-[0_2px_8px_rgba(73,42,43,0.09)]" : "text-ink/55 hover:text-[#6E2638]"} ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <input type="radio" name={`relationship-${group.name}`} value={option.value} checked={group.value === option.value} onChange={() => group.set(option.value)} required className="peer sr-only" />
            <span className="pointer-events-none absolute inset-0 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6E2638]" />
            <span className={group.value === option.value ? "font-medium" : ""}>{option.label}</span>
          </label>)}</div></div>
        </fieldset>)}
      </div>
      {error && <p role="alert" className="mx-auto mt-5 max-w-xl text-center text-sm leading-6 text-[#8E4D4A]">{error}</p>}
      <div className="mx-auto mt-8 flex max-w-xl justify-center sm:mt-10"><button type="submit" disabled={busy || !selfGender || !otherGender} className="group inline-flex min-h-[52px] w-full items-center justify-center gap-5 rounded-full bg-[#6E2638] px-9 text-[15px] text-[#FFF9F2] shadow-[0_6px_18px_-10px_rgba(110,38,56,0.6)] transition-[background-color,opacity,box-shadow] hover:bg-[#5C2030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E2638] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none sm:w-auto sm:min-w-[224px]">{busy ? "正在审查…" : "继续，去洗牌"}<ArrowRight size={16} className="transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" /></button></div>
    </form>
  </section>;
}
