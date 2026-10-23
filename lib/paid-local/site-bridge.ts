"use client";

import type { AuthSession, DeepQuota, FollowUpMessage, ReadingWithCards } from "../project-store";
import type { PaidOverview, PaidReading } from "./types";

export const paidLocalSiteEnabled = process.env.NEXT_PUBLIC_PAID_LOCAL_MODE === "1";
export const paidOnlineSiteEnabled = process.env.NEXT_PUBLIC_PAID_ONLINE_MODE === "1";
export const paidSiteEnabled = paidLocalSiteEnabled || paidOnlineSiteEnabled;
export const paidLocalAIEnabled = paidLocalSiteEnabled && process.env.NEXT_PUBLIC_PAID_LOCAL_AI === "1";
const sessionKey = "flora-paid-local:site-session";
const legacyCache = new Map<string,PaidReading>();

export class PaidSiteError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export async function paidSiteRequest<T>(action = "", body?: Record<string, unknown>): Promise<T> {
  if (!paidSiteEnabled || typeof window === "undefined") throw new Error("花瓣服务暂未开启。");
  if (paidLocalSiteEnabled && !["127.0.0.1", "localhost"].includes(window.location.hostname)) throw new Error("本地测试接口未开启。");
  let accessToken: string | undefined;
  if (paidOnlineSiteEnabled) {
    const { getValidSession } = await import("../project-store");
    try { accessToken = (await getValidSession())?.accessToken; }
    catch { throw new PaidSiteError("UNAUTHORIZED", "请先登录你的 Flora 账号。", 401); }
    if (!accessToken) throw new PaidSiteError("UNAUTHORIZED", "请先登录你的 Flora 账号。", 401);
  }
  const cacheOwner = getPaidSiteSession()?.userId || "";
  if(!body && action.startsWith("readings/")){const saved=legacyCache.get(`${cacheOwner}:${action.slice(9)}`);if(saved)return saved as T;}
  const response = await fetch(`${paidOnlineSiteEnabled ? "/api/flora" : "/api/local-paid"}${action ? `/${action}` : ""}`, {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(paidOnlineSiteEnabled ? { Authorization: `Bearer ${accessToken}` } : { "x-local-paid": "1" }) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json() as { code?: string; message?: string };
  if (!response.ok) {
    if (response.status === 401 && !action.startsWith("admin")){window.localStorage.removeItem(paidOnlineSiteEnabled ? "ai-lenormand:auth-session" : sessionKey);legacyCache.clear();}
    throw new PaidSiteError(payload.code || "REQUEST_ERROR", response.status === 401 ? "登录状态已过期，请重新登录。" : payload.message || "请求失败，请重试。", response.status);
  }
  if(!body && /^projects\/[^/]+\/readings$/.test(action) && Array.isArray(payload))for(const reading of payload as PaidReading[])if(reading.legacyRestored)legacyCache.set(`${cacheOwner}:${reading.id}`,reading);
  return payload as T;
}
function rememberSession(overview: PaidOverview): AuthSession {
  const session = { email: `${overview.user.id}@local.invalid`, userId: overview.user.id, accessToken: "local-cookie-session" };
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}
export function getPaidSiteSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(paidOnlineSiteEnabled ? "ai-lenormand:auth-session" : sessionKey) || "null") as AuthSession | null; } catch { return null; }
}
export async function restorePaidSiteSession() {
  if(paidOnlineSiteEnabled){try{const {getValidSession}=await import("../project-store");return await getValidSession();}catch{return null;}}
  try { const overview = await paidSiteRequest<PaidOverview>(); return paidOnlineSiteEnabled ? getPaidSiteSession() : rememberSession(overview); } catch { return null; }
}
export async function loginPaidSite(account: string) { return rememberSession(await paidSiteRequest<PaidOverview>("session", { account })); }
export function logoutPaidSite() {
  window.localStorage.removeItem(sessionKey);
  void paidSiteRequest("logout", {}).catch(() => undefined);
}
export function paidReadingForSite(reading: PaidReading, email = getPaidSiteSession()?.email || ""): ReadingWithCards {
  return {
    id: reading.id, userEmail: email, projectId: reading.projectId || "", question: reading.question, choices: reading.choices || [],
    spreadType: reading.spread, status: reading.state === "locked" ? "drawing" : reading.state,
    coreConclusion: reading.result?.conclusion || "", interpretation: reading.result ? [reading.result.interpretation, reading.result.advice?.trim() ? `行动建议\n${reading.result.advice}` : ""].filter(Boolean).join("\n\n") : "",
    timeWindow: typeof reading.result?.legacy?.sourceRecord.time_window==="string" ? reading.result.legacy.sourceRecord.time_window : null, uncertainty: reading.result?.uncertainty || "", interpretationSource: "ai",legacyRestored:reading.legacyRestored,
    generationModel: reading.result?.model || null,
    createdAt: reading.createdAt, completedAt: reading.completedAt || null,
    cards: reading.cards.map((card, index) => ({ id: `${reading.id}:${index}`, readingId: reading.id, cardNumber: index + 1, cardSlug: card.slug, position: card.position, nameEn: card.nameEn, nameZh: card.nameZh }))
  };
}
export function paidFollowUpsForSite(reading: PaidReading): FollowUpMessage[] {
  const shared = { userEmail: getPaidSiteSession()?.email || "", projectId: reading.projectId || "", readingId: reading.id };
  return [...(reading.legacyMessages||[]).map(message=>({...shared,...message})),...reading.followUps.flatMap((follow) => [
    { ...shared, id: `${follow.id}:user`, role: "user" as const, content: follow.question, createdAt: follow.createdAt },
    { ...shared, id: `${follow.id}:assistant`, role: "assistant" as const, content: follow.answer, createdAt: follow.createdAt }
  ])];
}
export async function paidSiteQuota(): Promise<DeepQuota> {
  const overview = await paidSiteRequest<PaidOverview>();
  return { remaining: overview.balance.available, used: overview.balance.consumed, limit: overview.balance.available + overview.balance.consumed + overview.balance.reserved, resetLabel: "次数长期有效" };
}
export function stablePaidRequestKey(scope: string) {
  const key = `flora-paid-local:request:${getPaidSiteSession()?.userId}:${scope}`;
  const id = sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}
export function completePaidRequestKey(scope: string) {
  sessionStorage.removeItem(`flora-paid-local:request:${getPaidSiteSession()?.userId}:${scope}`);
}
