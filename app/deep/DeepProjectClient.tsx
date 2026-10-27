"use client";

import { replaceSiteRoute } from "@/lib/public-routes";

import Link from "@/components/SiteLink";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Copy, Menu, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { getLenormandCardImagePath, preloadLenormandCardImages } from "@/lib/lenormand-cards";
import { useCardSpreadLongPressSave } from "@/lib/use-card-spread-save";
import { paidOnlineSiteEnabled, paidLocalAIEnabled, paidSiteEnabled, paidSiteRequest, restorePaidSiteSession } from "@/lib/paid-local/site-bridge";
import { getDeepSpread } from "@/lib/deep-spreads";
import { SpreadLayout } from "@/components/deep/SpreadLayout";
import { AIGeneratedLabel, ServiceNotice } from "@/components/ServiceNotice";
import serviceNotices from "@/lib/service-notices.json";
import { DivinationExperience } from "@/components/deep/DivinationExperience";
import { AccountMenu, PetalTopUp } from "@/components/AccountMenu";
import {
  DeepProject,
  DeepQuota,
  FollowUpMessage,
  ReadingWithCards,
  buildExternalReadingPrompt,
  formatProjectDate,
  generateDeepReading,
  loadDeepReadingQuota,
  getFollowUpQuota,
  getRuleEngineOwnerTrialAccess,
  getSession,
  loadFollowUpMessages,
  loadProject,
  loadProjects,
  loadReadings,
  loadReadingsPage,
  removeProject,
  saveProject,
  saveProjectTouch,
  saveProjectUpdate,
  sendFollowUpMessage,
  signOut,
} from "@/lib/project-store";

type SheetMode = "create" | "edit";
type ReadingFlowStep = "idle" | "drawing";
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
    let cancelled = false;
    void (async () => {
      const session = paidSiteEnabled ? await restorePaidSiteSession() : getSession();
      if (cancelled) return;
      if (!session) { router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`); return; }
      setEmail(session.email); setReady(true);
    })();
    return () => { cancelled = true; };
  }, [returnTo, router]);

  return { ready, email };
}

function isAuthLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("登录") || message.includes("Not signed in") || message.includes("401");
}

function getDeepLoadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (isAuthLoadError(error)) {
    return "登录状态已过期，请重新登录后再进入 Deep Reading。";
  }

  if (message.includes("AbortError") || message.includes("aborted") || message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "网络连接有点慢，Deep Reading 暂时没有读取成功。";
  }

  return "Deep Reading 暂时没有读取成功，请稍后再试。";
}

function DeepLoadState({
  title,
  message,
  actionLabel,
  onAction
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="min-h-dvh bg-paper px-5 text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center">
        <div className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-6 text-center shadow-paper">
          <h1 className="font-serif text-[30px] leading-tight">{title}</h1>
          <p className="mt-4 text-[14px] leading-6 text-ink/56">{message}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#6E2638] px-6 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2]"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
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
      <Link prefetch={false}
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
        className={`fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[18px] border border-ink/10 bg-[#FFFDF8] px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-paper transition-transform duration-300 ${
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
    <header className="sticky top-0 z-30 -mx-4 flex h-[64px] shrink-0 items-center justify-between border-b border-ink/8 bg-paper/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <button type="button" onClick={onOpenDrawer} className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-ivory/72 text-ink/68">
        <Menu size={19} aria-hidden="true" />
        <span className="sr-only">打开项目抽屉</span>
      </button>
      <p className="mx-3 min-w-0 flex-1 truncate text-center font-serif text-[19px] leading-none text-ink">{title}</p>
      <AccountMenu />
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
          {isProjectPage ? "这个项目还没有任何解读记录。从一个你现在最想知道的问题开始。" : "把一个长期在意的主题放进这里，之后每次回来都能接着这个故事。"}
        </p>

        {isProjectPage ? (
          <button
            type="button"
            onClick={onStartReading}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6E2638] text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft"
          >
            <Check size={16} aria-hidden="true" />
            开始第一次解读
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
    <section className="max-h-[max(3rem,calc(100dvh-320px))] shrink-0 overflow-y-auto py-2">
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-[6px] border border-ink/8 bg-[#FFFDF8]/72">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-[46px] w-full items-center justify-between gap-4 px-4 py-3 text-left"
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

function QuotaNotice({ quota, message, readingId }: { quota: DeepQuota | null; message?: string; readingId?: string }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-b border-ink/8 py-1 text-xs text-ink/45">
      <span>{paidSiteEnabled ? "DEEP READING" : "Daily Free"}</span>
      <div className="flex items-center gap-2">
        <span aria-live="polite">{quota ? paidSiteEnabled ? `${quota.remaining} 花瓣可用` : `今日剩余 ${quota.remaining} 次` : "同步余额中…"}</span>
        {paidSiteEnabled && <PetalTopUp readingId={readingId} />}
      </div>
      {message && <p role="status" className="w-full pb-2 leading-5 text-[#8E4D4A]">{message}</p>}
    </div>
  );
}

function ReadingChapter({ reading, onUnlock, unlocking = false }: { reading: ReadingWithCards; onUnlock?: () => Promise<void>; unlocking?: boolean }) {
  const paragraphs = reading.interpretation.split("\n\n").filter(Boolean);
  const [copyState, setCopyState] = useState<"idle" | "current" | "recent" | "failed">("idle");
  const [unlockError, setUnlockError] = useState("");
  const isVerifiedRuleReading = reading.interpretationSource === "rule_engine" && Boolean(reading.ruleEngineVersion) && Boolean(reading.ruleEngineResult);
  const isLocalRealAI = paidSiteEnabled && (paidOnlineSiteEnabled || Boolean(reading.generationModel) && reading.generationModel !== "local_mock");
  const cardSaveHandlers = useCardSpreadLongPressSave(
    () =>
      reading.cards.map((card) => ({
        src: getLenormandCardImagePath(card.cardNumber, card.cardSlug),
        label: `${card.nameEn} / ${card.nameZh}`
      })),
    `deep-reading-${reading.id}.png`,
    () =>
      trackAnalyticsEvent("save_cards", {
        surface: "deep",
        readingId: reading.id,
        projectId: reading.projectId,
        spreadType: reading.spreadType,
        status: reading.status,
        interpretationSource: reading.interpretationSource
      })
  );

  async function copyExternalPrompt(includeRecentContext: boolean) {
    try {
      const prompt = await buildExternalReadingPrompt(reading.id, includeRecentContext);
      const disclosure = `${isVerifiedRuleReading ? "规则生成内容" : "AI 生成内容"} · 仅供娱乐与自我探索\n${serviceNotices.purpose}`;
      await navigator.clipboard.writeText(`${disclosure}\n\n${prompt}`);
      trackAnalyticsEvent("copy_prompt", {
        readingId: reading.id,
        projectId: reading.projectId,
        spreadType: reading.spreadType,
        status: reading.status,
        includeRecentContext
      });
      setCopyState(includeRecentContext ? "recent" : "current");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <article className="break-words py-6 sm:py-8" data-reading-id={reading.id}>
      <p className="text-[12px] uppercase tracking-[0.17em] text-ink/36">{formatProjectDate(reading.createdAt)}</p>
      <h2 className="mt-4 whitespace-pre-wrap font-serif text-[27px] leading-relaxed text-ink sm:text-[32px]">{reading.question}</h2>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm leading-6 text-clay/65">{getDeepSpread(reading.spreadType).name}</p>
        <span className="shrink-0 rounded-full border border-ink/10 bg-ivory/70 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-ink/44">
          {paidSiteEnabled ? reading.status === "completed" ? isLocalRealAI ? paidOnlineSiteEnabled ? "AI 生成" : "AI 生成 · 本地测试" : "AI 生成 · 本地模拟预览" : "原牌已保存" : isVerifiedRuleReading ? `Rule-based / ${reading.ruleEngineVersion}` : "AI 生成"}
        </span>
      </div>

      <div {...cardSaveHandlers} className="mt-7 pb-2"><SpreadLayout spreadId={reading.spreadType} cards={reading.cards} choices={reading.choices} /></div>

      <section className="mt-7">
        <p className="text-[12px] uppercase tracking-[0.17em] text-clay/64">核心结论</p>
        <p className="mt-3 font-serif text-[22px] leading-8 text-ink">
          {paidSiteEnabled && reading.status === "drawing" ? "原问题和牌面已保存。解锁后可查看完整主解读，并获得 2 次追问。" : reading.status === "failed"
            ? "这次解读暂时没有生成成功，但你的问题和抽到的牌已经保留。"
            : reading.status === "quota_limited"
              ? paidSiteEnabled ? "解读次数不足，原问题和牌面已保存，获得次数后可以沿用这组牌。" : "已为你抽出牌面。今天的免费 AI 解读次数已经休息了，但牌面仍然完整保留。"
            : reading.status === "generating"
              ? paidSiteEnabled && !paidLocalAIEnabled && !paidOnlineSiteEnabled ? "正在生成本地模拟解读，请稍候。" : "正在生成真实 AI 解读，请稍候。"
              : reading.coreConclusion}
        </p>
      </section>

      {reading.status === "completed" ? (
        <section className="mt-7 space-y-4 text-[16px] leading-8 text-ink/72">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="whitespace-pre-line">{paragraph}</p>
          ))}
          {isVerifiedRuleReading ? <p className="text-sm leading-7 text-ink/65">本次内容由站内规则生成。{serviceNotices.purpose}</p> : <ServiceNotice kind="deep" expanded simulated={paidSiteEnabled && !isLocalRealAI} />}
        </section>
      ) : null}

      {paidSiteEnabled && reading.status !== "completed" ? (
        <section className="mt-7 rounded-[6px] border border-clay/14 bg-[#FFFDF8]/72 p-4">
          <p className="font-serif text-[20px] leading-7 text-ink">解锁本次深度解读</p>
          <p className="mt-3 text-[14px] leading-6 text-ink/58">使用 1 花瓣，包含完整解读与 2 次追问。</p>
          <Link prefetch={false} href={`/recharge?readingId=${encodeURIComponent(reading.id)}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-[#6E2638] underline underline-offset-4">充值并返回本问题</Link>
          <button disabled={unlocking || reading.status === "generating"} onClick={() => {
            setUnlockError("");
            void onUnlock?.().catch((error: unknown) => setUnlockError(error instanceof Error ? error.message : "解读暂未完成，请重试。"));
          }} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6E2638] text-[13px] text-[#FFF9F2] disabled:opacity-50"><Sparkles size={15} />{unlocking || reading.status === "generating" ? "正在解读…" : "解锁深度解读 · 1 花瓣"}</button>
          {unlockError ? <p role="status" className="mt-3 text-[13px] leading-6 text-[#8E4D4A]">{unlockError}</p> : null}
        </section>
      ) : reading.status === "quota_limited" || reading.status === "failed" ? (
        <section className="mt-7 rounded-[6px] border border-clay/14 bg-[#FFFDF8]/72 p-4">
          <p className="font-serif text-[20px] leading-7 text-ink">{reading.status === "quota_limited" ? "你还可以这样继续" : "这次 AI 没有成功回复"}</p>
          <p className="mt-3 text-[14px] leading-6 text-ink/58">明天北京时间 00:00 后会获得新的免费 AI 解读次数。现在也可以复制 Prompt，去 ChatGPT / Claude / DeepSeek 等模型自行解读。</p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => void copyExternalPrompt(false)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-ivory/76 px-4 text-[13px] uppercase tracking-[0.1em] text-ink/62"
            >
              <Copy size={15} aria-hidden="true" />
              {copyState === "current" ? "已复制本次结果" : copyState === "failed" ? "复制失败，请稍后再试" : "复制本次结果与 Prompt"}
            </button>
            <button
              type="button"
              onClick={() => void copyExternalPrompt(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-[#6E2638]/5 px-4 text-[13px] uppercase tracking-[0.1em] text-ink/62"
            >
              <Copy size={15} aria-hidden="true" />
              {copyState === "recent" ? "已复制近三次上下文" : copyState === "failed" ? "复制失败，请稍后再试" : "复制近三次与 Prompt"}
            </button>
          </div>
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

function ReadingFollowUps({ reading }: { reading: ReadingWithCards }) {
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { setMessages(await loadFollowUpMessages(reading.id)); }, [reading.id]);
  useEffect(() => { let active = true; void loadFollowUpMessages(reading.id).then((value) => { if (active) setMessages(value); }).catch(() => { if (active) setError("追问记录暂时未读取成功，请稍后重试。"); }); return () => { active = false; }; }, [reading.id]);
  const used = messages.filter((message) => message.role === "assistant" && !message.content.startsWith("这次追问暂时没有生成成功")).length;
  const remaining = reading.legacyRestored ? 0 : Math.max(getFollowUpQuota(reading.id).limit - used, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !draft.trim() || remaining <= 0) return;
    setBusy(true); setError("");
    try { await sendFollowUpMessage({ readingId: reading.id, content: draft.trim() }); setDraft(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "追问未完成，请稍后重试。"); }
    finally { setBusy(false); }
  }
  return <section className="border-t border-ink/10 pb-6 pt-4" aria-label="这次解读的附属追问">
    <details open={messages.length > 0 || undefined}>
      <summary className="cursor-pointer py-2 text-sm text-[#6E2638]">{reading.legacyRestored ? "旧站追问记录 · 仅供回看" : `围绕这次解读追问 · 剩余 ${remaining} 次`}</summary>
      <div className="mt-3 space-y-4">{messages.map((message, index) => <div key={message.id} className={message.role === "user" ? "border-l-2 border-[#6E2638]/30 pl-3" : "pl-3"}>
        {message.role === "user" && <p className="mb-1 text-xs text-clay/65">追问 {Math.floor(index / 2) + 1}</p>}
        {message.role === "assistant" && <div className="mb-2"><AIGeneratedLabel followUp simulated={paidSiteEnabled && !paidOnlineSiteEnabled && !paidLocalAIEnabled} /></div>}
        <p className={`whitespace-pre-wrap break-words text-sm leading-7 ${message.role === "user" ? "text-ink/85" : "text-ink/65"}`}>{message.content}</p>
      </div>)}</div>
      {messages.some(message => message.role === "assistant") && <p aria-label="追问内容说明" className="mt-4 border-t border-sage/15 pt-3 text-[13px] leading-7 text-ink/60">{serviceNotices.short}</p>}
      {remaining > 0 && <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-xl border border-ink/12 bg-paper/60 p-3">
        <label htmlFor={`follow-${reading.id}`} className="sr-only">追问这次解读</label><textarea id={`follow-${reading.id}`} value={draft} rows={2} maxLength={paidSiteEnabled ? 300 : 500} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder="针对上面的牌面，再问一个具体问题…" className="w-full resize-y bg-transparent text-base leading-6 outline-none" />
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-ink/40">沿用本次原牌，{paidSiteEnabled ? "不再扣花瓣。" : "继续解读。"}</p><button type="submit" disabled={busy || !draft.trim()} className="min-h-10 shrink-0 rounded-full bg-[#6E2638] px-4 text-xs text-[#FFF9F2] disabled:opacity-40">{busy ? "正在回复…" : "发送追问"}</button></div>
      </form>}
      {error && <p role="alert" className="mt-3 text-sm text-[#8E4D4A]">{error}</p>}
    </details>
  </section>;
}

function ReadingWorkspace({ project, readings, onReadingsChange, onLoadEarlier, loadingEarlier }: { project: DeepProject; readings: ReadingWithCards[]; onReadingsChange: () => void; onLoadEarlier?: () => void; loadingEarlier?: boolean }) {
  const [view, setView] = useState<"compose" | "history">("compose");
  const [quota, setQuota] = useState<DeepQuota | null>(null);
  const [notice, setNotice] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ruleEngineTrialAllowed, setRuleEngineTrialAllowed] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...readings].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)), [readings]);
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("view") === "history") setView("history"); const id = params.get("reading"); if (id && readings.some(item => item.id === id)) setActiveId(id); }, [readings]);
  useEffect(() => { let active = true; void loadDeepReadingQuota().then((value) => { if (active) setQuota(value); }).catch(() => { if (active) setNotice("暂时无法读取花瓣余额，解读前会重新核验。"); }); return () => { active = false; }; }, [readings, generatingId]);
  useEffect(() => { let active = true; void getRuleEngineOwnerTrialAccess().then((value) => { if (active) setRuleEngineTrialAllowed(value.allowed); }); return () => { active = false; }; }, []);
  const latestId = ordered.at(-1)?.id;
  useEffect(() => {
    if (view !== "history") { if (scroll.current) scroll.current.scrollTop = 0; return; }
    const id = activeId || latestId;
    requestAnimationFrame(() => { const chapter = scroll.current?.querySelector(`[data-reading-id="${id}"]`); if (chapter && scroll.current) scroll.current.scrollTop = (chapter as HTMLElement).offsetTop - scroll.current.offsetTop - 10; });
  }, [view, activeId, latestId]);
  const generatingKey = readings.filter(reading => reading.status === "generating").map(reading => reading.id).sort().join(",");
  useEffect(() => {
    if (view !== "history" || !generatingKey) return;
    let attempts = 0, timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      if (document.visibilityState === "visible") { onReadingsChange(); attempts++; }
      if (attempts < 6) timer = setTimeout(poll, Math.min(60_000, 15_000 * 2 ** attempts));
      else setNotice("解读状态暂未更新，可点击重新读取。不会自动重复生成或扣除花瓣。");
    };
    timer = setTimeout(poll, 15_000);
    return () => clearTimeout(timer);
  }, [view, generatingKey, onReadingsChange]);
  async function unlock(id: string) {
    setNotice("");
    setGeneratingId(id);
    try { await generateDeepReading(id); }
    finally { setGeneratingId(null); onReadingsChange(); }
  }
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="relative z-20 shrink-0"><QuotaNotice quota={quota} message={notice} readingId={activeId || latestId} />{view === "history" && <ProjectMemory project={project} onSaved={onReadingsChange} />}</div>
    <div ref={scroll} data-divination-scroll="true" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10 [scrollbar-gutter:stable]" aria-label={view === "compose" ? "开始深度解读" : "项目解读记录"}>
      {view === "compose" ? <DivinationExperience key={project.id} projectId={project.id} historyCount={readings.length} ruleEngineTrialAllowed={ruleEngineTrialAllowed} onHistory={() => setView("history")} onComplete={(id, message) => { setActiveId(id); setNotice(message || ""); setView("history"); onReadingsChange(); }} /> : <div className="mx-auto w-full max-w-[760px] px-1 sm:px-4">
        <div className="flex items-center justify-between gap-3 py-5"><p className="text-xs text-ink/45">按时间排列 · 最新问题在下方</p><button type="button" onClick={() => setView("compose")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#6E2638] px-5 text-sm text-[#FFF9F2]"><Plus size={15} />新的解读</button></div>
        {onLoadEarlier && <button type="button" disabled={loadingEarlier} onClick={onLoadEarlier} className="mb-5 min-h-11 w-full rounded-full border border-ink/15 text-sm text-ink/60 disabled:opacity-50">{loadingEarlier ? "正在读取…" : "查看更早的解读"}</button>}
        {ordered.map((reading) => <div key={reading.id} id={`reading-${reading.id}`} className="mb-6 rounded-xl border border-ink/10 bg-[#FFFDF8]/70 px-4 shadow-sm sm:px-7"><ReadingChapter reading={reading} onUnlock={() => unlock(reading.id)} unlocking={generatingId === reading.id} />{reading.status === "completed" && <ReadingFollowUps reading={reading} />}</div>)}
        {notice && <button type="button" onClick={onReadingsChange} className="mb-4 min-h-11 text-sm text-[#6E2638] underline">重新读取解读与余额</button>}
        {!ordered.length && <EmptyState project={project} onStartReading={() => setView("compose")} />}
        <button type="button" onClick={() => setView("compose")} className="mx-auto mb-3 mt-3 flex min-h-12 items-center gap-2 rounded-full border border-[#6E2638]/25 px-7 text-sm text-[#6E2638]"><Plus size={15} />带着新问题，再抽一次牌</button>
      </div>}
    </div>
  </div>;
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
    replaceSiteRoute(router, "/");
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
    <main className="h-dvh overflow-hidden bg-paper px-4 text-ink sm:px-6">
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[960px] flex-col">
        <MobileHeader title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        {typeof children === "function" ? children({ openCreate }) : children}
      </section>

      {drawerOpen && <ProjectDrawer
        open={drawerOpen}
        projects={projects}
        currentProjectId={currentProject?.id}
        email={email}
        onClose={() => setDrawerOpen(false)}
        onNewProject={openCreate}
        onEditProject={openEdit}
        onDeleteProject={(project) => setPendingDeleteProject(project)}
        onLogout={handleLogout}
      />}
      {sheetOpen && <ProjectSheet
        open={sheetOpen}
        mode={sheetMode}
        initialProject={sheetMode === "edit" ? selectedProject : null}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
      />}
      {pendingDeleteProject && <>
        <button
          type="button"
          aria-label="关闭删除确认"
          onClick={() => setPendingDeleteProject(null)}
          className={`fixed inset-0 z-50 bg-ink/16 transition-opacity ${pendingDeleteProject ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
        <section
          aria-label="删除项目确认"
          className={`fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[18px] border border-ink/10 bg-[#FFFDF8] px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-paper transition-transform duration-300 ${
            pendingDeleteProject ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink/14" />
          <h2 className="font-serif text-[24px] leading-tight text-ink">删除这个项目？</h2>
          <p className="mt-3 text-[14px] leading-6 text-ink/58">
            {pendingDeleteProject ? `「${pendingDeleteProject.title}」和其中所有解读记录都会被移除。` : ""}
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
      </>}
    </main>
  );
}

export function DeepLandingClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, email } = useDeepSession(pathname);
  const [projects, setProjects] = useState<DeepProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  function refresh() {
    void loadProjects()
      .then((loadedProjects) => {
        setProjects(loadedProjects);
        setLoadError("");
      })
      .catch((error) => {
        setLoadError(getDeepLoadErrorMessage(error));
      });
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError("");

      try {
        const loadedProjects = await loadProjects();
        if (cancelled) return;

        setProjects(loadedProjects);

        if (loadedProjects[0]) {
          router.replace(`/deep/project/${loadedProjects[0].id}`);
        } else if (paidSiteEnabled) {
          const project = await paidSiteRequest<DeepProject>("project-default", {});
          if (!cancelled) router.replace(`/deep/project/${project.id}`);
        }
      } catch (error) {
        if (cancelled) return;

        if (isAuthLoadError(error)) {
          signOut();
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }

        setLoadError(getDeepLoadErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, ready, router]);

  const currentTitle = useMemo(() => "Deep Reading", []);

  if (!ready) {
    return <main className="min-h-dvh bg-paper" />;
  }

  if (loading) {
    return <DeepLoadState title="正在进入 Deep Reading" message="正在读取你的项目，请稍候。" />;
  }

  if (loadError) {
    return <DeepLoadState title="暂时没有读取成功" message={loadError} actionLabel="重新读取" onAction={refresh} />;
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
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const readingLoad = useRef(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    preloadLenormandCardImages();
  }, []);

  function refresh() {
    void (async () => {
      try {
        const [loadedProjects, loadedProject, page] = await Promise.all([loadProjects(), loadProject(projectId), loadReadingsPage(projectId)]);
        setProjects(loadedProjects);
        setProject(loadedProject);
        setReadings(page.items); setHistoryCursor(page.nextCursor);
        setNotFound(!loadedProject);
        setLoadError("");
      } catch (error) {
        if (isAuthLoadError(error)) {
          signOut();
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }

        setLoadError(getDeepLoadErrorMessage(error));
      }
    })();
  }

  const refreshReadings = useCallback(() => {
    if (readingLoad.current) return;
    readingLoad.current = true;
    void loadReadingsPage(projectId).then(page => { setReadings(page.items); setHistoryCursor(page.nextCursor); })
      .catch(() => setLoadError("暂时无法读取解读，请稍后重试。"))
      .finally(() => { readingLoad.current = false; });
  }, [projectId]);
  async function loadEarlier() {
    if (!historyCursor || readingLoad.current) return;
    readingLoad.current = true; setLoadingEarlier(true);
    try {
      const page = await loadReadingsPage(projectId, historyCursor);
      setReadings(current => Array.from(new Map([...current, ...page.items].map(item => [item.id, item])).values())); setHistoryCursor(page.nextCursor);
    } catch { setLoadError("更早的记录暂时无法读取，请重试。"); }
    finally { readingLoad.current = false; setLoadingEarlier(false); }
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError("");

      try {
        const loadedProject = await loadProject(projectId);

        if (cancelled) return;

        if (!loadedProject) {
          setNotFound(true);
          setProjects(await loadProjects());
          return;
        }

        await saveProjectTouch(projectId);
        const [loadedProjects, page] = await Promise.all([loadProjects(), loadReadingsPage(projectId)]);
        if (cancelled) return;

        setProject(loadedProject);
        setProjects(loadedProjects);
        setReadings(page.items); setHistoryCursor(page.nextCursor);
        setNotFound(false);
      } catch (error) {
        if (cancelled) return;

        if (isAuthLoadError(error)) {
          signOut();
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }

        setLoadError(getDeepLoadErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, projectId, ready, router]);

  if (!ready) {
    return <main className="min-h-dvh bg-paper" />;
  }

  if (loading) {
    return <DeepLoadState title="正在进入项目" message="正在读取项目与历史解读，请稍候。" />;
  }

  if (loadError) {
    return <DeepLoadState title="暂时没有读取成功" message={loadError} actionLabel="重新读取" onAction={refresh} />;
  }

  if (notFound) {
    return (
      <main className="min-h-dvh bg-paper px-5 text-ink">
        <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center">
          <div className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-6 text-center shadow-paper">
            <h1 className="font-serif text-[30px] leading-tight">找不到这个项目</h1>
            <p className="mt-4 text-[14px] leading-6 text-ink/56">它可能已被删除，或不属于当前登录邮箱。</p>
            <Link prefetch={false} href="/deep" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#6E2638] px-6 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2]">
              返回 Deep Reading
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <Shell title={project?.title ?? "Deep Reading"} currentProject={project} projects={projects} email={email} onProjectsChange={refresh}>
      {project ? <ReadingWorkspace key={project.id} project={project} readings={readings} onReadingsChange={refreshReadings} onLoadEarlier={historyCursor ? () => void loadEarlier() : undefined} loadingEarlier={loadingEarlier} /> : null}
    </Shell>
  );
}
