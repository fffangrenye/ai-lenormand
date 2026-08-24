"use client";

import { LenormandCard, lenormandCards } from "./lenormand-cards";
import { DeepFollowUpResult, DeepReadingResult, assertDeepFollowUpResult, assertDeepReadingResult } from "./deep-reading-result";

export type AuthSession = {
  email: string;
};

export type DeepProject = {
  id: string;
  userEmail: string;
  title: string;
  background: string;
  memorySummary: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type SpreadType = "three_card" | "five_card_linear";

export type ReadingStatus = "drawing" | "generating" | "completed" | "failed" | "quota_limited";

export type DeepReading = {
  id: string;
  userEmail: string;
  projectId: string;
  question: string;
  spreadType: SpreadType;
  status: ReadingStatus;
  coreConclusion: string;
  interpretation: string;
  timeWindow: string | null;
  uncertainty: string;
  createdAt: string;
  completedAt: string | null;
};

export type DeepReadingCard = {
  id: string;
  readingId: string;
  cardNumber: number;
  cardSlug: string;
  position: string;
  nameEn: string;
  nameZh: string;
};

export type ReadingWithCards = DeepReading & {
  cards: DeepReadingCard[];
};

export type FollowUpMessage = {
  id: string;
  userEmail: string;
  projectId: string;
  readingId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type DeepQuota = {
  used: number;
  limit: number;
  remaining: number;
  resetLabel: string;
};

const SESSION_KEY = "ai-lenormand:auth-session";
const PROJECTS_KEY = "ai-lenormand:deep-projects";
const READINGS_KEY = "ai-lenormand:deep-readings";
const READING_CARDS_KEY = "ai-lenormand:deep-reading-cards";
const FOLLOW_UP_MESSAGES_KEY = "ai-lenormand:deep-follow-up-messages";
export const FREE_DEEP_READING_LIMIT = 5;
export const FREE_FOLLOW_UP_LIMIT = 10;
const FOLLOW_UP_FAILURE_MESSAGE = "这次追问暂时没有生成成功。你的问题已经保留，可以稍后再问一次。";

export class QuotaExceededError extends Error {
  constructor(message = "今日免费额度已用完，明天 00:00 后刷新。") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function now() {
  return new Date().toISOString();
}

function getBeijingDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function emptyQuota(limit: number): DeepQuota {
  return {
    used: 0,
    limit,
    remaining: 0,
    resetLabel: "北京时间 00:00"
  };
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeProject(project: DeepProject): DeepProject {
  return {
    ...project,
    memorySummary: project.memorySummary ?? ""
  };
}

function readAllProjects(): DeepProject[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as DeepProject[]).map(normalizeProject) : [];
  } catch {
    return [];
  }
}

function readAllReadings(): DeepReading[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(READINGS_KEY);
    return raw ? (JSON.parse(raw) as DeepReading[]) : [];
  } catch {
    return [];
  }
}

function writeAllReadings(readings: DeepReading[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(READINGS_KEY, JSON.stringify(readings));
}

function readAllReadingCards(): DeepReadingCard[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(READING_CARDS_KEY);
    return raw ? (JSON.parse(raw) as DeepReadingCard[]) : [];
  } catch {
    return [];
  }
}

function writeAllReadingCards(cards: DeepReadingCard[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(READING_CARDS_KEY, JSON.stringify(cards));
}

function readAllFollowUpMessages(): FollowUpMessage[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(FOLLOW_UP_MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as FollowUpMessage[]) : [];
  } catch {
    return [];
  }
}

function writeAllFollowUpMessages(messages: FollowUpMessage[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FOLLOW_UP_MESSAGES_KEY, JSON.stringify(messages));
}

function writeAllProjects(projects: DeepProject[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getDeepReadingQuota(): DeepQuota {
  const session = getSession();
  if (!session) return emptyQuota(FREE_DEEP_READING_LIMIT);

  const todayKey = getBeijingDateKey();
  const used = Math.min(
    readAllReadings().filter(
      (reading) => reading.userEmail === session.email && reading.status === "completed" && reading.completedAt && getBeijingDateKey(reading.completedAt) === todayKey
    ).length,
    FREE_DEEP_READING_LIMIT
  );
  return {
    used,
    limit: FREE_DEEP_READING_LIMIT,
    remaining: Math.max(FREE_DEEP_READING_LIMIT - used, 0),
    resetLabel: "北京时间 00:00"
  };
}

export function getFollowUpQuota(readingId: string): DeepQuota {
  const session = getSession();
  if (!session) return emptyQuota(FREE_FOLLOW_UP_LIMIT);

  const todayKey = getBeijingDateKey();
  const used = readAllFollowUpMessages().filter(
    (message) =>
      message.userEmail === session.email &&
      message.role === "assistant" &&
      message.content !== FOLLOW_UP_FAILURE_MESSAGE &&
      getBeijingDateKey(message.createdAt) === todayKey
  ).length;
  return {
    used,
    limit: FREE_FOLLOW_UP_LIMIT,
    remaining: Math.max(FREE_FOLLOW_UP_LIMIT - used, 0),
    resetLabel: "北京时间 00:00"
  };
}

export function getSession(): AuthSession | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function signIn(email: string) {
  const session = { email: email.trim().toLowerCase() };
  if (canUseStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function signOut() {
  if (canUseStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export function getProjects() {
  const session = getSession();
  if (!session) return [];

  return readAllProjects()
    .filter((project) => project.userEmail === session.email)
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
}

export function getProject(projectId: string) {
  const session = getSession();
  if (!session) return null;

  return readAllProjects().find((project) => project.id === projectId && project.userEmail === session.email) ?? null;
}

export function createProject(input: { title: string; background?: string }) {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const timestamp = now();
  const project: DeepProject = {
    id: newId(),
    userEmail: session.email,
    title: input.title.trim().slice(0, 100),
    background: (input.background ?? "").trim(),
    memorySummary: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp
  };

  writeAllProjects([project, ...readAllProjects()]);
  return project;
}

export function updateProject(projectId: string, input: { title?: string; background?: string; memorySummary?: string }): DeepProject | null {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const projects = readAllProjects();
  let updatedProject: DeepProject | null = null;
  const updatedProjects = projects.map((project) => {
    if (project.id !== projectId || project.userEmail !== session.email) return project;

    updatedProject = {
      ...project,
      title: input.title === undefined ? project.title : input.title.trim().slice(0, 100),
      background: input.background === undefined ? project.background : input.background.trim(),
      memorySummary: input.memorySummary === undefined ? project.memorySummary : input.memorySummary.trim().slice(0, 2000),
      updatedAt: now()
    };

    return updatedProject;
  });

  writeAllProjects(updatedProjects);
  return updatedProject;
}

export function touchProject(projectId: string) {
  const session = getSession();
  if (!session) return;

  const timestamp = now();
  writeAllProjects(
    readAllProjects().map((project) =>
      project.id === projectId && project.userEmail === session.email ? { ...project, lastOpenedAt: timestamp } : project
    )
  );
}

export function deleteProject(projectId: string) {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const ownedReadingIds = readAllReadings()
    .filter((reading) => reading.projectId === projectId && reading.userEmail === session.email)
    .map((reading) => reading.id);

  writeAllProjects(readAllProjects().filter((project) => project.id !== projectId || project.userEmail !== session.email));
  writeAllReadings(readAllReadings().filter((reading) => reading.projectId !== projectId || reading.userEmail !== session.email));
  writeAllReadingCards(readAllReadingCards().filter((card) => !ownedReadingIds.includes(card.readingId)));
  writeAllFollowUpMessages(readAllFollowUpMessages().filter((message) => message.projectId !== projectId || message.userEmail !== session.email));
  return getProjects()[0] ?? null;
}

function spreadPositions(spreadType: SpreadType) {
  if (spreadType === "three_card") return ["起点", "核心发展", "趋势落点"];
  return ["起点", "推进", "核心主题", "转折", "最终倾向"];
}

function drawUniqueCards(count: number): LenormandCard[] {
  const deck = [...lenormandCards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
  }

  return deck.slice(0, count);
}

export function getReadings(projectId: string): ReadingWithCards[] {
  const session = getSession();
  if (!session) return [];

  const cards = readAllReadingCards();
  return readAllReadings()
    .filter((reading) => reading.userEmail === session.email && reading.projectId === projectId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((reading) => ({
      ...reading,
      cards: cards.filter((card) => card.readingId === reading.id).sort((a, b) => a.cardNumber - b.cardNumber)
    }));
}

export function getFollowUpMessages(readingId: string): FollowUpMessage[] {
  const session = getSession();
  if (!session) return [];

  return readAllFollowUpMessages()
    .filter((message) => message.userEmail === session.email && message.readingId === readingId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function getReadingWithCards(readingId: string): ReadingWithCards | null {
  const session = getSession();
  if (!session) return null;

  const reading = readAllReadings().find((item) => item.id === readingId && item.userEmail === session.email);
  if (!reading) return null;

  return {
    ...reading,
    cards: readAllReadingCards().filter((card) => card.readingId === reading.id).sort((a, b) => a.cardNumber - b.cardNumber)
  };
}

function updateReadingStatus(readingId: string, status: ReadingStatus) {
  writeAllReadings(readAllReadings().map((reading) => (reading.id === readingId ? { ...reading, status } : reading)));
}

function completeReading(readingId: string, result: DeepReadingResult) {
  writeAllReadings(
    readAllReadings().map((reading) =>
      reading.id === readingId
        ? {
            ...reading,
            status: "completed",
            coreConclusion: result.core_conclusion,
            interpretation: result.interpretation,
            timeWindow: result.time_window,
            uncertainty: result.uncertainty,
            completedAt: now()
          }
        : reading
    )
  );
}

function failReading(readingId: string) {
  updateReadingStatus(readingId, "failed");
}

function limitReadingToCardsOnly(readingId: string) {
  updateReadingStatus(readingId, "quota_limited");
}

function buildGenerationPayload(readingId: string) {
  const reading = getReadingWithCards(readingId);
  if (!reading) throw new Error("Reading not found");

  const project = getProject(reading.projectId);
  if (!project) throw new Error("Project not found");

  const recentReadings = getReadings(reading.projectId)
    .filter((item) => item.id !== reading.id && item.status === "completed")
    .slice(0, 3)
    .map((item) => ({
      createdAt: item.createdAt,
      question: item.question,
      spreadType: item.spreadType,
      cards: item.cards,
      coreConclusion: item.coreConclusion
    }));

  const recentProjectMessages = readAllFollowUpMessages()
    .filter((message) => message.userEmail === reading.userEmail && message.projectId === reading.projectId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8)
    .reverse()
    .map((message) => {
      const sourceReading = getReadingWithCards(message.readingId);
      return {
        createdAt: message.createdAt,
        readingQuestion: sourceReading?.question ?? "Unknown reading",
        role: message.role,
        content: message.content
      };
    });

  return {
    currentDate: new Date().toISOString().slice(0, 10),
    project: {
      title: project.title,
      background: project.background,
      memorySummary: project.memorySummary
    },
    reading: {
      question: reading.question,
      spreadType: reading.spreadType
    },
    cards: reading.cards,
    recentReadings,
    recentProjectMessages
  };
}

export function createReading(input: { projectId: string; spreadType: SpreadType; question: string }) {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const project = getProject(input.projectId);
  if (!project) throw new Error("Project not found");

  const timestamp = now();
  const reading: DeepReading = {
    id: newId(),
    userEmail: session.email,
    projectId: input.projectId,
    question: input.question.trim().slice(0, 300),
    spreadType: input.spreadType,
    status: "drawing",
    coreConclusion: "",
    interpretation: "",
    timeWindow: null,
    uncertainty: "",
    createdAt: timestamp,
    completedAt: null
  };

  writeAllReadings([...readAllReadings(), reading]);

  const positions = spreadPositions(input.spreadType);
  const drawnCards = drawUniqueCards(input.spreadType === "three_card" ? 3 : 5).map((card, index) => ({
    id: newId(),
    readingId: reading.id,
    cardNumber: index + 1,
    cardSlug: card.slug,
    position: positions[index],
    nameEn: card.nameEn,
    nameZh: card.nameZh
  }));

  writeAllReadingCards([...readAllReadingCards(), ...drawnCards]);

  const generatingReading = { ...reading, status: "generating" as ReadingStatus };
  writeAllReadings(readAllReadings().map((item) => (item.id === reading.id ? generatingReading : item)));
  touchProject(input.projectId);

  return {
    ...generatingReading,
    cards: drawnCards
  };
}

export async function generateDeepReading(readingId: string) {
  const quota = getDeepReadingQuota();
  if (quota.remaining <= 0) {
    limitReadingToCardsOnly(readingId);
    throw new QuotaExceededError("今日免费 AI 深度解读次数已用完。你仍可以抽牌和保存牌面，明天 00:00 后刷新。");
  }

  updateReadingStatus(readingId, "generating");

  try {
    const response = await fetch("/api/deep-reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildGenerationPayload(readingId))
    });

    if (!response.ok) {
      throw new Error(`Deep Reading generation failed: ${response.status}`);
    }

    const result = assertDeepReadingResult(await response.json());
    completeReading(readingId, result);
  } catch (error) {
    failReading(readingId);
    throw error;
  }
}

function buildFollowUpPayload(readingId: string) {
  const reading = getReadingWithCards(readingId);
  if (!reading) throw new Error("Reading not found");
  if (reading.status !== "completed") throw new Error("Reading is not completed");

  const project = getProject(reading.projectId);
  if (!project) throw new Error("Project not found");

  return {
    currentDate: new Date().toISOString().slice(0, 10),
    project: {
      title: project.title,
      background: project.background,
      memorySummary: project.memorySummary
    },
    reading: {
      question: reading.question,
      spreadType: reading.spreadType,
      coreConclusion: reading.coreConclusion,
      interpretation: reading.interpretation,
      timeWindow: reading.timeWindow,
      uncertainty: reading.uncertainty
    },
    cards: reading.cards,
    messages: getFollowUpMessages(readingId).map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt
    }))
  };
}

export async function sendFollowUpMessage(input: { readingId: string; content: string }) {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const reading = getReadingWithCards(input.readingId);
  if (!reading) throw new Error("Reading not found");
  if (reading.status !== "completed") throw new Error("Reading is not completed");

  const trimmed = input.content.trim().slice(0, 500);
  if (!trimmed) throw new Error("Message is empty");
  const followUpQuota = getFollowUpQuota(reading.id);
  if (followUpQuota.remaining <= 0) {
    throw new QuotaExceededError("今日 10 次免费追问已用完，明天 00:00 后刷新。");
  }

  const userMessage: FollowUpMessage = {
    id: newId(),
    userEmail: session.email,
    projectId: reading.projectId,
    readingId: reading.id,
    role: "user",
    content: trimmed,
    createdAt: now()
  };

  writeAllFollowUpMessages([...readAllFollowUpMessages(), userMessage]);
  touchProject(reading.projectId);

  try {
    const response = await fetch("/api/deep-reading/follow-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildFollowUpPayload(reading.id))
    });

    if (!response.ok) {
      throw new Error(`Follow-up generation failed: ${response.status}`);
    }

    const result: DeepFollowUpResult = assertDeepFollowUpResult(await response.json());
    const assistantMessage: FollowUpMessage = {
      id: newId(),
      userEmail: session.email,
      projectId: reading.projectId,
      readingId: reading.id,
      role: "assistant",
      content: result.answer,
      createdAt: now()
    };

    writeAllFollowUpMessages([...readAllFollowUpMessages(), assistantMessage]);
    return assistantMessage;
  } catch (error) {
    const fallbackMessage: FollowUpMessage = {
      id: newId(),
      userEmail: session.email,
      projectId: reading.projectId,
      readingId: reading.id,
      role: "assistant",
      content: FOLLOW_UP_FAILURE_MESSAGE,
      createdAt: now()
    };

    writeAllFollowUpMessages([...readAllFollowUpMessages(), fallbackMessage]);
    throw error;
  }
}

export function formatProjectDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
