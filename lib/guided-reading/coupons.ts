import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { LocalPaidError } from "../paid-local/guard";
import { onionEvent, onionEventActive, onionEventStatus, type OnionCoupon } from "./onion-event";

export const onionCouponSchema = `
  CREATE TABLE IF NOT EXISTS guided_event_coupons (
    campaign_id TEXT NOT NULL, owner TEXT NOT NULL, id TEXT NOT NULL UNIQUE,
    claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT,
    session_id TEXT UNIQUE, PRIMARY KEY(campaign_id, owner),
    CHECK((used_at IS NULL AND session_id IS NULL) OR (used_at IS NOT NULL AND session_id IS NOT NULL))
  );
  CREATE TABLE IF NOT EXISTS guided_event_inventory (
    campaign_id TEXT PRIMARY KEY, claimed INTEGER NOT NULL CHECK(claimed>=0)
  );
`;

export class GuidedCoupons {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transaction: <T>(work: () => T) => T,
    private readonly clock: () => number,
  ) {
    this.transaction(() => {
      this.db.exec(onionCouponSchema);
      if (!this.db.prepare("SELECT claimed FROM guided_event_inventory WHERE campaign_id=?").get(onionEvent.id)) {
        // Seed once from any coupons issued before the limit was introduced.
        this.db.prepare("INSERT INTO guided_event_inventory(campaign_id,claimed) SELECT ?,count(*) FROM guided_event_coupons WHERE campaign_id=?")
          .run(onionEvent.id, onionEvent.id);
      }
    });
  }

  eventStatus() { return onionEventStatus(this.clock()); }

  private read(owner: string): OnionCoupon | null {
    const row = this.db.prepare("SELECT id,claimed_at,expires_at,used_at,session_id FROM guided_event_coupons WHERE campaign_id=? AND owner=?").get(onionEvent.id, owner);
    return row ? {
      id: String(row.id), claimedAt: String(row.claimed_at), expiresAt: String(row.expires_at),
      usedAt: row.used_at === null ? null : String(row.used_at), sessionId: row.session_id === null ? null : String(row.session_id),
    } : null;
  }

  private inventory() {
    const claimed = Number(this.db.prepare("SELECT claimed FROM guided_event_inventory WHERE campaign_id=?").get(onionEvent.id)!.claimed);
    return { remaining: Math.max(0, onionEvent.claimLimit - claimed), soldOut: claimed >= onionEvent.claimLimit };
  }

  status(owner: string) { return { ...this.eventStatus(), ...this.inventory(), coupon: this.read(owner) }; }

  claim(owner: string) {
    return this.transaction(() => {
      const now = this.clock();
      if (!onionEventActive(now)) throw new LocalPaidError("EVENT_CLOSED", "领取时间为北京时间11月23日22:00至24日00:00。", 409);
      const prior = this.read(owner);
      if (!prior) {
        if (this.inventory().soldOut) throw new LocalPaidError("EVENT_SOLD_OUT", "本次洋葱体验券已领完，谢谢你的参与。", 409);
        // Inventory and issuance commit together in the single ledger DO's
        // synchronous transaction: concurrent claims cannot exceed the limit.
        this.db.prepare("UPDATE guided_event_inventory SET claimed=claimed+1 WHERE campaign_id=?").run(onionEvent.id);
        this.db.prepare("INSERT INTO guided_event_coupons(campaign_id,owner,id,claimed_at,expires_at) VALUES(?,?,?,?,?)")
          .run(onionEvent.id, owner, randomUUID(), new Date(now).toISOString(), new Date(now + onionEvent.validForMs).toISOString());
      }
      return { ...this.status(owner), newlyClaimed: !prior };
    });
  }

  available(owner: string) {
    const coupon = this.read(owner);
    return coupon && !coupon.usedAt && Date.parse(coupon.expiresAt) > this.clock() ? coupon : null;
  }

  // Called inside the SAME transaction that reveals and saves the first card.
  // A second tab cannot spend the same coupon on another session.
  consumeInTransaction(owner: string, couponId: string, sessionId: string) {
    const coupon = this.read(owner);
    if (!coupon || coupon.id !== couponId) throw new LocalPaidError("COUPON_UNAVAILABLE", "体验券不可用，请返回提问页重新开始。", 409);
    if (coupon.sessionId === sessionId) return;
    if (coupon.usedAt) throw new LocalPaidError("COUPON_UNAVAILABLE", "这张体验券已用于另一局，请返回提问页重新开始。", 409);
    const now = this.clock();
    if (Date.parse(coupon.expiresAt) <= now) throw new LocalPaidError("COUPON_EXPIRED", "体验券已过期，本次没有扣花瓣。请返回提问页重新开始。", 409);
    this.db.prepare("UPDATE guided_event_coupons SET used_at=?,session_id=? WHERE campaign_id=? AND owner=? AND id=? AND used_at IS NULL")
      .run(new Date(now).toISOString(), sessionId, onionEvent.id, owner, couponId);
  }
}
