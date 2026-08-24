"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CSSProperties, FormEvent, ReactNode, TouchEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Menu, Pencil, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";
import {
  DeepProject,
  DeepQuota,
  FollowUpMessage,
  ReadingWithCards,
  SpreadType,
  formatProjectDate,
  generateDeepReading,
  getDeepReadingQuota,
  getFollowUpQuota,
  getSession,
  loadFollowUpMessages,
  loadProject,
  loadProjects,
  loadReadings,
  removeProject,
  saveProject,
  saveProjectTouch,
  saveProjectUpdate,
  saveReading,
  sendFollowUpMessage,
  signOut,
} from "@/lib/project-store";

type SheetMode = "create" | "edit";
type ReadingFlowStep = "idle" | "spread" | "question" | "drawing";
type DrawingPhase = "shuffle" | "draw" | "interpret" | "reveal";

type ProjectFormState = {
  title: string;
  background: string;
};

type ShellActionChildren = (actions: { openCreate: () => void }) => ReactNode;
type ProjectActionTarget = {
  mode: "edit" | "delete";
  project: DeepProject;
};

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function defaultForm(project?: DeepProject | null): ProjectFormState {
  return {
    title: project?.title ?? "",
    background: project?.background ?? ""
  };
}

function useDeepSession(returnTo: string) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    setEmail(session.email);
    setReady(true);
  }, [returnTo, router]);

  return { ready, email };
}

function ProjectDrawerItem({
  project,
  active,
  isRevealed,
  onReveal,
  onCloseReveal,
  onCloseDrawer,
  onEditProject,
  onDeleteProject
}: {
  project: DeepProject;
  active: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onCloseReveal: () => void;
  onCloseDrawer: () => void;
  onEditProject: (project: DeepProject) => void;
  onDeleteProject: (project: DeepProject) => void;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) return;

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    if (deltaX < -24) onReveal();
    if (deltaX > 24) onCloseReveal();
    setTouchStartX(null);
  }

  return (
    <div
      className="group relative overflow-hidden border-b border-ink/8"
      onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-y-0 right-0 flex w-[104px] items-center justify-end gap-1 bg-[#F4EFE6] pr-1">
        <button
          type="button"
          onClick={() => onEditProject(project)}
          className="grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-ivory/78 text-ink/58"
        >
          <Pencil size={15} aria-hidden="true" />
          <span className="sr-only">修改项目</span>
        </button>
        <button
          type="button"
          onClick={() => onDeleteProject(project)}
          className="grid h-10 w-10 place-items-center rounded-full border border-[#8E4D4A]/16 bg-[#FFF7F4] text-[#8E4D4A]"
        >
          <Trash2 size={15} aria-hidden="true" />
          <span className="sr-only">删除项目</span>
        </button>
      </div>
      <Link
        href={`/deep/project/${project.id}`}
        onClick={onCloseDrawer}
        className={`relative block touch-pan-y bg-[#FBF8F0] py-4 transition-transform duration-200 group-hover:-translate-x-[92px] ${
          isRevealed ? "-translate-x-[92px]" : ""
        } ${active ? "border-l-2 border-l-clay pl-3" : "pl-0"}`}
      >
        <p className={`line-clamp-2 text-[15px] leading-5 ${active ? "font-medium text-ink" : "text-ink/72"}`}>{project.title}</p>
        <p className="mt-1 text-[12px] text-ink/38">{formatProjectDate(project.lastOpenedAt)}</p>
      </Link>
    </div>
  );
}

function ProjectDrawer({
  open,
  projects,
  currentProjectId,
  email,
  onClose,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onLogout
}: {
  open: boolean;
  projects: DeepProject[];
  currentProjectId?: string;
  email: string;
  onClose: () => void;
  onNewProject: () => void;
  onEditProject: (project: DeepProject) => void;
  onDeleteProject: (project: DeepProject) => void;
  onLogout: () => void;
}) {
  const [revealedProjectId, setRevealedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setRevealedProjectId(null);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="关闭项目抽屉"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/18 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-label="Project Drawer"
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[360px] flex-col border-r border-ink/10 bg-[#FBF8F0] px-5 pb-5 pt-[calc(env(safe-area-inset-top)+20px)] shadow-paper transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-[0.22em] text-clay/72">Deep Reading</p>
            <h2 className="mt-2 font-serif text-[25px] leading-tight text-ink">Project Stories</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-ivory/72 text-ink/58">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">关闭</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onNewProject}
          className="mt-7 flex h-12 items-center justify-center gap-2 rounded-full bg-[#6E2638] px-4 text-[13px] uppercase tracking-[0.11em] text-[#FFF9F2] shadow-soft"
        >
          <Plus size={16} aria-hidden="true" />
          New Project
        </button>

        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <p className="mb-2 text-[12px] uppercase tracking-[0.18em] text-ink/40">Recent Projects</p>
          <div className="min-h-0 overflow-y-auto pr-1">
            {projects.length ? (
              projects.map((project) => {
                const active = project.id === currentProjectId;

                return (
                  <ProjectDrawerItem
                    key={project.id}
                    project={project}
                    active={active}
                    isRevealed={revealedProjectId === project.id}
                    onReveal={() => setRevealedProjectId(project.id)}
                    onCloseReveal={() => setRevealedProjectId(null)}
                    onCloseDrawer={onClose}
                    onEditProject={onEditProject}
                    onDeleteProject={onDeleteProject}
                  />
                );
              })
            ) : (
              <p className="rounded-[4px] border border-ink/8 bg-ivory/50 p-4 text-[13px] leading-6 text-ink/48">还没有项目。先创建一个长期故事。</p>
            )}
          </div>
        </div>

        <div className="border-t border-ink/10 pt-4">
          <p className="truncate text-[12px] text-ink/42">{email}</p>
          <button type="button" onClick={onLogout} className="mt-3 h-10 text-[13px] uppercase tracking-[0.16em] text-ink/58">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

function ProjectSheet({
  open,
  mode,
  initialProject,
  onClose,
  onSaved
}: {
  open: boolean;
  mode: SheetMode;
  initialProject?: DeepProject | null;
  onClose: () => void;
  onSaved: (project: DeepProject) => void;
}) {
  const [form, setForm] = useState(defaultForm(initialProject));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(defaultForm(initialProject));
      setError("");
    }
  }, [initialProject, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("请给这个项目一个名字。");
      return;
    }

    try {
      const project =
        mode === "create"
          ? await saveProject({ title: form.title, background: form.background })
          : await saveProjectUpdate(initialProject?.id ?? "", { title: form.title, background: form.background });

      if (!project) return;
      onSaved(project);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败，请稍后再试。");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="关闭项目表单"
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-ink/16 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <section
        aria-label={mode === "create" ? "创建新项目" : "编辑项目"}
        className={`fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px] rounded-t-[18px] border border-ink/10 bg-[#FFFDF8] px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-paper transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink/14" />
        <form onSubmit={handleSubmit}>
          <h2 className="font-serif text-[26px] leading-tight text-ink">{mode === "create" ? "创建新项目" : "编辑项目"}</h2>

          <label htmlFor="project-title" className="mt-6 block text-[13px] text-ink/58">
            项目名称
          </label>
          <input
            id="project-title"
            value={form.title}
            maxLength={100}
            onChange={(event) => {
              setForm((current) => ({ ...current, title: event.target.value }));
              setError("");
            }}
            placeholder="例如：学业/工作"
            className="mt-2 h-12 w-full rounded-[4px] border border-ink/12 bg-white/70 px-4 text-[15px] outline-none focus:border-ink/35"
          />

          <label htmlFor="project-background" className="mt-5 block text-[13px] text-ink/58">
            简单说说背景
          </label>
          <textarea
            id="project-background"
            value={form.background}
            onChange={(event) => setForm((current) => ({ ...current, background: event.target.value }))}
            placeholder="可以写下目前发生了什么、你最在意什么。也可以暂时留空。"
            rows={5}
            className="mt-2 w-full resize-none rounded-[4px] border border-ink/12 bg-white/70 px-4 py-3 text-[15px] leading-6 outline-none focus:border-ink/35"
          />

          {error ? <p className="mt-3 text-[13px] text-[#8E4D4A]">{error}</p> : null}

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full border border-ink/12 text-[13px] uppercase tracking-[0.12em] text-ink/58">
              取消
            </button>
            <button type="submit" className="h-12 flex-1 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft">
              {mode === "create" ? "创建项目" : "保存"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function MobileHeader({
  title,
  onOpenDrawer
}: {
  title: string;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-5 flex h-[64px] items-center justify-between border-b border-ink/8 bg-paper/92 px-5 backdrop-blur">
      <button type="button" onClick={onOpenDrawer} className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-ivory/72 text-ink/68">
        <Menu size={19} aria-hidden="true" />
        <span className="sr-only">打开项目抽屉</span>
      </button>
      <p className="mx-3 min-w-0 flex-1 truncate text-center font-serif text-[19px] leading-none text-ink">{title}</p>
      <Link
        href="/"
        className="grid h-11 min-w-11 place-items-center rounded-full border border-ink/10 bg-ivory/72 px-3 text-[12px] uppercase tracking-[0.12em] text-ink/62"
      >
        Home
      </Link>
    </header>
  );
}

function EmptyState({
  project,
  onCreateProject,
  onStartReading
}: {
  project?: DeepProject | null;
  onCreateProject?: () => void;
  onStartReading?: () => void;
}) {
  const isProjectPage = Boolean(project);

  return (
    <div className="flex flex-1 items-center py-10">
      <section className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-6 shadow-paper">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-clay/20 bg-[#F3EFE5] text-clay/70">
          <BookOpen size={25} aria-hidden="true" />
        </div>
        <p className="mt-6 text-center text-[12px] uppercase tracking-[0.18em] text-clay/68">Deep Reading</p>
        <h1 className="mt-3 text-center font-serif text-[31px] leading-[1.08] text-ink">{project?.title ?? "创建你的第一个项目"}</h1>
        <p className="mx-auto mt-4 max-w-[280px] text-center text-[14px] leading-6 text-ink/58">
          {isProjectPage ? "这个项目还没有任何占卜记录。从一个你现在最想知道的问题开始。" : "把一个长期在意的主题放进这里，之后每次回来都能接着这个故事。"}
        </p>

        {isProjectPage ? (
          <button
            type="button"
            onClick={onStartReading}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft"
          >
            <Check size={16} aria-hidden="true" />
            开始第一次占卜
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreateProject}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft"
          >
            <Plus size={16} aria-hidden="true" />
            创建第一个项目
          </button>
        )}

        {project?.background ? (
          <div className="mt-7 border-t border-ink/8 pt-5">
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink/36">Background</p>
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-ink/56">{project.background}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProjectMemory({ project, onSaved }: { project: DeepProject; onSaved: () => void }) {
  const [draft, setDraft] = useState(project.memorySummary ?? "");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasMemory = Boolean((project.memorySummary ?? "").trim());

  useEffect(() => {
    setDraft(project.memorySummary ?? "");
    setSaved(false);
  }, [project.id, project.memorySummary]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const updatedProject = await saveProjectUpdate(project.id, { memorySummary: draft });
      if (!updatedProject) return;

      setDraft(updatedProject.memorySummary);
      setSaved(true);
      onSaved();
    } catch {
      setSaved(false);
    }
  }

  return (
    <section className="border-b border-ink/10 py-3">
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-[6px] border border-ink/8 bg-[#FFFDF8]/72">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-[58px] w-full items-center justify-between gap-4 px-4 py-3 text-left"
        >
          <div>
            <p className="text-[12px] uppercase tracking-[0.17em] text-clay/64">Memory</p>
            <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-ink/48">{hasMemory ? project.memorySummary : "未填写长期记忆"}</p>
          </div>
          <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-ink/42 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="border-t border-ink/8 px-4 pb-4 pt-3">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[13px] leading-5 text-ink/48">长期记忆会被带入新的解读和追问。</p>
              <button
                type="submit"
                className="h-9 shrink-0 rounded-full bg-[#6E2638] px-4 text-[12px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft"
              >
                保存
              </button>
            </div>

            <textarea
              value={draft}
              maxLength={2000}
              rows={5}
              onChange={(event) => {
                setDraft(event.target.value);
                setSaved(false);
              }}
              placeholder="记录这个项目里长期有效的信息：人物关系、关键事实、反复出现的模式、你已经确认过的现实背景..."
              className="mt-4 w-full resize-none rounded-[5px] border border-ink/12 bg-white/72 px-3 py-3 text-[14px] leading-6 outline-none focus:border-ink/35"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-ink/38">
              <span>{saved ? "已保存到本地。" : "不会自动总结，也不会自动调用 AI。"}</span>
              <span>{draft.length}/2000</span>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function QuotaNotice({ quota, message }: { quota: DeepQuota; message?: string }) {
  return (
    <section className="border-b border-ink/10 py-3">
      <div className="rounded-[6px] border border-ink/8 bg-[#FFFDF8]/72 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.17em] text-clay/64">Daily Free</p>
            <p className="mt-1 text-[13px] leading-5 text-ink/50">今日 AI 深度解读剩余 {quota.remaining}/{quota.limit} 次。用完后仍可抽牌和保存牌面。</p>
            <p className="mt-1 text-[12px] leading-5 text-ink/36">每日 {quota.resetLabel} 后刷新。</p>
          </div>
          <span className="shrink-0 rounded-full border border-ink/10 bg-ivory/70 px-3 py-1 text-[12px] text-ink/46">{quota.used}/{quota.limit}</span>
        </div>
        {message ? <p className="mt-3 text-[13px] leading-5 text-[#8E4D4A]">{message}</p> : null}
      </div>
    </section>
  );
}

function CardBackMini({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <span style={style} className={`relative block overflow-hidden rounded-[3px] border border-ink/12 bg-[#FFFDF8] shadow-sm ${className}`}>
      <span className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(33,31,27,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(33,31,27,0.05)_1px,transparent_1px)] [background-size:9px_9px]" />
      <span className="absolute inset-1.5 rounded-[2px] border border-ink/14">
        <span className="absolute inset-2 border border-clay/20" />
        <span className="absolute left-1/2 top-1/2 h-[44%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sage/24" />
        <span className="absolute left-1/2 top-1/2 h-px w-[52%] -translate-x-1/2 bg-ink/12" />
        <span className="absolute left-1/2 top-1/2 h-[42%] w-px -translate-y-1/2 bg-ink/12" />
      </span>
    </span>
  );
}

function SpreadMini({ count }: { count: 3 | 5 }) {
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <CardBackMini
          key={index}
          className={`h-12 w-8 ${count === 5 && index === 2 ? "-translate-y-1 border-clay/35" : ""}`}
        />
      ))}
    </div>
  );
}

function SpreadSelection({
  selectedSpread,
  onSelect,
  onNext,
  onCancel
}: {
  selectedSpread: SpreadType;
  onSelect: (spread: SpreadType) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const options: Array<{ spread: SpreadType; title: string; subtitle: string; count: 3 | 5 }> = [
    {
      spread: "three_card",
      title: "Three Cards",
      subtitle: "适合聚焦一个具体问题，看当前发展与后续趋势。",
      count: 3
    },
    {
      spread: "five_card_linear",
      title: "Five-card Linear",
      subtitle: "适合更完整地看一件事如何发展，以及中间转折和最终倾向。",
      count: 5
    }
  ];

  return (
    <div className="py-6">
      <p className="text-[12px] uppercase tracking-[0.2em] text-clay/68">New Reading</p>
      <h1 className="mt-3 font-serif text-[32px] leading-tight text-ink">选择这次的牌阵</h1>
      <div className="mt-7 space-y-4">
        {options.map((option) => {
          const active = option.spread === selectedSpread;

          return (
            <button
              key={option.spread}
              type="button"
              onClick={() => onSelect(option.spread)}
              className={`w-full rounded-[6px] border p-5 text-left transition ${
                active ? "border-clay/42 bg-[#FFFDF8] shadow-entry" : "border-ink/10 bg-[#FFFDF8]/62"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-[24px] leading-tight text-ink">{option.title}</p>
                  <p className="mt-2 text-[13px] leading-6 text-ink/56">{option.subtitle}</p>
                </div>
                <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-clay bg-clay text-white" : "border-ink/16"}`}>
                  {active ? <Check size={13} aria-hidden="true" /> : null}
                </span>
              </div>
              <SpreadMini count={option.count} />
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-full border border-ink/12 text-[13px] uppercase tracking-[0.12em] text-ink/58">
          取消
        </button>
        <button type="button" onClick={onNext} className="h-12 flex-1 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft">
          下一步
        </button>
      </div>
    </div>
  );
}

function QuestionStep({
  spreadType,
  question,
  error,
  onQuestionChange,
  onBack,
  onSubmit
}: {
  spreadType: SpreadType;
  question: string;
  error: string;
  onQuestionChange: (question: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="py-6">
      <p className="text-[12px] uppercase tracking-[0.2em] text-clay/68">{spreadType === "three_card" ? "Three Cards" : "Five-card Linear"}</p>
      <h1 className="mt-3 font-serif text-[32px] leading-tight text-ink">你现在最想知道什么？</h1>
      <p className="mt-4 text-[14px] leading-6 text-ink/58">一个明确的问题通常比多个问题放在一起更容易得到清晰的牌面。</p>

      <textarea
        value={question}
        maxLength={300}
        onChange={(event) => onQuestionChange(event.target.value)}
        placeholder="例如：最近1个月会有什么好消息？"
        rows={7}
        className="mt-7 w-full resize-none rounded-[6px] border border-ink/12 bg-[#FFFDF8]/82 px-4 py-4 text-[16px] leading-7 outline-none shadow-entry focus:border-ink/35"
      />
      <div className="mt-2 flex items-center justify-between text-[12px] text-ink/38">
        <span>{error}</span>
        <span>{question.length}/300</span>
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} className="h-12 flex-1 rounded-full border border-ink/12 text-[13px] uppercase tracking-[0.12em] text-ink/58">
          返回
        </button>
        <button type="button" onClick={onSubmit} className="h-12 flex-1 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft">
          开始占卜
        </button>
      </div>
    </div>
  );
}

function DrawingState({ spreadType, cards }: { spreadType: SpreadType; cards: ReadingWithCards["cards"] }) {
  const count = spreadType === "three_card" ? 3 : 5;
  const [phase, setPhase] = useState<DrawingPhase>("shuffle");

  useEffect(() => {
    setPhase("shuffle");
    const timers = [
      window.setTimeout(() => setPhase("draw"), 1200),
      window.setTimeout(() => setPhase("interpret"), 2800),
      window.setTimeout(() => setPhase("reveal"), 4300)
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [cards]);

  const drawnCards = cards.slice(0, count);

  return (
    <div className="flex flex-1 items-center py-10">
      <section className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-6 text-center shadow-paper">
        <div className="relative mx-auto flex h-[184px] w-full max-w-[320px] items-center justify-center overflow-hidden">
          {phase === "shuffle" ? (
            <div className="relative h-full w-full">
              {Array.from({ length: 16 }).map((_, index) => (
                <CardBackMini
                  key={index}
                  className="absolute h-[104px] w-[68px] animate-pulse"
                  style={{
                    left: `${18 + (index % 8) * 8}%`,
                    top: `${20 + (index % 3) * 14}%`,
                    transform: `translate(-50%, -50%) rotate(${(index % 2 === 0 ? -1 : 1) * (8 + index * 3)}deg)`,
                    animationDelay: `${index * 70}ms`
                  }}
                />
              ))}
            </div>
          ) : null}

          {phase === "draw" || phase === "interpret" ? (
            <div className={`reading-card-scroll w-full overflow-x-auto pb-2 ${count === 5 ? "" : "flex justify-center"}`}>
              <div className={`mx-auto flex min-w-max items-center justify-center ${count === 5 ? "gap-1.5 px-2" : "gap-3"}`}>
              {Array.from({ length: count }).map((_, index) => (
                <CardBackMini
                  key={index}
                  className={`${count === 5 ? "h-[112px] w-[72px]" : "h-[124px] w-[80px]"} animate-[cardDraw_520ms_ease-out_both]`}
                  style={{ animationDelay: `${index * 180}ms` }}
                />
              ))}
              </div>
            </div>
          ) : null}

          {phase === "reveal" ? (
            <div className={`reading-card-scroll w-full overflow-x-auto pb-2 ${count === 5 ? "" : "flex justify-center"}`}>
              <div className={`mx-auto flex min-w-max items-center justify-center ${count === 5 ? "gap-1.5 px-2" : "gap-3"}`}>
              {drawnCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`${count === 5 ? "h-[112px] w-[72px]" : "h-[124px] w-[80px]"} overflow-hidden rounded-[4px] border border-ink/12 bg-[#FFFDF8] shadow-entry animate-[cardFlip_640ms_ease-out_both]`}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <img src={getLenormandCardImagePath(card.cardNumber, card.cardSlug)} alt={`${card.nameEn} / ${card.nameZh}`} className="h-full w-full object-fill [-webkit-touch-callout:default]" />
                </div>
              ))}
              </div>
            </div>
          ) : null}

          {phase === "interpret" ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative mt-[150px] flex items-center gap-2 text-clay/70">
                <Sparkles size={17} className="animate-pulse" aria-hidden="true" />
                <span className="text-[13px] uppercase tracking-[0.2em]">正在解读中</span>
                <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-6 font-serif text-[26px] leading-tight text-ink">
          {phase === "shuffle" ? "洗牌中" : phase === "draw" ? "正在抽牌" : phase === "interpret" ? "正在解读" : "牌面已显现"}
        </p>
        <p className="mt-3 text-[14px] leading-6 text-ink/54">
          {phase === "shuffle" ? "让牌面重新排列，聚焦你的问题。" : phase === "draw" ? "属于这次问题的牌正在被抽出。" : phase === "interpret" ? "正在结合牌面与项目记忆生成解读。" : "解读完成后会进入结果。"}
        </p>
      </section>
    </div>
  );
}

function ReadingCardFace({ card, compact = false }: { card: ReadingWithCards["cards"][number]; compact?: boolean }) {
  return (
    <div className={`${compact ? "h-[132px] w-[88px]" : "h-[150px] w-[98px]"} shrink-0 overflow-hidden rounded-[5px] border border-ink/12 bg-[#FFFDF8] shadow-entry`}>
      <img src={getLenormandCardImagePath(card.cardNumber, card.cardSlug)} alt={`${card.nameEn} / ${card.nameZh} - ${card.position}`} className="h-full w-full object-fill [-webkit-touch-callout:default]" />
    </div>
  );
}

function ReadingChapter({ reading }: { reading: ReadingWithCards }) {
  const paragraphs = reading.interpretation.split("\n\n").filter(Boolean);
  const cardSaveHandlers = useCardSpreadLongPressSave(
    () =>
      reading.cards.map((card) => ({
        src: getLenormandCardImagePath(card.cardNumber, card.cardSlug),
        label: `${card.nameEn} / ${card.nameZh}`
      })),
    `deep-reading-${reading.id}.png`
  );

  return (
    <article className="border-b border-ink/10 py-8">
      <p className="text-[12px] uppercase tracking-[0.17em] text-ink/36">{formatProjectDate(reading.createdAt)}</p>
      <h2 className="mt-3 font-serif text-[27px] leading-tight text-ink">{reading.spreadType === "three_card" ? "Three Cards" : "Five-card Linear"}</h2>
      <p className="mt-3 text-[16px] leading-7 text-ink/72">“{reading.question}”</p>

      <div {...cardSaveHandlers} className="reading-card-scroll mt-6 overflow-x-auto pb-3">
        <div className={`flex w-max min-w-full ${reading.cards.length === 3 ? "justify-center gap-3" : "gap-3 px-1"}`}>
          {reading.cards.map((card) => (
            <ReadingCardFace key={card.id} card={card} compact={reading.cards.length === 5} />
          ))}
        </div>
      </div>

      <section className="mt-7">
        <p className="text-[12px] uppercase tracking-[0.17em] text-clay/64">核心结论</p>
        <p className="mt-3 font-serif text-[22px] leading-8 text-ink">
          {reading.status === "failed"
            ? "这次解读暂时没有生成成功，但你的问题和抽到的牌已经保留。"
            : reading.status === "quota_limited"
              ? "已为你抽出牌面。今日免费 AI 深度解读次数已用完，明天 00:00 后刷新。你仍可以长按保存牌面。"
            : reading.status === "generating"
              ? "正在生成真实 Deep Reading 解读，请稍候。"
              : reading.coreConclusion}
        </p>
      </section>

      {reading.status === "completed" ? (
        <section className="mt-7 space-y-4 text-[16px] leading-8 text-ink/72">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ) : null}

      {reading.timeWindow || reading.uncertainty ? (
        <section className="mt-7 rounded-[5px] border border-ink/8 bg-ivory/58 p-4 text-[13px] leading-6 text-ink/52">
          {reading.timeWindow ? <p>时间：{reading.timeWindow}</p> : null}
          {reading.uncertainty ? <p className="mt-2">边界：{reading.uncertainty}</p> : null}
        </section>
      ) : null}
    </article>
  );
}

function FollowUpChat({ reading }: { reading: ReadingWithCards }) {
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [quota, setQuota] = useState(() => getFollowUpQuota(reading.id));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function refreshMessages() {
    setMessages(await loadFollowUpMessages(reading.id));
    setQuota(getFollowUpQuota(reading.id));
  }

  useEffect(() => {
    void refreshMessages();
  }, [reading.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (!content) {
      setError("先写下你想追问的内容。");
      return;
    }

    setDraft("");
    setError("");
    setSending(true);

    try {
      await sendFollowUpMessage({ readingId: reading.id, content });
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.name === "QuotaExceededError" ? submitError.message : "这次回复没有生成成功，你的问题已保留。");
    } finally {
      setSending(false);
      void refreshMessages();
    }
  }

  return (
    <section className="border-b border-ink/10 pb-8 pt-1">
      <div className="rounded-[6px] border border-ink/8 bg-[#FFFDF8]/72 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.17em] text-clay/64">Follow-up Chat</p>
            <p className="mt-1 text-[13px] leading-5 text-ink/48">围绕这次牌面继续追问，今日免费剩余 {quota.remaining}/{quota.limit} 次。</p>
            <p className="mt-1 text-[12px] leading-5 text-ink/36">每日 {quota.resetLabel} 后刷新。</p>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-clay/16 bg-[#F5F1E8] text-clay/70">
            <Send size={15} aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {messages.length ? (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[86%] whitespace-pre-wrap rounded-[6px] px-4 py-3 text-[14px] leading-6 ${
                    message.role === "user" ? "bg-[#6E2638] text-[#FFF9F2]" : "border border-ink/8 bg-ivory/64 text-ink/66"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-[5px] border border-dashed border-ink/12 px-4 py-3 text-[13px] leading-6 text-ink/42">
              可以问“他现在的态度更像哪张牌？”或“这个结论落到行动上该怎么理解？”
            </p>
          )}

          {sending ? <p className="text-[13px] leading-6 text-ink/42">正在结合这次牌面回复...</p> : null}
          {error ? <p className="text-[13px] leading-6 text-[#8E4D4A]">{error}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
          <textarea
            value={draft}
            maxLength={500}
            rows={2}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
            placeholder="继续追问这次解读..."
            disabled={sending}
            className="min-h-[48px] flex-1 resize-none rounded-[5px] border border-ink/12 bg-white/72 px-3 py-3 text-[14px] leading-5 outline-none focus:border-ink/35 disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={sending}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#6E2638] text-[#FFF9F2] shadow-soft disabled:opacity-50"
          >
            <Send size={17} aria-hidden="true" />
            <span className="sr-only">发送追问</span>
          </button>
        </form>
      </div>
    </section>
  );
}

function Timeline({ readings, generatingReadingId, onNewReading, onRetryReading }: { readings: ReadingWithCards[]; generatingReadingId: string | null; onNewReading: () => void; onRetryReading: (readingId: string) => void }) {
  return (
    <div className="pb-28 pt-3">
      <button
        type="button"
        onClick={onNewReading}
        className="sticky top-[76px] z-20 mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft"
      >
        <Plus size={16} aria-hidden="true" />
        继续占卜
      </button>

      {readings.map((reading) => (
        <div key={reading.id}>
          <ReadingChapter reading={reading} />
          {reading.status === "completed" ? <FollowUpChat reading={reading} /> : null}
          {reading.status === "failed" ? (
            <button
              type="button"
              onClick={() => onRetryReading(reading.id)}
              disabled={generatingReadingId === reading.id}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-full border border-ink/12 bg-[#FFFDF8]/70 text-[13px] uppercase tracking-[0.12em] text-ink/64 disabled:opacity-50"
            >
              {generatingReadingId === reading.id ? "正在重新生成" : "重试生成解读"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReadingWorkspace({
  project,
  readings,
  onReadingsChange
}: {
  project: DeepProject;
  readings: ReadingWithCards[];
  onReadingsChange: () => void;
}) {
  const [step, setStep] = useState<ReadingFlowStep>("idle");
  const [spreadType, setSpreadType] = useState<SpreadType>("three_card");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [quotaMessage, setQuotaMessage] = useState("");
  const [generatingReadingId, setGeneratingReadingId] = useState<string | null>(null);
  const [drawingReading, setDrawingReading] = useState<ReadingWithCards | null>(null);
  const quota = getDeepReadingQuota();

  async function generateAndRefresh(readingId: string) {
    setGeneratingReadingId(readingId);
    try {
      await generateDeepReading(readingId);
    } catch {
      // The reading is already marked failed or cards-only; the timeline will show the right state.
    } finally {
      setGeneratingReadingId(null);
      onReadingsChange();
    }
  }

  function startReading() {
    setStep("spread");
    setError("");
    setQuotaMessage(quota.remaining <= 0 ? "今日免费 AI 深度解读次数已用完。你仍然可以抽牌和保存牌面，明天 00:00 后刷新。" : "");
  }

  function submitQuestion() {
    if (!question.trim()) {
      setError("请先写下你这次想问的问题。");
      return;
    }

    setStep("drawing");
    setTimeout(() => {
      void (async () => {
      let reading: ReadingWithCards;
      try {
        reading = await saveReading({ projectId: project.id, spreadType, question });
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "今日免费额度已用完，明天 00:00 后刷新。");
        setStep("question");
        return;
      }
      setQuestion("");
      setError("");
      setStep("idle");
      onReadingsChange();
      void generateAndRefresh(reading.id);
      })();
    }, 900);
  }

  async function submitQuestionWithAnimation() {
    const submittedQuestion = question.trim();

    if (!submittedQuestion) {
      setError("请先写下你这次想问的问题。");
      return;
    }

    let reading: ReadingWithCards;
    try {
      reading = await saveReading({ projectId: project.id, spreadType, question: submittedQuestion });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "今日免费额度已用完，明天 00:00 后刷新。");
      return;
    }
    const minimumAnimation = wait(5400);

    setDrawingReading(reading);
    setQuestion("");
    setError("");
    setStep("drawing");
    setGeneratingReadingId(reading.id);

    void (async () => {
      try {
        await Promise.all([generateDeepReading(reading.id), minimumAnimation]);
      } catch {
        await minimumAnimation;
      } finally {
        setGeneratingReadingId(null);
        setDrawingReading(null);
        setStep("idle");
        onReadingsChange();
      }
    })();
  }

  if (step === "spread") {
    return <SpreadSelection selectedSpread={spreadType} onSelect={setSpreadType} onNext={() => setStep("question")} onCancel={() => setStep("idle")} />;
  }

  if (step === "question") {
    return (
      <QuestionStep
        spreadType={spreadType}
        question={question}
        error={error}
        onQuestionChange={(value) => {
          setQuestion(value);
          setError("");
        }}
        onBack={() => setStep("spread")}
        onSubmit={() => void submitQuestionWithAnimation()}
      />
    );
  }

  if (step === "drawing") {
    return <DrawingState spreadType={spreadType} cards={drawingReading?.cards ?? []} />;
  }

  if (!readings.length) {
    return (
      <>
        <ProjectMemory project={project} onSaved={onReadingsChange} />
        <QuotaNotice quota={quota} message={quotaMessage} />
        <EmptyState project={project} onStartReading={startReading} />
      </>
    );
  }

  return (
    <>
      <ProjectMemory project={project} onSaved={onReadingsChange} />
      <QuotaNotice quota={quota} message={quotaMessage} />
      <Timeline readings={readings} generatingReadingId={generatingReadingId} onNewReading={startReading} onRetryReading={(readingId) => void generateAndRefresh(readingId)} />
    </>
  );
}

function Shell({
  children,
  title,
  currentProject,
  projects,
  email,
  onProjectsChange
}: {
  children: ReactNode | ShellActionChildren;
  title: string;
  currentProject: DeepProject | null;
  projects: DeepProject[];
  email: string;
  onProjectsChange: () => void;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [selectedProject, setSelectedProject] = useState<DeepProject | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<DeepProject | null>(null);

  function openCreate() {
    setSheetMode("create");
    setSelectedProject(null);
    setDrawerOpen(false);
    setSheetOpen(true);
  }

  function openEdit(project: DeepProject) {
    setSheetMode("edit");
    setSelectedProject(project);
    setDrawerOpen(false);
    setSheetOpen(true);
  }

  function handleLogout() {
    signOut();
    router.replace("/");
  }

  function handleSaved(project: DeepProject) {
    setSheetOpen(false);
    onProjectsChange();
    router.replace(`/deep/project/${project.id}`);
  }

  async function handleDelete(project: DeepProject) {
    const nextProject = await removeProject(project.id);
    setPendingDeleteProject(null);
    setDrawerOpen(false);
    onProjectsChange();
    if (project.id === currentProject?.id) {
      router.replace(nextProject ? `/deep/project/${nextProject.id}` : "/deep");
    }
  }

  return (
    <main className="min-h-dvh bg-paper px-5 text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <MobileHeader title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        {typeof children === "function" ? children({ openCreate }) : children}
      </section>

      <ProjectDrawer
        open={drawerOpen}
        projects={projects}
        currentProjectId={currentProject?.id}
        email={email}
        onClose={() => setDrawerOpen(false)}
        onNewProject={openCreate}
        onEditProject={openEdit}
        onDeleteProject={(project) => setPendingDeleteProject(project)}
        onLogout={handleLogout}
      />
      <ProjectSheet
        open={sheetOpen}
        mode={sheetMode}
        initialProject={sheetMode === "edit" ? selectedProject : null}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
      />
      <>
        <button
          type="button"
          aria-label="关闭删除确认"
          onClick={() => setPendingDeleteProject(null)}
          className={`fixed inset-0 z-50 bg-ink/16 transition-opacity ${pendingDeleteProject ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
        <section
          aria-label="删除项目确认"
          className={`fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px] rounded-t-[18px] border border-ink/10 bg-[#FFFDF8] px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-paper transition-transform duration-300 ${
            pendingDeleteProject ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink/14" />
          <h2 className="font-serif text-[24px] leading-tight text-ink">删除这个项目？</h2>
          <p className="mt-3 text-[14px] leading-6 text-ink/58">
            {pendingDeleteProject ? `「${pendingDeleteProject.title}」和其中所有占卜记录都会被移除。` : ""}
          </p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setPendingDeleteProject(null)} className="h-12 flex-1 rounded-full border border-ink/12 text-[13px] uppercase tracking-[0.12em] text-ink/58">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDeleteProject) void handleDelete(pendingDeleteProject);
              }}
              className="h-12 flex-1 rounded-full bg-[#8E4D4A] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2]"
            >
              删除项目
            </button>
          </div>
        </section>
      </>
    </main>
  );
}

export function DeepLandingClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, email } = useDeepSession(pathname);
  const [projects, setProjects] = useState<DeepProject[]>([]);

  function refresh() {
    void loadProjects().then(setProjects);
  }

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const loadedProjects = await loadProjects();
      setProjects(loadedProjects);

      if (loadedProjects[0]) {
        router.replace(`/deep/project/${loadedProjects[0].id}`);
      }
    })();
  }, [ready, router]);

  const currentTitle = useMemo(() => "Deep Reading", []);

  if (!ready) {
    return <main className="min-h-dvh bg-paper" />;
  }

  return (
    <Shell title={currentTitle} currentProject={null} projects={projects} email={email} onProjectsChange={refresh}>
      {({ openCreate }) => <EmptyState onCreateProject={openCreate} />}
    </Shell>
  );
}

export function DeepProjectPageClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, email } = useDeepSession(pathname);
  const [projects, setProjects] = useState<DeepProject[]>([]);
  const [project, setProject] = useState<DeepProject | null>(null);
  const [readings, setReadings] = useState<ReadingWithCards[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);

  function refresh() {
    void (async () => {
      const [loadedProjects, loadedProject, loadedReadings] = await Promise.all([loadProjects(), loadProject(projectId), loadReadings(projectId)]);
      setProjects(loadedProjects);
      setProject(loadedProject);
      setReadings(loadedReadings);
      setNotFound(!loadedProject);
    })();
  }

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const loadedProject = await loadProject(projectId);

      if (!loadedProject) {
        setNotFound(true);
        setProjects(await loadProjects());
        return;
      }

      await saveProjectTouch(projectId);
      const [refreshedProject, loadedProjects, loadedReadings] = await Promise.all([loadProject(projectId), loadProjects(), loadReadings(projectId)]);
      setProject(refreshedProject);
      setProjects(loadedProjects);
      setReadings(loadedReadings);
      setNotFound(false);
    })();
  }, [projectId, ready]);

  if (!ready) {
    return <main className="min-h-dvh bg-paper" />;
  }

  if (notFound) {
    return (
      <main className="min-h-dvh bg-paper px-5 text-ink">
        <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center">
          <div className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-6 text-center shadow-paper">
            <h1 className="font-serif text-[30px] leading-tight">找不到这个项目</h1>
            <p className="mt-4 text-[14px] leading-6 text-ink/56">它可能已被删除，或不属于当前登录邮箱。</p>
            <Link href="/deep" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#6E2638] px-6 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2]">
              返回 Deep Reading
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <Shell title={project?.title ?? "Deep Reading"} currentProject={project} projects={projects} email={email} onProjectsChange={refresh}>
      {project ? <ReadingWorkspace project={project} readings={readings} onReadingsChange={refresh} /> : null}
    </Shell>
  );
}
