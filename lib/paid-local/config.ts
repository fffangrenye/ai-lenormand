export const paidConfig = {
  grantVersion: "paid-v1",
  welcomeCredits: 1,
  followUpsPerReading: 2,
  checkInRewardDays: 3,
  reservationLeaseMs: 120_000,
  drawWindowMs: 60_000,
  maxDrawsPerWindow: 8,
  promotion: { enabled: false, version: "first-purchase-v3", startsAt: null as string | null, endsAt: null as string | null },
  packages: [
    { id: "single", credits: 1, regularCents: 499, label: "单次体验" },
    { id: "five", credits: 5, regularCents: 1499, label: "5 次深度解读" },
    { id: "ten", credits: 10, regularCents: 2499, label: "10 次深度解读" }
  ]
};

export function packagePrice(id: string, now = new Date(), config = paidConfig, firstPurchase = false) {
  const item = config.packages.find((candidate) => candidate.id === id);
  if (!item) throw new Error("套餐不存在");
  const promotion = config.promotion;
  const active = firstPurchase && promotion.enabled && (!promotion.startsAt || now >= new Date(promotion.startsAt)) && (!promotion.endsAt || now < new Date(promotion.endsAt));
  return { ...item, amountCents: active ? Math.round(item.regularCents / 2) : item.regularCents, firstPurchase: active, currency: "CNY" as const, promotionVersion: active ? promotion.version : null };
}
