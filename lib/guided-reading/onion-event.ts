// Absolute Beijing-time dates; this is one event, never a recurring daily window.
export const onionEvent = {
  id: "flora-30000-20261123",
  startsAt: "2026-11-23T22:00:00+08:00",
  endsAt: "2026-11-24T00:00:00+08:00",
  validForMs: 7 * 86400_000,
  claimLimit: 500,
  displayClaimLimit: 1000,
} as const;

export function onionEventActive(now: number) {
  return now >= Date.parse(onionEvent.startsAt) && now < Date.parse(onionEvent.endsAt);
}

export function onionEventStatus(now = Date.now()) {
  return {
    campaignId: onionEvent.id, startsAt: onionEvent.startsAt, endsAt: onionEvent.endsAt,
    claimLimit: onionEvent.claimLimit,
    displayClaimLimit: onionEvent.displayClaimLimit,
    serverNow: new Date(now).toISOString(), active: onionEventActive(now),
  };
}

export type OnionCoupon = {
  id: string; claimedAt: string; expiresAt: string; usedAt: string | null; sessionId: string | null;
};
export type OnionEventStatus = ReturnType<typeof onionEventStatus>;
export type OnionCouponStatus = OnionEventStatus & { coupon: OnionCoupon | null; remaining: number; soldOut: boolean };
