export const YES_NO_DAILY_LIMIT = 3;
export const YES_NO_QUOTA_KEY = "flora:yes-no:daily-quota:v1";
export const YES_NO_QUOTA_CHANGED = "flora:yes-no:quota-changed";
type QuotaStorage = Pick<Storage, "getItem" | "setItem">;
export type YesNoQuota = { day: string; used: number; available: boolean };

export function yesNoBeijingDay(now = Date.now()) {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function readYesNoQuota(storage: Pick<Storage, "getItem">, now = Date.now()): YesNoQuota {
  const day = yesNoBeijingDay(now);
  let raw: string | null;
  try { raw = storage.getItem(YES_NO_QUOTA_KEY); }
  catch { return { day, used: 0, available: false }; }
  if (!raw) return { day, used: 0, available: true };
  try {
    const saved = JSON.parse(raw);
    if (saved?.day === day && Number.isSafeInteger(saved.used) && saved.used >= 0) {
      return { day, used: Math.min(saved.used, YES_NO_DAILY_LIMIT), available: true };
    }
  } catch { /* A malformed local record contains no usable quota. */ }
  return { day, used: 0, available: true };
}

export function consumeYesNoQuota(storage: QuotaStorage, now = Date.now()) {
  const current = readYesNoQuota(storage, now);
  if (!current.available) return { ok: false as const, reason: "storage" as const };
  if (current.used >= YES_NO_DAILY_LIMIT) return { ok: false as const, reason: "limit" as const };
  try {
    storage.setItem(YES_NO_QUOTA_KEY, JSON.stringify({ day: current.day, used: current.used + 1 }));
    return { ok: true as const, used: current.used + 1 };
  } catch { return { ok: false as const, reason: "storage" as const }; }
}

// Primitive snapshots stay stable between changes; -2 is the server/loading state.
export function getYesNoQuotaSnapshot() {
  try {
    const quota = readYesNoQuota(window.localStorage);
    return quota.available ? quota.used : -1;
  } catch { return -1; }
}
export const getYesNoServerSnapshot = () => -2;

export function subscribeYesNoQuota(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const scheduleReset = () => {
    const now = Date.now();
    const midnight = (Math.floor((now + 8 * 3_600_000) / 86_400_000) + 1) * 86_400_000 - 8 * 3_600_000;
    timer = setTimeout(() => { onChange(); scheduleReset(); }, midnight - now + 50);
  };
  const changed = () => onChange();
  const storageChanged = (event: StorageEvent) => {
    if (event.key === YES_NO_QUOTA_KEY || event.key === null) onChange();
  };
  const visible = () => { if (document.visibilityState === "visible") onChange(); };
  window.addEventListener("storage", storageChanged);
  window.addEventListener(YES_NO_QUOTA_CHANGED, changed);
  window.addEventListener("focus", changed);
  document.addEventListener("visibilitychange", visible);
  scheduleReset();
  return () => {
    clearTimeout(timer);
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener(YES_NO_QUOTA_CHANGED, changed);
    window.removeEventListener("focus", changed);
    document.removeEventListener("visibilitychange", visible);
  };
}
