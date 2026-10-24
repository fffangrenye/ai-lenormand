import type { DeepSpreadId } from "../deep-spreads";
import type { DailyFortune, DailyFortuneCard } from "../daily-fortune";
export type DailyFortuneEntry = { date: string; card: DailyFortuneCard; fortune: DailyFortune; createdAt: string };
export type DailyCheckInState = {
  userId: string; today: string; timeZone: "Asia/Shanghai"; serverNow: string; nextResetAt: string; month: string;
  todayEntry: DailyFortuneEntry | null; entries: DailyFortuneEntry[];
  totalDays: number; currentStreak: number; totalRewards: number; rewardEvery: number; cycleDays: number; nextRewardIn: number;
  balance: { available: number; reserved: number; consumed: number };
};
export type DailyCheckInResult = DailyCheckInState & { entry: DailyFortuneEntry; newlyCheckedIn: boolean; grantedMilestones: number[] };
export type PaidSpread = DeepSpreadId;
export type PaidCard = { number: number; slug: string; nameEn: string; nameZh: string; position: string };
export type PaidResult = { conclusion: string; interpretation: string; uncertainty: string; advice: string; model: string; promptVersion: string; legacy?:{sourceRecord:Record<string,unknown>;sourceCards:Record<string,unknown>[];messages:{id:string;role:"user"|"assistant";content:string;created_at:string}[]} };
export type PaidReading = {
  projectId?: string; choices?: string[];
  id: string; question: string; spread: PaidSpread; cards: PaidCard[];
  state: "locked" | "generating" | "completed" | "failed";
  createdAt: string; completedAt?: string | null; result: PaidResult | null; followUpsRemaining: number;
  legacyRestored?:boolean;legacyMessages?:{id:string;role:"user"|"assistant";content:string;createdAt:string}[];
  followUps: { id: string; question: string; answer: string; createdAt: string }[];
};
export type PaidDrawSession = {
  id: string; projectId: string; question: string; spread: PaidSpread; choices: string[];
  deck: { token: string; picked: boolean }[]; selected: PaidCard[];
  selectedTokens?: string[];
  state: "picking" | "completed" | "abandoned"; readingId: string | null;
};
export type PaidProject = {
  id: string; userEmail: string; title: string; background: string; memorySummary: string;
  createdAt: string; updatedAt: string; lastOpenedAt: string;
};
export type PaidOverview = {
  user: { id: string; label: string; kind: string };
  balance: { available: number; reserved: number; consumed: number };
  readings: PaidReading[];
  historyCursor?: string | null;
  ledger: PaidLedgerEntry[];
  ledgerCursor?: string | null;
};
export type PaidLedgerEntry = { id: string; kind: string; availableDelta: number; reservedDelta: number; consumedDelta: number; reason: string; createdAt: string };
export type PaidLedgerPage = { items: PaidLedgerEntry[]; nextCursor: string | null };
export type PaidSummary = Pick<PaidOverview, "user" | "balance">;
export type PaidReadingPage = { items: PaidReading[]; nextCursor: string | null };

export type PaymentChannel = "wechat" | "waffo";
export type CodeReceipt = ReturnType<import("./redemption-store").LocalRedemptions["history"]>[number];
export type RedemptionResult = ReturnType<import("./redemption-store").LocalRedemptions["redeem"]>;
export type CodeAdminOverview = ReturnType<import("./redemption-store").LocalRedemptions["adminOverview"]>;
export type XianyuOrder = ReturnType<import("./xianyu-store").LocalXianyuPayments["order"]>;
export type XianyuCatalog = {enabled:boolean; packages:{id:string;ready:boolean;firstPurchase:boolean;amountCents:number;regularCents:number;credits:number}[];orders:XianyuOrder[];syncOk:boolean};
export type LocalOrder = {
 id: string; userId: string; packageId: string; credits: number; regularCents: number; amountCents: number; currency: "CNY";
 channel: PaymentChannel; promotionVersion: string | null;
 state: "pending" | "processing" | "paid" | "failed" | "cancelled" | "expired" | "review" | "refunding" | "partially_refunded" | "refunded";
 fulfillment: "none" | "granted" | "needs_review"; readingId: string | null; returnPath: string;
 createdAt: string; expiresAt: number; paidAt: string | null;
 refunds: {id:string; credits:number; amountCents:number; state:"pending"|"succeeded"|"failed";reason:string;createdAt:string}[];
};
export type PaymentCatalog = { firstPurchaseEligible: boolean; packages: ReturnType<typeof import("./config").packagePrice>[]; orders: LocalOrder[] };
export type PaymentAdminOverview = { users: {id:string;label:string;available:number;reserved:number;consumed:number;firstPurchaseUsed:boolean}[]; orders:LocalOrder[]; xianyuOrders?:(XianyuOrder & {userId:string})[]; audit:{id:string;actor:string;action:string;target:string;reason:string;createdAt:string}[] };
