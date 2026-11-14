import { getDeepSpread, isDeepSpread, type DeepSpreadId } from "../deep-spreads";
import { lenormandCards } from "../lenormand-cards";

export const guestDeckSize = lenormandCards.length;
const draftLifetime = 24 * 60 * 60 * 1000;
const storageKey = "flora:guest-draw:v1";

type GuestDraw = {
  id: string;
  question: string;
  spread: DeepSpreadId;
  choices: string[];
  slots: number[];
  expiresAt: number;
  owner?: string;
  approval?: string;
};

export function validGuestSlots(slots: unknown, spread: DeepSpreadId): slots is number[] {
  return Array.isArray(slots) && slots.length === getDeepSpread(spread).positions.length
    && new Set(slots).size === slots.length
    && slots.every(slot => Number.isInteger(slot) && slot >= 0 && slot < guestDeckSize);
}

export function saveGuestDraw(draft: Omit<GuestDraw, "expiresAt">) {
  window.localStorage.setItem(storageKey, JSON.stringify({ ...draft, expiresAt: Date.now() + draftLifetime }));
}

export function readGuestDraw(id: string): GuestDraw | null {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  try {
    const draft = JSON.parse(window.localStorage.getItem(storageKey) || "null") as GuestDraw | null;
    if (!draft || !Number.isFinite(draft.expiresAt)) return null;
    if (draft.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    if (draft.id !== id || typeof draft.question !== "string" || !draft.question.trim() || draft.question.length > 300
      || !isDeepSpread(draft.spread) || !Array.isArray(draft.choices) || draft.choices.length > 3
      || draft.choices.some(choice => typeof choice !== "string" || choice.length > 80)
      || !validGuestSlots(draft.slots, draft.spread)
      || (draft.approval !== undefined && (typeof draft.approval !== "string" || !/^\d{13}\.[a-f0-9]{64}$/.test(draft.approval)))) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearGuestDraw(id: string) {
  try {
    if (readGuestDraw(id)) window.localStorage.removeItem(storageKey);
  } catch { /* The authenticated reading is already saved. */ }
}

export function bindGuestDraw(draft: GuestDraw, owner: string) {
  const current = readGuestDraw(draft.id);
  if (!current || (current.owner && current.owner !== owner)) return false;
  window.localStorage.setItem(storageKey, JSON.stringify({ ...current, owner }));
  return true;
}
