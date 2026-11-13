"use client";

import { BookOpen, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#6E2638]/20 px-4 py-2 text-center text-sm text-[#6E2638] hover:bg-[#6E2638]/5 disabled:opacity-50";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#6E2638] px-4 py-2 text-center text-sm text-[#FFF9F2] disabled:opacity-50";

export function ReadingMemoryPrompt({ maxLength, onSave, onSkip, onClose }: {
  maxLength: number;
  onSave: (memory: string) => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const editorLabel = useRef<HTMLLabelElement>(null);
  const saving = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const editorId = useId();
  const [expanded, setExpanded] = useState(false);
  const [memory, setMemory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    editorLabel.current?.focus({ preventScroll: true });
    editorLabel.current?.scrollIntoView({ block: "start" });
  }, [expanded]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = memory.trim();
    if (saving.current || !value || value.length > maxLength) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(value);
    } catch {
      setError("长期记忆暂时没保存成功。可以重试，或先跳过继续抽牌。");
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving.current) onClose();
      }}
      className="m-auto max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-ink/10 bg-[#FFFDF8] p-4 text-ink shadow-paper backdrop:bg-ink/35 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen size={19} aria-hidden="true" className="shrink-0 text-[#6E2638]" />
          <h2 id={titleId} className="font-serif text-xl sm:text-2xl">给这次解读补一点背景？</h2>
        </div>
        <button type="button" aria-label="关闭长期记忆提示" disabled={busy} onClick={onClose} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink/55 hover:bg-ink/5 disabled:opacity-40">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p id={descriptionId} className="mt-2 text-sm leading-6 text-ink/70">
        写下一两句背景，AI 就能把牌与牌之间的变化，联系到你实际经历的事。你也可以直接抽牌。
      </p>

      <div className="mt-4 rounded-xl border border-ink/10 bg-paper/55 p-3 sm:p-4">
        <p className="text-sm font-medium">「为什么我们聊得来，关系却一直没有进展？」</p>
        <p className="mt-1 text-xs text-ink/65">同一组牌 · 心 → 鸟 → 山</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-lg border border-ink/10 bg-[#FFFDF8] p-2.5 sm:p-3">
            <p className="text-xs font-medium text-ink/65">没有长期记忆</p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink/75">心接鸟，像是靠来回聊天维持着好感。鸟接山，说明互动虽然在继续，关系可能还卡在从聊天走向实际行动的这一步。</p>
          </div>
          <div className="min-w-0 rounded-lg border border-[#6E2638]/15 bg-[#6E2638]/5 p-2.5 sm:p-3">
            <p className="text-xs font-medium text-[#6E2638]">有长期记忆</p>
            <p className="mt-1.5 text-xs leading-5 text-ink/65">你们分开一个月，最近恢复聊天，但每次提到见面就换话题。</p>
            <p className="mt-1.5 border-t border-[#6E2638]/15 pt-1.5 text-[13px] leading-5 text-ink/75">心和鸟对应恢复联系后的有来有往。山让卡点落在「从聊天到见面」：你们能聊日常，但还没谈成见面的安排。换话题的原因仍不清楚。</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" disabled={busy} onClick={onSkip} className={secondaryButton}>忽略，直接去抽牌</button>
        <button type="button" disabled={busy} aria-expanded={expanded} aria-controls={expanded ? editorId : undefined} onClick={() => setExpanded((open) => !open)} className={expanded ? secondaryButton : primaryButton}>
          去填写长期记忆 <ChevronDown size={15} aria-hidden="true" className={expanded ? "rotate-180" : undefined} />
        </button>
      </div>

      {expanded && (
        <form id={editorId} onSubmit={submit} className="mt-4 border-t border-ink/10 pt-4">
          <label ref={editorLabel} tabIndex={-1} className="block text-sm font-medium focus:outline-none" htmlFor={editorId + "-memory"}>这个项目的长期记忆</label>
          <p className="mt-1 text-xs leading-5 text-ink/65">会保存在当前项目，供本次和后续的解读、追问参考。</p>
          <div id={editorId + "-tips"} className="mt-3 rounded-lg bg-paper/70 p-3 text-xs leading-5 text-ink/70">
            <p className="font-medium text-ink/80">挑一两条写就好</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>现在处在什么阶段，比如刚恢复联系、刚入职。</li>
              <li>最近发生过什么，或你已经试过什么。</li>
              <li>眼下有什么限制，或你最想弄清哪一点。</li>
            </ul>
          </div>
          <textarea
            id={editorId + "-memory"}
            aria-describedby={editorId + "-tips"}
            value={memory}
            onChange={(event) => { setMemory(event.target.value); setError(""); }}
            disabled={busy}
            maxLength={maxLength}
            rows={3}
            placeholder="例如：我们分开一个月，最近重新聊天。一提见面就换话题，我想弄清关系卡在哪一步。"
            className="mt-2 w-full resize-y rounded-lg border border-ink/15 bg-white/80 px-3 py-2.5 text-base leading-6 outline-none focus:border-[#6E2638]/50"
          />
          {error && <p role="alert" className="mt-2 text-sm text-[#8E4D4A]">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink/55">{memory.length}/{maxLength}</span>
            <button type="submit" disabled={busy || !memory.trim()} className={primaryButton}>{busy ? "正在保存…" : "填好了，去抽牌"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
