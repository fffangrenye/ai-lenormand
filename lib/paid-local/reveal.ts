import { LocalPaidError } from "./guard";
import type { PaidDrawSession, PaidReading } from "./types";

export function hideLockedReadingCards(reading: PaidReading): PaidReading {
  return reading.state === "completed" ? reading : { ...reading, cards: [] };
}

export function hideSelectedCards(session: PaidDrawSession | null) {
  // The draw session exposes opaque selection tokens. Card faces come from
  // the completed reading after the same transaction saves it and spends a petal.
  return session && { ...session, selected: [] };
}

export function requireRevealConfirmation(confirmation: unknown) {
  if (confirmation !== true) {
    throw new LocalPaidError("CONFIRM_REVEAL", "请刷新页面，再确认使用 1 花瓣翻牌并解读。", 409);
  }
}
