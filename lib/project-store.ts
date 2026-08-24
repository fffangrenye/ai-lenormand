"use client";

import { LenormandCard, lenormandCards } from "./lenormand-cards";
import { DeepFollowUpResult, DeepReadingResult, assertDeepFollowUpResult, assertDeepReadingResult } from "./deep-reading-result";

export type AuthSession = {
  email: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
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

type DailyQuotaKind = "deep_reading" | "follow_up";

type DailyQuotaEvent = {
  id: string;
  userEmail: string;
  kind: DailyQuotaKind;
  sourceId: string;
  dateKey: string;
  createdAt: string;
};

const SESSION_KEY = "ai-lenormand:auth-session";
const PROJECTS_KEY = "ai-lenormand:deep-projects";
const READINGS_KEY = "ai-lenormand:deep-readings";
const READING_CARDS_KEY = "ai-lenormand:deep-reading-cards";
const FOLLOW_UP_MESSAGES_KEY = "ai-lenormand:deep-follow-up-messages";
const DAILY_QUOTA_EVENTS_KEY = "ai-lenormand:daily-quota-events";
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

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase 登录还没有配置。请先设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

function canUseRemoteStore() {
  const session = getSession();
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && session?.accessToken && session.userId);
}

async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  const { url, anonKey } = getSupabaseBrowserConfig();

  if (!session?.accessToken) {
    throw new Error("Not signed in");
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase request failed: ${response.status} ${message.slice(0, 300)}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

async function requestSupabaseAuth(path: string, body: Record<string, unknown>) {
  const { url, anonKey } = getSupabaseBrowserConfig();
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof payload.msg === "string"
        ? payload.msg
        : typeof payload.message === "string"
          ? payload.message
          : typeof payload.error_description === "string"
            ? payload.error_description
            : "Supabase 登录失败。";
    throw new Error(message);
  }

  return payload;
}

type RemoteProjectRow = {
  id: string;
  user_id: string;
  title: string;
  background: string | null;
  memory_summary: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

type RemoteReadingRow = {
  id: string;
  user_id: string;
  project_id: string;
  question: string;
  spread_type: SpreadType;
  status: ReadingStatus;
  core_conclusion: string | null;
  interpretation: string | null;
  time_window: string | null;
  uncertainty: string | null;
  created_at: string;
  completed_at: string | null;
};

type RemoteReadingCardRow = {
  id: string;
  reading_id: string;
  card_number: number;
  card_slug: string;
  position: string;
  name_en: string;
  name_zh: string;
};

type RemoteFollowUpMessageRow = {
  id: string;
  user_id: string;
  project_id: string;
  reading_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function mapRemoteProject(row: RemoteProjectRow): DeepProject {
  const session = getSession();
  return {
    id: row.id,
    userEmail: session?.email ?? "",
    title: row.title,
    background: row.background ?? "",
    memorySummary: row.memory_summary ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at
  };
}

function mapRemoteReading(row: RemoteReadingRow): DeepReading {
  const session = getSession();
  return {
    id: row.id,
    userEmail: session?.email ?? "",
    projectId: row.project_id,
    question: row.question,
    spreadType: row.spread_type,
    status: row.status,
    coreConclusion: row.core_conclusion ?? "",
    interpretation: row.interpretation ?? "",
    timeWindow: row.time_window,
    uncertainty: row.uncertainty ?? "",
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function mapRemoteReadingCard(row: RemoteReadingCardRow): DeepReadingCard {
  return {
    id: row.id,
    readingId: row.reading_id,
    cardNumber: row.card_number,
    cardSlug: row.card_slug,
    position: row.position,
    nameEn: row.name_en,
    nameZh: row.name_zh
  };
}

function mapRemoteFollowUpMessage(row: RemoteFollowUpMessageRow): FollowUpMessage {
  const session = getSession();
  return {
    id: row.id,
    userEmail: session?.email ?? "",
    projectId: row.project_id,
    readingId: row.reading_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
}

function saveSupabaseAuthSession(payload: Record<string, unknown>, fallbackEmail: string) {
  const user = payload.user && typeof payload.user === "object" ? (payload.user as Record<string, unknown>) : null;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  const email = typeof user?.email === "string" ? user.email : fallbackEmail;
  const userId = typeof user?.id === "string" ? user.id : "";

  if (!accessToken || !userId) {
    throw new Error("账号已创建，请先按 Supabase 邮件要求完成确认后再登录。");
  }

  const session: AuthSession = {
    email: email.trim().toLowerCase(),
    userId,
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000
  };

  if (canUseStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

function readAllDailyQuotaEvents(): DailyQuotaEvent[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(DAILY_QUOTA_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as DailyQuotaEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAllDailyQuotaEvents(events: DailyQuotaEvent[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DAILY_QUOTA_EVENTS_KEY, JSON.stringify(events));
}

function recordDailyQuotaEvent(input: { userEmail: string; kind: DailyQuotaKind; sourceId: string }) {
  const events = readAllDailyQuotaEvents();
  const dateKey = getBeijingDateKey();
  const exists = events.some(
    (event) => event.userEmail === input.userEmail && event.kind === input.kind && event.sourceId === input.sourceId && event.dateKey === dateKey
  );

  if (exists) return;

  writeAllDailyQuotaEvents([
    ...events,
    {
      id: newId(),
      userEmail: input.userEmail,
      kind: input.kind,
      sourceId: input.sourceId,
      dateKey,
      createdAt: now()
    }
  ]);
}

function syncDailyQuotaEventsFromVisibleHistory(userEmail: string) {
  const todayKey = getBeijingDateKey();
  const events = readAllDailyQuotaEvents();
  const existingKeys = new Set(events.map((event) => `${event.userEmail}:${event.kind}:${event.sourceId}:${event.dateKey}`));
  const nextEvents = [...events];

  readAllReadings()
    .filter((reading) => reading.userEmail === userEmail && reading.status === "completed" && reading.completedAt && getBeijingDateKey(reading.completedAt) === todayKey)
    .forEach((reading) => {
      const key = `${userEmail}:deep_reading:${reading.id}:${todayKey}`;
      if (existingKeys.has(key)) return;

      existingKeys.add(key);
      nextEvents.push({
        id: newId(),
        userEmail,
        kind: "deep_reading",
        sourceId: reading.id,
        dateKey: todayKey,
        createdAt: reading.completedAt ?? now()
      });
    });

  readAllFollowUpMessages()
    .filter(
      (message) =>
        message.userEmail === userEmail &&
        message.role === "assistant" &&
        message.content !== FOLLOW_UP_FAILURE_MESSAGE &&
        getBeijingDateKey(message.createdAt) === todayKey
    )
    .forEach((message) => {
      const key = `${userEmail}:follow_up:${message.id}:${todayKey}`;
      if (existingKeys.has(key)) return;

      existingKeys.add(key);
      nextEvents.push({
        id: newId(),
        userEmail,
        kind: "follow_up",
        sourceId: message.id,
        dateKey: todayKey,
        createdAt: message.createdAt
      });
    });

  if (nextEvents.length !== events.length) {
    writeAllDailyQuotaEvents(nextEvents);
  }
}

function writeAllProjects(projects: DeepProject[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getDeepReadingQuota(): DeepQuota {
  const session = getSession();
  if (!session) return emptyQuota(FREE_DEEP_READING_LIMIT);

  syncDailyQuotaEventsFromVisibleHistory(session.email);
  const todayKey = getBeijingDateKey();
  const ledgerUsed = readAllDailyQuotaEvents().filter(
    (event) => event.userEmail === session.email && event.kind === "deep_reading" && event.dateKey === todayKey
  );
  const visibleCompletedUsed = readAllReadings().filter(
    (reading) => reading.userEmail === session.email && reading.status === "completed" && reading.completedAt && getBeijingDateKey(reading.completedAt) === todayKey
  );
  const used = Math.min(Math.max(ledgerUsed.length, visibleCompletedUsed.length), FREE_DEEP_READING_LIMIT);
  return {
    used,
    limit: FREE_DEEP_READING_LIMIT,
    remaining: Math.max(FREE_DEEP_READING_LIMIT - used, 0),
    resetLabel: "北京时间 00:00"
  };
}

export function getFollowUpQuota(_readingId: string): DeepQuota {
  const session = getSession();
  if (!session) return emptyQuota(FREE_FOLLOW_UP_LIMIT);

  syncDailyQuotaEventsFromVisibleHistory(session.email);
  const todayKey = getBeijingDateKey();
  const ledgerUsed = readAllDailyQuotaEvents().filter((event) => event.userEmail === session.email && event.kind === "follow_up" && event.dateKey === todayKey);
  const visibleSuccessfulUsed = readAllFollowUpMessages().filter(
    (message) =>
      message.userEmail === session.email &&
      message.role === "assistant" &&
      message.content !== FOLLOW_UP_FAILURE_MESSAGE &&
      getBeijingDateKey(message.createdAt) === todayKey
  ).length;
  const used = Math.min(Math.max(ledgerUsed.length, visibleSuccessfulUsed), FREE_FOLLOW_UP_LIMIT);
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
    const session = raw ? (JSON.parse(raw) as AuthSession) : null;
    if (!session?.email || !session.userId || !session.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = await requestSupabaseAuth("/auth/v1/token?grant_type=password", {
    email: normalizedEmail,
    password
  });
  return saveSupabaseAuthSession(payload, normalizedEmail);
}

export async function signUp(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = await requestSupabaseAuth("/auth/v1/signup", {
    email: normalizedEmail,
    password
  });
  return saveSupabaseAuthSession(payload, normalizedEmail);
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

export async function loadProjects() {
  if (!canUseRemoteStore()) return getProjects();

  const rows = await supabaseRest<RemoteProjectRow[]>("/deep_projects?select=*&order=last_opened_at.desc");
  return rows.map(mapRemoteProject);
}

export function getProject(projectId: string) {
  const session = getSession();
  if (!session) return null;

  return readAllProjects().find((project) => project.id === projectId && project.userEmail === session.email) ?? null;
}

export async function loadProject(projectId: string) {
  if (!canUseRemoteStore()) return getProject(projectId);

  const rows = await supabaseRest<RemoteProjectRow[]>(`/deep_projects?select=*&id=eq.${encodeURIComponent(projectId)}&limit=1`);
  return rows[0] ? mapRemoteProject(rows[0]) : null;
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

export async function saveProject(input: { title: string; background?: string }) {
  if (!canUseRemoteStore()) return createProject(input);

  const session = getSession();
  if (!session?.userId) throw new Error("Not signed in");

  const timestamp = now();
  const rows = await supabaseRest<RemoteProjectRow[]>("/deep_projects?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: session.userId,
      title: input.title.trim().slice(0, 100),
      background: (input.background ?? "").trim(),
      memory_summary: "",
      created_at: timestamp,
      updated_at: timestamp,
      last_opened_at: timestamp
    })
  });

  return mapRemoteProject(rows[0]);
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

export async function saveProjectUpdate(projectId: string, input: { title?: string; background?: string; memorySummary?: string }): Promise<DeepProject | null> {
  if (!canUseRemoteStore()) return updateProject(projectId, input);

  const patch: Record<string, string> = {
    updated_at: now()
  };
  if (input.title !== undefined) patch.title = input.title.trim().slice(0, 100);
  if (input.background !== undefined) patch.background = input.background.trim();
  if (input.memorySummary !== undefined) patch.memory_summary = input.memorySummary.trim().slice(0, 2000);

  const rows = await supabaseRest<RemoteProjectRow[]>(`/deep_projects?id=eq.${encodeURIComponent(projectId)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });

  return rows[0] ? mapRemoteProject(rows[0]) : null;
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

export async function saveProjectTouch(projectId: string) {
  if (!canUseRemoteStore()) {
    touchProject(projectId);
    return;
  }

  await supabaseRest<null>(`/deep_projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_opened_at: now() })
  });
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

export async function removeProject(projectId: string) {
  if (!canUseRemoteStore()) return deleteProject(projectId);

  await supabaseRest<null>(`/deep_projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });

  const projects = await loadProjects();
  return projects[0] ?? null;
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

export async function loadReadings(projectId: string): Promise<ReadingWithCards[]> {
  if (!canUseRemoteStore()) return getReadings(projectId);

  const readingRows = await supabaseRest<RemoteReadingRow[]>(
    `/deep_readings?select=*&project_id=eq.${encodeURIComponent(projectId)}&order=created_at.desc`
  );
  if (!readingRows.length) return [];

  const readingIds = readingRows.map((reading) => reading.id);
  const cardRows = await supabaseRest<RemoteReadingCardRow[]>(
    `/deep_reading_cards?select=*&reading_id=in.(${readingIds.join(",")})&order=card_number.asc`
  );

  return readingRows.map((readingRow) => ({
    ...mapRemoteReading(readingRow),
    cards: cardRows.filter((card) => card.reading_id === readingRow.id).map(mapRemoteReadingCard)
  }));
}

export function getFollowUpMessages(readingId: string): FollowUpMessage[] {
  const session = getSession();
  if (!session) return [];

  return readAllFollowUpMessages()
    .filter((message) => message.userEmail === session.email && message.readingId === readingId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function loadFollowUpMessages(readingId: string): Promise<FollowUpMessage[]> {
  if (!canUseRemoteStore()) return getFollowUpMessages(readingId);

  const rows = await supabaseRest<RemoteFollowUpMessageRow[]>(
    `/deep_follow_up_messages?select=*&reading_id=eq.${encodeURIComponent(readingId)}&order=created_at.asc`
  );
  return rows.map(mapRemoteFollowUpMessage);
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

async function loadReadingWithCards(readingId: string): Promise<ReadingWithCards | null> {
  if (!canUseRemoteStore()) return getReadingWithCards(readingId);

  const readingRows = await supabaseRest<RemoteReadingRow[]>(`/deep_readings?select=*&id=eq.${encodeURIComponent(readingId)}&limit=1`);
  if (!readingRows[0]) return null;

  const cardRows = await supabaseRest<RemoteReadingCardRow[]>(
    `/deep_reading_cards?select=*&reading_id=eq.${encodeURIComponent(readingId)}&order=card_number.asc`
  );

  return {
    ...mapRemoteReading(readingRows[0]),
    cards: cardRows.map(mapRemoteReadingCard)
  };
}

function updateReadingStatus(readingId: string, status: ReadingStatus) {
  writeAllReadings(readAllReadings().map((reading) => (reading.id === readingId ? { ...reading, status } : reading)));
}

async function saveReadingStatus(readingId: string, status: ReadingStatus) {
  if (!canUseRemoteStore()) {
    updateReadingStatus(readingId, status);
    return;
  }

  await supabaseRest<null>(`/deep_readings?id=eq.${encodeURIComponent(readingId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status })
  });
}

function completeReading(readingId: string, result: DeepReadingResult) {
  const completedAt = now();
  const completedReading = readAllReadings().find((reading) => reading.id === readingId);

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
            completedAt
          }
        : reading
    )
  );

  if (completedReading) {
    recordDailyQuotaEvent({
      userEmail: completedReading.userEmail,
      kind: "deep_reading",
      sourceId: readingId
    });
  }
}

async function saveCompletedReading(readingId: string, result: DeepReadingResult) {
  if (!canUseRemoteStore()) {
    completeReading(readingId, result);
    return;
  }

  const completedReading = await loadReadingWithCards(readingId);

  await supabaseRest<null>(`/deep_readings?id=eq.${encodeURIComponent(readingId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "completed",
      core_conclusion: result.core_conclusion,
      interpretation: result.interpretation,
      time_window: result.time_window,
      uncertainty: result.uncertainty,
      completed_at: now()
    })
  });

  if (completedReading) {
    recordDailyQuotaEvent({
      userEmail: completedReading.userEmail,
      kind: "deep_reading",
      sourceId: readingId
    });
  }
}

function authHeaders(): HeadersInit {
  const session = getSession();
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function failReading(readingId: string) {
  updateReadingStatus(readingId, "failed");
}

async function saveFailedReading(readingId: string) {
  await saveReadingStatus(readingId, "failed");
}

function limitReadingToCardsOnly(readingId: string) {
  updateReadingStatus(readingId, "quota_limited");
}

async function saveLimitedReading(readingId: string) {
  await saveReadingStatus(readingId, "quota_limited");
}

async function buildGenerationPayload(readingId: string) {
  const reading = await loadReadingWithCards(readingId);
  if (!reading) throw new Error("Reading not found");

  const project = await loadProject(reading.projectId);
  if (!project) throw new Error("Project not found");

  const projectReadings = await loadReadings(reading.projectId);
  const recentReadings = projectReadings
    .filter((item) => item.id !== reading.id && item.status === "completed")
    .slice(0, 3)
    .map((item) => ({
      createdAt: item.createdAt,
      question: item.question,
      spreadType: item.spreadType,
      cards: item.cards,
      coreConclusion: item.coreConclusion
    }));

  const allProjectMessages = canUseRemoteStore()
    ? await supabaseRest<RemoteFollowUpMessageRow[]>(
        `/deep_follow_up_messages?select=*&project_id=eq.${encodeURIComponent(reading.projectId)}&order=created_at.desc&limit=8`
      ).then((rows) => rows.reverse().map(mapRemoteFollowUpMessage))
    : readAllFollowUpMessages().filter((message) => message.userEmail === reading.userEmail && message.projectId === reading.projectId);

  const recentProjectMessages = allProjectMessages
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

export async function saveReading(input: { projectId: string; spreadType: SpreadType; question: string }) {
  if (!canUseRemoteStore()) return createReading(input);

  const session = getSession();
  if (!session?.userId) throw new Error("Not signed in");

  const project = await loadProject(input.projectId);
  if (!project) throw new Error("Project not found");

  const timestamp = now();
  const reading: DeepReading = {
    id: newId(),
    userEmail: session.email,
    projectId: input.projectId,
    question: input.question.trim().slice(0, 300),
    spreadType: input.spreadType,
    status: "generating",
    coreConclusion: "",
    interpretation: "",
    timeWindow: null,
    uncertainty: "",
    createdAt: timestamp,
    completedAt: null
  };

  await supabaseRest<RemoteReadingRow[]>("/deep_readings?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: reading.id,
      user_id: session.userId,
      project_id: input.projectId,
      question: reading.question,
      spread_type: input.spreadType,
      status: "generating",
      core_conclusion: "",
      interpretation: "",
      uncertainty: "",
      created_at: timestamp
    })
  });

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

  await supabaseRest<RemoteReadingCardRow[]>("/deep_reading_cards?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      drawnCards.map((card) => ({
        id: card.id,
        reading_id: card.readingId,
        card_number: card.cardNumber,
        card_slug: card.cardSlug,
        position: card.position,
        name_en: card.nameEn,
        name_zh: card.nameZh
      }))
    )
  });
  await saveProjectTouch(input.projectId);

  return {
    ...reading,
    cards: drawnCards
  };
}

export async function generateDeepReading(readingId: string) {
  await saveReadingStatus(readingId, "generating");

  try {
    const payload = await buildGenerationPayload(readingId);
    const response = await fetch("/api/deep-reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      throw new Error("请重新登录后再生成 AI 解读。");
    }
    if (response.status === 429) {
      await saveLimitedReading(readingId);
      throw new QuotaExceededError("今日免费 AI 深度解读次数已用完。你仍可以抽牌和保存牌面，明天 00:00 后刷新。");
    }
    if (!response.ok) {
      throw new Error(`Deep Reading generation failed: ${response.status}`);
    }

    const result = assertDeepReadingResult(await response.json());
    await saveCompletedReading(readingId, result);
  } catch (error) {
    if (error instanceof Error && error.name !== "QuotaExceededError") {
      await saveFailedReading(readingId);
    }
    throw error;
  }
}

async function buildFollowUpPayload(readingId: string) {
  const reading = await loadReadingWithCards(readingId);
  if (!reading) throw new Error("Reading not found");
  if (reading.status !== "completed") throw new Error("Reading is not completed");

  const project = await loadProject(reading.projectId);
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
    messages: (await loadFollowUpMessages(readingId)).map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt
    }))
  };
}

export async function sendFollowUpMessage(input: { readingId: string; content: string }) {
  const session = getSession();
  if (!session) throw new Error("Not signed in");

  const reading = await loadReadingWithCards(input.readingId);
  if (!reading) throw new Error("Reading not found");
  if (reading.status !== "completed") throw new Error("Reading is not completed");

  const trimmed = input.content.trim().slice(0, 500);
  if (!trimmed) throw new Error("Message is empty");

  const userMessage: FollowUpMessage = {
    id: newId(),
    userEmail: session.email,
    projectId: reading.projectId,
    readingId: reading.id,
    role: "user",
    content: trimmed,
    createdAt: now()
  };

  if (canUseRemoteStore()) {
    await supabaseRest<RemoteFollowUpMessageRow[]>("/deep_follow_up_messages?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: userMessage.id,
        user_id: session.userId,
        project_id: userMessage.projectId,
        reading_id: userMessage.readingId,
        role: userMessage.role,
        content: userMessage.content,
        created_at: userMessage.createdAt
      })
    });
    await saveProjectTouch(reading.projectId);
  } else {
    writeAllFollowUpMessages([...readAllFollowUpMessages(), userMessage]);
    touchProject(reading.projectId);
  }

  try {
    const payload = await buildFollowUpPayload(reading.id);
    const response = await fetch("/api/deep-reading/follow-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      throw new Error("请重新登录后再追问。");
    }
    if (response.status === 429) {
      throw new QuotaExceededError("今日 10 次免费追问已用完，明天 00:00 后刷新。");
    }
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

    if (canUseRemoteStore()) {
      await supabaseRest<RemoteFollowUpMessageRow[]>("/deep_follow_up_messages?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: assistantMessage.id,
          user_id: session.userId,
          project_id: assistantMessage.projectId,
          reading_id: assistantMessage.readingId,
          role: assistantMessage.role,
          content: assistantMessage.content,
          created_at: assistantMessage.createdAt
        })
      });
      recordDailyQuotaEvent({
        userEmail: session.email,
        kind: "follow_up",
        sourceId: assistantMessage.id
      });
    } else {
      writeAllFollowUpMessages([...readAllFollowUpMessages(), assistantMessage]);
      recordDailyQuotaEvent({
        userEmail: session.email,
        kind: "follow_up",
        sourceId: assistantMessage.id
      });
    }
    return assistantMessage;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw error;
    }

    const fallbackMessage: FollowUpMessage = {
      id: newId(),
      userEmail: session.email,
      projectId: reading.projectId,
      readingId: reading.id,
      role: "assistant",
      content: FOLLOW_UP_FAILURE_MESSAGE,
      createdAt: now()
    };

    if (canUseRemoteStore()) {
      await supabaseRest<RemoteFollowUpMessageRow[]>("/deep_follow_up_messages?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: fallbackMessage.id,
          user_id: session.userId,
          project_id: fallbackMessage.projectId,
          reading_id: fallbackMessage.readingId,
          role: fallbackMessage.role,
          content: fallbackMessage.content,
          created_at: fallbackMessage.createdAt
        })
      });
    } else {
      writeAllFollowUpMessages([...readAllFollowUpMessages(), fallbackMessage]);
    }
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
