"use client";

import Link from "@/components/SiteLink";
import { FolderInput, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { PaidProject, ReadingTrashPage, TrashedReading } from "@/lib/paid-local/types";

type ProjectChoice = Pick<PaidProject, "id" | "title">;
export type ConversationAction = { kind: "move" | "delete"; reading: { id: string; question: string } };

const primary = "inline-flex min-h-11 items-center justify-center rounded-full bg-[#6E2638] px-5 text-sm text-[#FFF9F2] disabled:opacity-40";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm text-ink/70 disabled:opacity-40";
const selectClass = "mt-2 min-h-11 w-full rounded-lg border border-ink/15 bg-[#FFFDF8] px-3 text-sm text-ink";
const expiryFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
});

export function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-ink/10 bg-[#FFFDF8] p-5 text-ink shadow-paper backdrop:bg-ink/35 sm:p-7"
    >
      <h2 id={heading} className="font-serif text-2xl">{title}</h2>
      {children}
    </dialog>
  );
}

export function ConversationButtons({ disabled, onAction }: { disabled: boolean; onAction: (kind: ConversationAction["kind"]) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="移动对话" disabled={disabled} onClick={() => onAction("move")} className="inline-flex min-h-10 items-center gap-1.5 text-xs text-ink/65 disabled:opacity-35">
        <FolderInput size={14} aria-hidden="true" />移动
      </button>
      <button type="button" aria-label="删除对话" disabled={disabled} onClick={() => onAction("delete")} className="inline-flex min-h-10 items-center gap-1.5 text-xs text-[#8E4D4A] disabled:opacity-35">
        <Trash2 size={14} aria-hidden="true" />删除
      </button>
    </div>
  );
}

export function ConversationDialog({ action, projectId, projects, onClose, onDone }: {
  action: ConversationAction;
  projectId: string;
  projects: ProjectChoice[];
  onClose: () => void;
  onDone: (readingId: string, destination?: ProjectChoice) => void;
}) {
  const [targetProjectId, setTargetProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const deleting = action.kind === "delete";
  const destinations = projects.filter(project => project.id !== projectId);
  const target = destinations.find(project => project.id === targetProjectId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (!deleting && !target)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const fields = { readingId: action.reading.id, projectId };
      if (deleting) await paidSiteRequest("reading-trash", fields);
      else await paidSiteRequest("reading-move", { ...fields, targetProjectId });
      onDone(action.reading.id, deleting ? undefined : target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法完成操作，请重试。");
      setBusy(false);
      pending.current = false;
    }
  }

  return (
    <Modal title={deleting ? "删除这条对话？" : "移动到项目"} busy={busy} onClose={onClose}>
      <p className="mt-3 break-words rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">{action.reading.question}</p>
      <form onSubmit={submit}>
        {deleting ? (
          <p className="mt-3 text-sm leading-6 text-ink/65">这条对话的牌面、解读和追问会一起移入回收站。30 天内可前往「我的主页 → 对话回收站」恢复。</p>
        ) : destinations.length ? (
          <label className="mt-4 block text-sm text-ink/75">
            目标项目
            <select className={selectClass} required value={targetProjectId} disabled={busy} onChange={event => setTargetProjectId(event.target.value)}>
              <option value="">请选择项目</option>
              {destinations.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink/65">请先在项目菜单里新建一个目标项目。</p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-[#8E4D4A]">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondary}>取消</button>
          <button type="submit" disabled={busy || (!deleting && !target)} className={primary}>
            {busy ? "正在保存…" : deleting ? "确认删除" : "确认移动"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReadingTrashDialog({ onClose }: { onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const [page, setPage] = useState<ReadingTrashPage | null>(null);
  const [busyId, setBusyId] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState<ProjectChoice | null>(null);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      paidSiteRequest<ReadingTrashPage>("reading-trash"),
      paidSiteRequest<PaidProject[]>("projects")
    ]).then(([result, destinations]) => {
      if (!active) return;
      setPage(result);
      setProjects(destinations);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "暂时无法读取回收站。");
    });
    return () => { active = false; };
  }, [reload]);

  async function loadMore() {
    if (!page?.nextCursor || pending.current) return;
    pending.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const next = await paidSiteRequest<ReadingTrashPage>("reading-trash?cursor=" + encodeURIComponent(page.nextCursor));
      setPage({ items: [...page.items, ...next.items], nextCursor: next.nextCursor });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法读取更多对话。");
    } finally {
      setLoadingMore(false);
      pending.current = false;
    }
  }

  async function restore(item: TrashedReading, targetProjectId: string) {
    if (pending.current || !targetProjectId) return;
    pending.current = true;
    setBusyId(item.id);
    setError("");
    setRestored(null);
    try {
      const result = await paidSiteRequest<{ id: string; projectId: string }>("reading-restore", { readingId: item.id, targetProjectId });
      setPage(current => current && { ...current, items: current.items.filter(reading => reading.id !== item.id) });
      setRestored(projects.find(project => project.id === result.projectId) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法恢复这条对话。");
    } finally {
      setBusyId("");
      pending.current = false;
    }
  }

  const busy = Boolean(busyId) || loadingMore;
  return (
    <Modal title="对话回收站" busy={busy} onClose={onClose}>
      <button type="button" aria-label="关闭回收站" disabled={busy} onClick={onClose} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-ink/10 disabled:opacity-40">
        <X size={17} aria-hidden="true" />
      </button>
      <p className="mt-3 text-sm leading-6 text-ink/65">删除后的 30 天内可以恢复对话。</p>
      {!page && !error && <p role="status" className="mt-5 text-sm text-ink/60">正在读取回收站…</p>}
      {page?.items.length === 0 && !page.nextCursor && <p className="mt-5 rounded-lg bg-paper p-4 text-sm text-ink/65">回收站是空的。</p>}
      {restored && (
        <p role="status" className="mt-4 rounded-lg bg-paper p-3 text-sm">
          已恢复到「{restored.title}」。 <Link prefetch={false} href={"/deep/project/" + encodeURIComponent(restored.id) + "?view=history"} onClick={onClose} className="text-[#6E2638] underline underline-offset-2">打开项目</Link>
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-lg bg-paper p-3 text-sm text-[#8E4D4A]">
          <p role="alert">{error}</p>
          {!page && <button type="button" className="mt-2 underline" onClick={() => { setError(""); setReload(count => count + 1); }}>重试读取</button>}
        </div>
      )}
      {!!page?.items.length && (
        <ul className="mt-4 space-y-3">
          {page.items.map(item => {
            const original = projects.find(project => project.id === item.projectId);
            const destination = original?.id || destinations[item.id] || "";
            return (
              <li key={item.id} className="rounded-xl border border-ink/10 p-3 sm:p-4">
                <p className="break-words text-sm leading-6">{item.question}</p>
                <p className="mt-1 break-words text-xs leading-5 text-ink/55">原项目 {item.projectTitle || "未归档"} · 可恢复至 {expiryFormat.format(new Date(item.expiresAt))}（北京时间）</p>
                {!original && (
                  <label className="mt-3 block text-xs text-ink/65">
                    原项目已不可用，请选择恢复位置
                    <select className={selectClass} disabled={busy} value={destination} onChange={event => setDestinations(current => ({ ...current, [item.id]: event.target.value }))}>
                      <option value="">请选择项目</option>
                      {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" className={secondary + " mt-3"} disabled={busy || !destination} onClick={() => void restore(item, destination)}>
                  {busyId === item.id ? "正在恢复…" : "恢复对话"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {page?.nextCursor && <button type="button" className={secondary + " mt-4 w-full"} disabled={busy} onClick={() => void loadMore()}>{loadingMore ? "正在读取…" : "查看更早删除的对话"}</button>}
    </Modal>
  );
}
