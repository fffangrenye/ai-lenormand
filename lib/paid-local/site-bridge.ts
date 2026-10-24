"use client";

import type { AuthSession, DeepQuota, FollowUpMessage, ReadingWithCards } from "../project-store";
import type { PaidOverview, PaidReading, PaidSummary } from "./types";

export const paidLocalSiteEnabled = process.env.NEXT_PUBLIC_PAID_LOCAL_MODE === "1";
export const paidOnlineSiteEnabled = process.env.NEXT_PUBLIC_PAID_ONLINE_MODE === "1";
export const paidSiteEnabled = paidLocalSiteEnabled || paidOnlineSiteEnabled;
export const paidLocalAIEnabled = paidLocalSiteEnabled && process.env.NEXT_PUBLIC_PAID_LOCAL_AI === "1";
const sessionKey = "flora-paid-local:site-session";
const cache = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
let cacheEpoch = 0;
let activeOwner = "";
function invalidate() { cacheEpoch++; cache.clear(); pending.clear(); }
function cacheTtl(action: string) {
  if (action.startsWith("admin")) return 0;
  if (action === "daily-status") return 60_000;
  if (action.startsWith("daily")) return 60_000;
  if (action === "summary") return 30_000;
  if (action === "card-catalog" || action === "catalog") return 300_000;
  if(action==="projects" || /^projects\/[^/]+\/reading-page/.test(action))return 120_000;
  if (!action || action.startsWith("profile?") || action.startsWith("ledger") || action.startsWith("usage") || action === "redemptions" || action === "orders") return 60_000;
  return 10_000;
}
type RefreshReason="resume"|"mutation"|"account";
const refreshListeners=new Set<(reason:RefreshReason)=>void>();
const revisionKey="flora-paid-site:revision:v1";
let removeRefreshEvents:(()=>void)|undefined;
let dirtyWhileHidden=false;
function notifyRefresh(reason:RefreshReason){
  if(typeof document!=="undefined"&&document.visibilityState==="hidden"){if(reason!=="resume")dirtyWhileHidden=true;return;}
  const current=dirtyWhileHidden&&reason==="resume"?"mutation":reason;dirtyWhileHidden=false;
  refreshListeners.forEach(callback=>callback(current));
}
export function subscribePaidSiteRefresh(callback:(reason:RefreshReason)=>void){
  refreshListeners.add(callback);
  if(!removeRefreshEvents&&typeof window!=="undefined"){
    let timer:ReturnType<typeof setTimeout>|undefined,lastResume=0;
    const resume=()=>{if(document.visibilityState==="hidden")return;clearTimeout(timer);timer=setTimeout(()=>{if(Date.now()-lastResume<1000)return;lastResume=Date.now();notifyRefresh("resume");},100);};
    const storage=(event:StorageEvent)=>{
      if(event.key==="ai-lenormand:auth-session"||event.key===sessionKey){
        try{if(JSON.parse(event.oldValue||"null")?.userId===JSON.parse(event.newValue||"null")?.userId)return;}catch{/* Unknown session shape: refresh safely. */}
        invalidate();notifyRefresh("account");return;
      }
      if(event.key!==revisionKey)return;
      try{if(JSON.parse(event.newValue||"null")?.owner!==getPaidSiteSession()?.userId)return;}catch{return;}
      invalidate();notifyRefresh("mutation");
    };
    window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);window.addEventListener("storage",storage);
    removeRefreshEvents=()=>{clearTimeout(timer);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);window.removeEventListener("storage",storage);};
  }
  return()=>{refreshListeners.delete(callback);if(!refreshListeners.size){removeRefreshEvents?.();removeRefreshEvents=undefined;}};
}
function rememberSignedStatus(owner:string,value:unknown){
  const item=value as {today?:string;signed?:boolean};
  if(!owner||item.signed!==true||item.today!==new Date(Date.now()+8*3600_000).toISOString().slice(0,10))return;
  try{window.localStorage.setItem(`flora:signed-day:v1:${owner}`,JSON.stringify({today:item.today,signed:true}));}catch{/* This is an optional read cache. */}
}
function save(key: string, value: unknown, ttl: number) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + ttl });
}

export class PaidSiteError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export async function paidSiteRequest<T>(action = "", body?: Record<string, unknown>): Promise<T> {
  if (!paidSiteEnabled || typeof window === "undefined") throw new Error("花瓣服务暂未开启。");
  if (paidLocalSiteEnabled && !["127.0.0.1", "localhost"].includes(window.location.hostname)) throw new Error("本地测试接口未开启。");
  let accessToken: string | undefined;
  let verifiedOwner = "";
  if (paidOnlineSiteEnabled) {
    const { getValidSession } = await import("../project-store");
    try { const session = await getValidSession(); accessToken = session?.accessToken; verifiedOwner = session?.userId || ""; }
    catch { throw new PaidSiteError("UNAUTHORIZED", "请先登录你的 Flora 账号。", 401); }
    if (!accessToken) throw new PaidSiteError("UNAUTHORIZED", "请先登录你的 Flora 账号。", 401);
  }
  const cacheOwner = verifiedOwner || getPaidSiteSession()?.userId || "";
  if (activeOwner !== cacheOwner) { invalidate(); activeOwner = cacheOwner; }
  const day = action.startsWith("daily") ? `:${new Date(Date.now()+8*3600_000).toISOString().slice(0,10)}` : "";
  // Updating list recency must not discard the entire history/detail cache.
  // Coalesce repeated mounts for this account and project; every real financial
  // or content mutation still invalidates before and after the server response.
  const touch = action === "project-touch" && typeof body?.projectId === "string";
  const key = `${cacheOwner}:${action}${day}${touch ? `:${body!.projectId}` : ""}`, epoch = cacheEpoch;
  if (!body || touch) {
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) return saved.value as T;
    const inflight = pending.get(key); if (inflight) return inflight as Promise<T>;
    if(action==="daily-status"){
      try{const value=JSON.parse(window.localStorage.getItem(`flora:signed-day:v1:${cacheOwner}`)||"null");if(value?.signed===true&&value.today===day.slice(1))return value as T;}catch{/* Fall back to the server. */}
    }
  } else invalidate();
  const request = (async () => {
  const response = await fetch(`${paidOnlineSiteEnabled ? "/api/flora" : "/api/local-paid"}${action ? `/${action}` : ""}`, {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(paidOnlineSiteEnabled ? { Authorization: `Bearer ${accessToken}` } : { "x-local-paid": "1" }) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json() as { code?: string; message?: string };
  if (!response.ok) {
    if (response.status === 401 && !action.startsWith("admin")){window.localStorage.removeItem(paidOnlineSiteEnabled ? "ai-lenormand:auth-session" : sessionKey);invalidate();}
    throw new PaidSiteError(payload.code || "REQUEST_ERROR", response.status === 401 ? "登录状态已过期，请重新登录。" : payload.message || "请求失败，请重试。", response.status);
  }
  // A mutation or account change must not let an older in-flight GET refill caches.
  if (getPaidSiteSession()?.userId === cacheOwner && (body || epoch === cacheEpoch)) {
    if (touch) {
      save(key, payload, 300_000);
      cache.delete(`${cacheOwner}:projects`);
    } else if (body) {
      invalidate();
      if(action==="daily-check-in"){
        const result=payload as unknown as {today:string};
        rememberSignedStatus(cacheOwner,{today:result.today,signed:true});
      }
      try{window.localStorage.setItem(revisionKey,JSON.stringify({owner:cacheOwner,at:Date.now(),nonce:Math.random()}));}catch{/* Same-tab invalidation still applies. */}
      notifyRefresh("mutation");
    }
    else save(key, payload, cacheTtl(action));
    if(action==="daily-status")rememberSignedStatus(cacheOwner,payload);
    const page = payload as unknown as {items?: PaidReading[]; id?: string; state?: string};
    const readings = Array.isArray(payload) ? payload as PaidReading[] : page.items || (page.id && page.state ? [payload as unknown as PaidReading] : []);
    for (const reading of readings) if (reading.id && reading.followUps) save(`${cacheOwner}:readings/${reading.id}`, reading, reading.legacyRestored ? 300_000 : 10_000);
  }
  return payload as T;
  })();
  if (!body || touch) pending.set(key, request);
  try { return await request; } finally { if (pending.get(key) === request) pending.delete(key); }
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
  invalidate();
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
  const overview = await paidSiteRequest<PaidSummary>("summary");
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
