import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { PaidLedger } from "../paid-local/ledger";
import { LocalPaidError } from "../paid-local/guard";
import { guidedAction } from "../guided-reading/actions";
import { onionEvent, onionEventActive } from "../guided-reading/onion-event";
import { schema } from "../../workers/flora-api/schema";
import { GuidedCoupons } from "../guided-reading/coupons";

const start = Date.parse(onionEvent.startsAt), end = Date.parse(onionEvent.endsAt);
const code = (expected: string) => (error: unknown) => error instanceof LocalPaidError && error.code === expected;

function fixture() {
  const db = new DatabaseSync(":memory:"); db.exec(schema);
  let now = start;
  const transaction = <T>(work: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try { const value = work(); db.exec("COMMIT"); return value; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const store = new PaidLedger(db, transaction, () => now);
  const owner = randomUUID(), other = randomUUID();
  store.ensureUser(owner, "new@example.invalid"); store.ensureUser(other, "old@example.invalid");
  const coupons = store.guidedCoupons();
  return { db, store, coupons, owner, other, setTime: (value: number) => { now = value; } };
}

test("gift window is exactly two hours in Beijing, excluding midnight", () => {
  assert.equal(end - start, 2 * 3600_000);
  assert.equal(onionEventActive(start - 1), false);
  assert.equal(onionEventActive(start), true);
  assert.equal(onionEventActive(Date.parse("2026-11-24T00:00:00+08:00")), false);
  assert.equal(onionEventActive(end - 1), true);
  assert.equal(onionEventActive(end), false);
  assert.equal(onionEventActive(start + 86400_000), false);
});

test("new and old accounts claim once, retries reuse the same coupon, server rejects outside window", () => {
  const f = fixture();
  try {
    f.setTime(start - 1); assert.throws(() => f.coupons.claim(f.owner), code("EVENT_CLOSED"));
    f.setTime(start);
    const first = f.coupons.claim(f.owner), again = f.coupons.claim(f.owner);
    assert.equal(first.newlyClaimed, true); assert.equal(again.newlyClaimed, false);
    assert.deepEqual(again.coupon, first.coupon);
    assert.equal(Date.parse(first.coupon!.expiresAt) - Date.parse(first.coupon!.claimedAt), 7 * 86400_000);
    f.setTime(end - 1); assert.ok(f.coupons.claim(f.other).coupon);
    assert.notEqual(f.coupons.status(f.other).coupon!.id, first.coupon!.id);
    assert.equal((f.db.prepare("SELECT count(*) AS n FROM guided_event_coupons").get()!).n, 2);
    f.setTime(end); assert.throws(() => f.coupons.claim(f.owner), code("EVENT_CLOSED"));
    assert.ok(f.coupons.available(f.owner)); // Claim window closes, use window stays open.
  } finally { f.db.close(); }
});

test("five hundred unique claims exhaust inventory while displayed limit stays 1000; retries and restarts do not replenish it", () => {
  const f = fixture();
  try {
    const first = f.coupons.claim(f.owner);
    for (let i = 1; i < onionEvent.claimLimit; i++) f.coupons.claim(randomUUID());
    const full = f.coupons.status(f.other);
    assert.equal(full.claimLimit, 500); assert.equal(full.displayClaimLimit, 1000);
    assert.equal(full.remaining, 0); assert.equal(full.soldOut, true);
    assert.throws(() => f.coupons.claim(f.other), code("EVENT_SOLD_OUT"));
    assert.equal(f.coupons.status(f.other).coupon, null);
    const retry = f.coupons.claim(f.owner);
    assert.equal(retry.newlyClaimed, false); assert.deepEqual(retry.coupon, first.coupon);
    const reopened = new PaidLedger(f.db, work => {
      f.db.exec("BEGIN IMMEDIATE");
      try { const value = work(); f.db.exec("COMMIT"); return value; } catch (error) { f.db.exec("ROLLBACK"); throw error; }
    }, () => start).guidedCoupons();
    assert.equal(reopened.status(f.other).remaining, 0);
    assert.throws(() => reopened.claim(f.other), code("EVENT_SOLD_OUT"));
    f.db.prepare("UPDATE guided_event_coupons SET used_at=?,session_id=? WHERE owner=?").run(new Date(start).toISOString(), randomUUID(), f.owner);
    assert.equal(reopened.status(f.other).remaining, 0);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM guided_event_coupons WHERE campaign_id=?").get(onionEvent.id)!.n, 500);
    f.setTime(end); assert.throws(() => f.coupons.claim(f.other), code("EVENT_CLOSED"));
  } finally { f.db.close(); }
});

test("failed coupon insert rolls back its inventory slot, and initial counter includes preexisting coupons", () => {
  const f = fixture();
  try {
    f.db.exec("CREATE TRIGGER fail_coupon BEFORE INSERT ON guided_event_coupons BEGIN SELECT RAISE(ABORT,'fixture'); END");
    assert.throws(() => f.coupons.claim(f.owner));
    assert.equal(f.coupons.status(f.owner).remaining, 500);
    f.db.exec("DROP TRIGGER fail_coupon");
    f.coupons.claim(f.owner);
    assert.equal(f.coupons.status(f.owner).remaining, 499);
    f.db.prepare("DELETE FROM guided_event_inventory WHERE campaign_id=?").run(onionEvent.id);
    const restored = new GuidedCoupons(f.db, work => {
      f.db.exec("BEGIN IMMEDIATE");
      try { const value = work(); f.db.exec("COMMIT"); return value; } catch (error) { f.db.exec("ROLLBACK"); throw error; }
    }, () => start);
    assert.equal(restored.status(f.owner).remaining, 499);
    assert.equal(restored.claim(f.owner).newlyClaimed, false);
    assert.equal(restored.status(f.owner).remaining, 499);
  } finally { f.db.close(); }
});

test("coupon covers nine rounds plus summary with no petal debit, and first-card retry is idempotent", async () => {
  const f = fixture();
  try {
    const guided = f.store.guidedPreview();
    assert.throws(() => guided.checkStartBalance(f.owner), code("NO_CREDITS"));
    f.coupons.claim(f.owner);
    const before = f.store.summary(f.owner).balance;
    let session = guided.start(f.owner, "未来三个月这段关系如何发展？", "最近联系少了", randomUUID());
    assert.equal(session.petalPrice, 0); assert.ok(session.couponId);
    assert.equal(f.coupons.status(f.owner).coupon!.usedAt, null);
    session = await guided.advance(f.owner, session.id);
    for (let step = 0; step < 9; step++) {
      const planId = session.plan!.id, question = session.plan!.groups[0][0];
      const drawn = guided.draw(f.owner, session.id, step, question, false, planId);
      if (step === 0) {
        assert.equal(f.coupons.status(f.owner).coupon!.sessionId, session.id);
        assert.deepEqual(guided.draw(f.owner, session.id, step, question, false, planId), drawn);
        // Can finish an already opened session after the coupon's expiry.
        f.setTime(start + onionEvent.validForMs + 1);
      }
      session = await guided.advance(f.owner, session.id);
      session = await guided.advance(f.owner, session.id);
    }
    assert.equal(session.cards.length, 9); assert.ok(session.final);
    assert.deepEqual(f.store.summary(f.owner).balance, before);
    assert.equal(f.coupons.available(f.owner), null);
  } finally { f.db.close(); }
});

test("two sessions cannot use one coupon, and a different account cannot read or spend it", async () => {
  const f = fixture();
  try {
    f.coupons.claim(f.owner);
    const guided = f.store.guidedPreview();
    const one = await guided.advance(f.owner, guided.start(f.owner, "关系怎样发展？", "", randomUUID()).id);
    const two = await guided.advance(f.owner, guided.start(f.owner, "如何更好地沟通？", "", randomUUID()).id);
    guided.draw(f.owner, one.id, 0, one.plan!.groups[0][0], false, one.plan!.id);
    assert.throws(() => guided.draw(f.owner, two.id, 0, two.plan!.groups[0][0], false, two.plan!.id), code("COUPON_UNAVAILABLE"));
    assert.equal(guided.open(f.owner, two.id).cards.length, 0);
    assert.throws(() => guided.open(f.other, one.id), code("NOT_FOUND"));
    assert.throws(() => guided.checkStartBalance(f.other), code("NO_CREDITS"));
    assert.equal(f.store.summary(f.owner).balance.available, 1);
  } finally { f.db.close(); }
});

test("an expired coupon never silently falls back to spending the user's petals", async () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE credit_batches SET quantity=10,source='purchase' WHERE user_id=?").run(f.owner);
    f.coupons.claim(f.owner);
    const guided = f.store.guidedPreview();
    const session = await guided.advance(f.owner, guided.start(f.owner, "未来怎样发展？", "", randomUUID()).id);
    f.setTime(start + onionEvent.validForMs);
    assert.throws(() => guided.draw(f.owner, session.id, 0, session.plan!.groups[0][0], false, session.plan!.id), code("COUPON_EXPIRED"));
    assert.equal(f.store.summary(f.owner).balance.available, 10);
    assert.equal(guided.open(f.owner, session.id).cards.length, 0);
    assert.equal(guided.start(f.owner, "换一个问题？", "", randomUUID()).petalPrice, 3);
  } finally { f.db.close(); }
});

test("first-card persistence failure rolls back coupon consumption in the same transaction", async () => {
  const f = fixture();
  try {
    f.coupons.claim(f.owner);
    const guided = f.store.guidedPreview();
    const session = await guided.advance(f.owner, guided.start(f.owner, "如何沟通？", "", randomUUID()).id);
    f.db.exec("CREATE TRIGGER fail_card_save BEFORE UPDATE ON guided_preview_sessions BEGIN SELECT RAISE(ABORT,'fixture'); END");
    assert.throws(() => guided.draw(f.owner, session.id, 0, session.plan!.groups[0][0], false, session.plan!.id));
    assert.equal(f.coupons.status(f.owner).coupon!.usedAt, null);
    assert.equal(guided.open(f.owner, session.id).cards.length, 0);
    f.db.exec("DROP TRIGGER fail_card_save");
    assert.equal(guided.draw(f.owner, session.id, 0, session.plan!.groups[0][0], false, session.plan!.id).cards.length, 1);
  } finally { f.db.close(); }
});

test("ordinary paid onions still debit three petals once; a newly claimed coupon takes priority", async () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE credit_batches SET quantity=10,source='purchase' WHERE user_id=?").run(f.owner);
    const guided = f.store.guidedPreview();
    const paid = await guided.advance(f.owner, guided.start(f.owner, "怎样沟通？", "", randomUUID()).id);
    assert.equal(paid.petalPrice, 3);
    guided.draw(f.owner, paid.id, 0, paid.plan!.groups[0][0], false, paid.plan!.id);
    guided.draw(f.owner, paid.id, 0, paid.plan!.groups[0][0], false, paid.plan!.id);
    assert.equal(f.store.summary(f.owner).balance.available, 7);
    const waiting = await guided.advance(f.owner, guided.start(f.owner, "如何认识新朋友？", "", randomUUID()).id);
    f.coupons.claim(f.owner);
    const gift = guided.draw(f.owner, waiting.id, 0, waiting.plan!.groups[0][0], false, waiting.plan!.id);
    assert.ok(gift.couponId); assert.equal(gift.petalPrice, 0);
    assert.equal(f.store.summary(f.owner).balance.available, 7);
  } finally { f.db.close(); }
});

test("AI failure after coupon consumption preserves cards and permits retry without extra charge", async () => {
  const f = fixture();
  try {
    f.coupons.claim(f.owner);
    let fail = true;
    const guided = f.store.guidedPreview(async (_system, _user, _max, _id, kind) => {
      if (kind === "guided-step" && fail) { fail = false; throw new LocalPaidError("AI_NETWORK", "fixture", 503); }
      return kind === "guided-step" ? { interpretation: "先把已经知道的情况说清楚。" } : {};
    });
    const session = await guided.advance(f.owner, guided.start(f.owner, "怎样相处更自然？", "", randomUUID()).id);
    guided.draw(f.owner, session.id, 0, session.plan!.groups[0][0], false, session.plan!.id);
    const advance = () => guidedAction(guided, f.owner, "guided/advance", { id: session.id }, async () => null, () => {}, (_key, task) => task());
    await assert.rejects(advance(), error => error instanceof LocalPaidError && /不会再扣体验券/.test(error.message));
    assert.equal(guided.open(f.owner, session.id).cards.length, 1);
    assert.ok((await advance())!.rounds[0].interpretation);
    assert.equal(f.store.summary(f.owner).balance.available, 1);
  } finally { f.db.close(); }
});
