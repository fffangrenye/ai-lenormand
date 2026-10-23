import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import { paidConfig, packagePrice } from "./config";
import { LocalPaidError, assertLocalEnvironment } from "./guard";
import { localAdminKey, validAdminKey, signMockNotification, verifyMockNotification } from "./admin-auth";
import type { LocalOrder, PaymentAdminOverview, PaymentCatalog, PaymentChannel } from "./types";

type Row = Record<string, string | number | null>;
type Database = {
  one: (sql: string, ...params: SQLInputValue[]) => Row | undefined;
  all: (sql: string, ...params: SQLInputValue[]) => Row[];
  run: (sql: string, ...params: SQLInputValue[]) => unknown;
  tx: <T>(action: () => T) => T;
  clock: () => number;
  grant: (user: string, count: number, source: string, event: string, reason?: string) => string;
  ledger: (user: string, batch: string, event: string, kind: string, available: number, reserved: number, consumed: number, reason: string) => void;
};
export type SimulationMode = "success" | "delay" | "failed" | "bad_amount" | "unfulfilled" | "duplicate";
export class LocalPayments {
  constructor(private db: Database) { localAdminKey(); }
  private now() { return new Date(this.db.clock()).toISOString(); }
  private key(key: string) { if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key || "")) throw new LocalPaidError("INVALID_REQUEST_KEY", "请刷新后重试。请求标识无效。"); }
  private user(id: string) { if (!this.db.one("SELECT id FROM local_users WHERE id=?", id)) throw new LocalPaidError("UNAUTHORIZED", "请先登录。", 401); }
  private owned(user: string, id: string) {
    const row = this.db.one("SELECT * FROM local_orders WHERE id=? AND user_id=?", id, user);
    if (!row) throw new LocalPaidError("NOT_FOUND", "订单不存在。", 404);
    return row;
  }
  private serialize(row: Row): LocalOrder {
    return { id: String(row.id), userId: String(row.user_id), packageId: String(row.package_id), credits: Number(row.credits), regularCents: Number(row.regular_cents), amountCents: Number(row.amount_cents), currency: "CNY", channel: row.channel as PaymentChannel, promotionVersion: row.promotion_version as string | null, state: row.state as LocalOrder["state"], fulfillment: row.fulfillment as LocalOrder["fulfillment"], readingId: row.reading_id as string | null, returnPath: String(row.return_path), createdAt: String(row.created_at), expiresAt: Number(row.expires_at), paidAt: row.paid_at as string | null,
      refunds: this.db.all("SELECT * FROM local_refunds WHERE order_id=? ORDER BY created_at DESC,rowid DESC", row.id).map(x => ({ id: String(x.id), credits: Number(x.credits), amountCents: Number(x.amount_cents), state: x.state as "pending" | "succeeded" | "failed", reason: String(x.reason), createdAt: String(x.created_at) })) };
  }
  private expire(user: string) {
    this.db.run("UPDATE local_orders SET state='expired' WHERE user_id=? AND state='pending' AND expires_at<=? AND id NOT IN (SELECT order_id FROM local_payment_receipts WHERE status='success')", user, this.db.clock());
  }
  catalog(user: string): PaymentCatalog {
    this.user(user); const orders = this.orders(user);
    // A pre-V3 purchase batch also consumes first-purchase eligibility.
    const eligible = !this.db.one("SELECT 1 FROM local_purchase_history WHERE user_id=? UNION ALL SELECT 1 FROM credit_batches WHERE user_id=? AND source='purchase' LIMIT 1", user, user);
    return { firstPurchaseEligible: paidConfig.promotion.enabled && eligible, packages: paidConfig.packages.map(x => packagePrice(x.id, new Date(this.db.clock()), paidConfig, eligible)), orders };
  }
  orders(user: string) {
    this.user(user); this.sync(user);
    return this.db.all("SELECT * FROM local_orders WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200", user).map(x => this.serialize(x));
  }
  order(user: string, id: string) { this.owned(user, id); this.sync(user); return this.serialize(this.owned(user, id)); }
  create(user: string, input: {packageId: string; channel: string; requestKey: string; readingId?: string}) {
    this.key(input.requestKey); this.user(user); this.sync(user);
    if (!["wechat", "waffo"].includes(input.channel)) throw new LocalPaidError("INVALID_CHANNEL", "请选择微信或 Waffo。");
    return this.db.tx(() => {
      const previous = this.db.one("SELECT * FROM local_orders WHERE user_id=? AND request_key=?", user, input.requestKey);
      if (previous) {
        if (previous.package_id !== input.packageId || previous.channel !== input.channel || (previous.reading_id || "") !== (input.readingId || "")) throw new LocalPaidError("REQUEST_CONFLICT", "同一次下单不能修改套餐或支付方式。", 409);
        return this.serialize(previous);
      }
      this.expire(user);
      if (this.db.one("SELECT id FROM local_orders WHERE user_id=? AND state IN ('pending','processing','review')", user)) throw new LocalPaidError("OPEN_ORDER", "你有一笔待处理订单，请先继续、取消或核实原订单。", 409);
      const count = Number(this.db.one("SELECT count(*) n FROM local_orders WHERE user_id=? AND created_at>?", user, new Date(this.db.clock() - 60_000).toISOString())?.n || 0);
      if (count >= 8) throw new LocalPaidError("ORDER_RATE_LIMIT", "下单过于频繁，请稍后再试。", 429);
      let returnPath = "/profile";
      if (input.readingId) {
        const reading = this.db.one("SELECT r.id,p.project_id FROM paid_readings r LEFT JOIN local_reading_projects p ON p.reading_id=r.id WHERE r.user_id=? AND r.id=?", user, input.readingId);
        if (!reading) throw new LocalPaidError("NOT_FOUND", "找不到原解读记录。", 404);
        returnPath = reading.project_id ? `/deep/project/${encodeURIComponent(String(reading.project_id))}?view=history&reading=${encodeURIComponent(input.readingId)}#reading-${encodeURIComponent(input.readingId)}` : "/deep";
      }
      const first = !this.db.one("SELECT 1 FROM local_purchase_history WHERE user_id=? UNION ALL SELECT 1 FROM credit_batches WHERE user_id=? AND source='purchase' LIMIT 1", user, user);
      let price;
      try { price = packagePrice(input.packageId, new Date(this.db.clock()), paidConfig, first); }
      catch { throw new LocalPaidError("INVALID_PACKAGE", "套餐不存在。"); }
      const id = randomUUID();
      this.db.run("INSERT INTO local_orders(id,user_id,request_key,package_id,credits,regular_cents,amount_cents,currency,channel,promotion_version,state,reading_id,return_path,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)", id, user, input.requestKey, price.id, price.credits, price.regularCents, price.amountCents, price.currency, input.channel, price.promotionVersion, input.readingId || null, returnPath, this.now(), this.db.clock() + 15 * 60_000);
      return this.serialize(this.owned(user, id));
    });
  }
  cancel(user: string, id: string) {
    this.owned(user, id); this.sync(user);
    return this.db.tx(() => {
      const row = this.owned(user, id);
      if (this.db.one("SELECT 1 FROM local_payment_receipts WHERE order_id=? AND status='success'", id)) throw new LocalPaidError("PAYMENT_PROCESSING", "渠道已有付款记录，请等待核实到账；到账后可申请退款。", 409);
      if (row.state === "pending") this.db.run("UPDATE local_orders SET state='cancelled' WHERE id=?", id);
      return this.serialize(this.owned(user, id));
    });
  }
  simulate(user: string, id: string, mode: SimulationMode) {
    assertLocalEnvironment(); this.owned(user, id);
    if (!["success", "delay", "failed", "bad_amount", "unfulfilled", "duplicate"].includes(mode)) throw new LocalPaidError("INVALID_SIMULATION", "测试场景不存在。");
    this.db.tx(() => {
      const row = this.owned(user, id); const existing = this.db.one("SELECT * FROM local_payment_receipts WHERE order_id=?", id);
      if (!existing) {
        if (row.state !== "pending" || Number(row.expires_at) <= this.db.clock()) throw new LocalPaidError("ORDER_CLOSED", "订单已结束，请重新下单。", 409);
        this.db.run("INSERT INTO local_payment_receipts VALUES(?,?,?,?,?,?,?,?)", id, row.channel, `mock_${randomUUID()}`, Number(row.amount_cents) + (mode === "bad_amount" ? 1 : 0), row.currency, mode === "failed" ? "failed" : "success", this.db.clock() + (mode === "delay" ? 15_000 : 0), this.now());
        this.db.run("UPDATE local_orders SET state='processing' WHERE id=?", id);
      }
    });
    const receipt = this.db.one("SELECT * FROM local_payment_receipts WHERE order_id=?", id)!;
    if (mode !== "delay") this.deliver(receipt, mode === "unfulfilled");
    if (mode === "duplicate") this.deliver(receipt);
    return this.serialize(this.owned(user, id));
  }
  private deliver(receipt: Row, hold = false) {
    const payload = JSON.stringify({orderId:receipt.order_id, transactionId:receipt.transaction_id, channel:receipt.channel, amountCents:receipt.amount_cents, currency:receipt.currency, status:receipt.status, hold});
    this.notify(payload, signMockNotification(payload));
  }
  notify(payload: string, signature: string) {
    assertLocalEnvironment();
    if (!verifyMockNotification(payload, signature)) throw new LocalPaidError("INVALID_SIGNATURE", "模拟支付通知签名不正确。", 403);
    let event: {orderId:string;transactionId:string;channel:string;amountCents:number;currency:string;status:string;hold?:boolean};
    try { event = JSON.parse(payload); } catch { throw new LocalPaidError("INVALID_EVENT", "支付通知格式错误。"); }
    return this.db.tx(() => {
      const row = this.db.one("SELECT * FROM local_orders WHERE id=?", event.orderId);
      const receipt = this.db.one("SELECT * FROM local_payment_receipts WHERE order_id=?", event.orderId);
      if (!row || !receipt || receipt.transaction_id !== event.transactionId || receipt.channel !== event.channel || Number(receipt.amount_cents) !== event.amountCents || receipt.currency !== event.currency || receipt.status !== event.status) throw new LocalPaidError("UNVERIFIED_PAYMENT", "没有匹配的渠道付款记录。", 409);
      const eventKey = `notify:${event.channel}:${event.transactionId}`;
      if (this.db.one("SELECT 1 FROM local_payment_events WHERE event_key=?", eventKey)) return this.serialize(row);
      let outcome = "failed";
      if (event.status === "failed") {
        if (["pending","processing"].includes(String(row.state))) this.db.run("UPDATE local_orders SET state='failed' WHERE id=?", row.id);
      } else {
        const prior = this.db.one("SELECT first_order_id FROM local_purchase_history WHERE user_id=?", row.user_id);
        const oldPurchase = this.db.one("SELECT 1 FROM credit_batches WHERE user_id=? AND source='purchase' AND event_key<>? LIMIT 1", row.user_id, `purchase:v3:${row.id}`);
        if (event.channel !== row.channel || event.currency !== row.currency || event.amountCents !== Number(row.amount_cents) || (row.promotion_version && ((prior && prior.first_order_id !== row.id) || oldPurchase))) {
          this.db.run("UPDATE local_orders SET state='review',fulfillment='needs_review' WHERE id=?", row.id); outcome = "review";
        } else {
          this.db.run("INSERT OR IGNORE INTO local_purchase_history VALUES(?,?,?)", row.user_id, row.id, receipt.created_at);
          this.db.run("UPDATE local_orders SET state='paid',paid_at=? WHERE id=?", receipt.created_at, row.id);
          // Late success can invalidate a newer, still-unpaid first-discount quote.
          this.db.run("UPDATE local_orders SET state='cancelled' WHERE user_id=? AND id<>? AND promotion_version IS NOT NULL AND state='pending'", row.user_id, row.id);
          if (!event.hold) this.fulfill(String(row.id));
          outcome = event.hold ? "paid_unfulfilled" : "granted";
        }
      }
      this.db.run("INSERT INTO local_payment_events VALUES(?,?,?,?,?)", randomUUID(), eventKey, row.id, outcome, this.now());
      return this.serialize(this.db.one("SELECT * FROM local_orders WHERE id=?", row.id)!);
    });
  }
  private fulfill(id: string) {
    const row = this.db.one("SELECT * FROM local_orders WHERE id=?", id)!;
    if (row.fulfillment === "granted") return;
    if (row.state !== "paid") throw new LocalPaidError("PAYMENT_UNVERIFIED", "尚未核实支付，不能发放购买花瓣。", 409);
    const batch = this.db.grant(String(row.user_id), Number(row.credits), "purchase", `purchase:v3:${id}`, `充值 ${row.credits} 花瓣 · 订单 ${id}`);
    this.db.run("UPDATE local_orders SET fulfillment='granted',batch_id=? WHERE id=?", batch, id);
  }
  private sync(user: string) {
    for (const receipt of this.db.all("SELECT p.* FROM local_payment_receipts p JOIN local_orders o ON o.id=p.order_id WHERE o.user_id=? AND p.notify_after<=? AND NOT EXISTS(SELECT 1 FROM local_payment_events e WHERE e.event_key='notify:'||p.channel||':'||p.transaction_id)", user, this.db.clock())) this.deliver(receipt);
    this.db.tx(() => this.expire(user));
  }
  requestRefund(user: string, id: string, requestKey: string, reason: string, actor = `user:${user}`) {
    this.key(requestKey); this.owned(user, id);
    reason = this.reason(reason);
    return this.db.tx(() => {
      const previous = this.db.one("SELECT * FROM local_refunds WHERE request_key=?", requestKey);
      if (previous) { if (previous.order_id !== id || previous.reason !== reason) throw new LocalPaidError("REQUEST_CONFLICT", "退款请求已用于另一笔操作。", 409); return this.serialize(this.owned(user,id)); }
      const row = this.owned(user, id);
      if (!["paid","partially_refunded","review"].includes(String(row.state))) throw new LocalPaidError("REFUND_NOT_ALLOWED", "这笔订单目前不能申请退款。", 409);
      if (!this.db.one("SELECT 1 FROM local_payment_receipts WHERE order_id=? AND status='success'", id)) throw new LocalPaidError("PAYMENT_UNVERIFIED", "找不到已付款记录。", 409);
      let credits = 0; let amount = Number(this.db.one("SELECT amount_cents FROM local_payment_receipts WHERE order_id=?", id)!.amount_cents);
      if (row.batch_id) {
        const batch = this.db.one("SELECT * FROM credit_batches WHERE id=?", row.batch_id)!;
        if (Number(batch.reserved) > 0) throw new LocalPaidError("CREDITS_RESERVED", "这笔购买仍有花瓣正在解读中，请完成后再退款。", 409);
        credits = Number(batch.quantity) - Number(batch.consumed) - Number(batch.revoked);
        if (credits <= 0) throw new LocalPaidError("NO_REFUNDABLE_CREDITS", "这笔购买没有可退的未使用花瓣。", 409);
        amount = Math.floor(Number(row.amount_cents) * credits / Number(row.credits));
        this.db.run("UPDATE credit_batches SET revoked=revoked+? WHERE id=?", credits, row.batch_id);
        this.db.ledger(user, String(row.batch_id), `refund-hold:${requestKey}`, "refund_hold", -credits, 0, 0, `申请退款，冻结本单 ${credits} 花瓣`);
      }
      const refund = randomUUID();
      this.db.run("INSERT INTO local_refunds VALUES(?,?,?,?,?,'pending',?,?,NULL)", refund, id, requestKey, credits, amount, reason, this.now());
      this.db.run("UPDATE local_orders SET state='refunding' WHERE id=?", id);
      this.audit(actor, "refund_request", id, requestKey, reason);
      return this.serialize(this.owned(user,id));
    });
  }
  private reason(value: string) { if (!value?.trim() || value.trim().length > 300) throw new LocalPaidError("REASON_REQUIRED", "请填写 1–300 字的处理原因。"); return value.trim(); }
  private audit(actor: string, action: string, target: string, key: string, reason: string) { this.db.run("INSERT INTO local_payment_audit VALUES(?,?,?,?,?,?,?)", randomUUID(), actor, action, target, key, reason, this.now()); }
  adminLogin(key: string) {
    this.db.run("DELETE FROM local_admin_attempts WHERE created_at<?", this.db.clock() - 15 * 60_000);
    if (Number(this.db.one("SELECT count(*) n FROM local_admin_attempts")?.n || 0) >= 5) throw new LocalPaidError("ADMIN_RATE_LIMIT", "尝试过多，请 15 分钟后重试。", 429);
    if (!validAdminKey(key)) { this.db.run("INSERT INTO local_admin_attempts VALUES(?)", this.db.clock()); throw new LocalPaidError("ADMIN_UNAUTHORIZED", "管理员口令不正确。", 401); }
    const token = randomBytes(32).toString("hex");
    this.db.run("INSERT INTO local_admin_sessions VALUES(?,?)", createHash("sha256").update(token).digest("hex"), this.db.clock() + 2 * 3600_000);
    return token;
  }
  authenticateAdmin(token?: string) {
    if (!token || !this.db.one("SELECT 1 FROM local_admin_sessions WHERE token_hash=? AND expires_at>?", createHash("sha256").update(token).digest("hex"), this.db.clock())) throw new LocalPaidError("ADMIN_UNAUTHORIZED", "请先登录本地管理后台。", 401);
    return "local-admin";
  }
  adminLogout(token: string) { this.db.run("DELETE FROM local_admin_sessions WHERE token_hash=?", createHash("sha256").update(token).digest("hex")); }
  adminOverview(): PaymentAdminOverview {
    for (const user of this.db.all("SELECT id FROM local_users")) this.sync(String(user.id));
    return { users: this.db.all("SELECT u.id,u.label,coalesce(sum(b.quantity-b.reserved-b.consumed-b.revoked),0) available,coalesce(sum(b.reserved),0) reserved,coalesce(sum(b.consumed),0) consumed,EXISTS(SELECT 1 FROM local_purchase_history h WHERE h.user_id=u.id) OR EXISTS(SELECT 1 FROM credit_batches p WHERE p.user_id=u.id AND p.source='purchase') first_used FROM local_users u LEFT JOIN credit_batches b ON b.user_id=u.id GROUP BY u.id").map(x => ({id:String(x.id),label:String(x.label),available:Number(x.available),reserved:Number(x.reserved),consumed:Number(x.consumed),firstPurchaseUsed:Boolean(x.first_used)})),
      orders: this.db.all("SELECT * FROM local_orders ORDER BY created_at DESC,rowid DESC LIMIT 200").map(x => this.serialize(x)), audit: this.db.all("SELECT * FROM local_payment_audit ORDER BY created_at DESC,rowid DESC LIMIT 200").map(x => ({id:String(x.id),actor:String(x.actor),action:String(x.action),target:String(x.target),reason:String(x.reason),createdAt:String(x.created_at)})) };
  }
  reconcile(actor: string, id: string, requestKey: string, reason: string) {
    this.key(requestKey); reason = this.reason(reason);
    const row = this.db.one("SELECT * FROM local_orders WHERE id=?", id); if (!row) throw new LocalPaidError("NOT_FOUND", "订单不存在。", 404);
    const receipt = this.db.one("SELECT * FROM local_payment_receipts WHERE order_id=?", id);
    if (!receipt || receipt.status !== "success") throw new LocalPaidError("PAYMENT_UNVERIFIED", "渠道没有成功付款记录，不能确认到账。", 409);
    this.deliver(receipt);
    return this.db.tx(() => {
      const old = this.db.one("SELECT * FROM local_payment_audit WHERE request_key=?", requestKey);
      if (old && (old.target !== id || old.action !== "reconcile_and_reissue" || old.reason !== reason)) throw new LocalPaidError("REQUEST_CONFLICT", "请求已用于其他操作。", 409);
      if (!old) { this.fulfill(id); this.audit(actor, "reconcile_and_reissue", id, requestKey, reason); }
      return this.serialize(this.db.one("SELECT * FROM local_orders WHERE id=?", id)!);
    });
  }
  compensate(actor: string, user: string, count: number, requestKey: string, reason: string) {
    this.key(requestKey); this.user(user); reason = this.reason(reason);
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new LocalPaidError("INVALID_CREDITS", "每次补偿数量应为 1–100 花瓣。");
    this.db.tx(() => { const old = this.db.one("SELECT * FROM local_payment_audit WHERE request_key=?", requestKey); if (old) { if (old.target !== user || old.reason !== `${reason} · ${count} 花瓣` || old.action !== "compensation") throw new LocalPaidError("REQUEST_CONFLICT", "请求已经用于其他补偿。", 409); return; } this.db.grant(user, count, "admin_compensation", `compensation:v3:${requestKey}`, reason); this.audit(actor,"compensation",user,requestKey,`${reason} · ${count} 花瓣`); });
  }
  completeRefund(actor: string, refundId: string, success: boolean, requestKey: string, reason: string) {
    this.key(requestKey); reason = this.reason(reason);
    return this.db.tx(() => {
      const refund = this.db.one("SELECT * FROM local_refunds WHERE id=?", refundId); if (!refund) throw new LocalPaidError("NOT_FOUND", "退款单不存在。",404);
      const row = this.db.one("SELECT * FROM local_orders WHERE id=?", refund.order_id)!;
      if (refund.state !== "pending") return this.serialize(row);
      const credits = Number(refund.credits);
      if (row.batch_id && !success) { this.db.run("UPDATE credit_batches SET revoked=revoked-? WHERE id=?", credits,row.batch_id); this.db.ledger(String(row.user_id), String(row.batch_id),`refund-release:${refundId}`,"refund_release",credits,0,0,"退款未完成，恢复本单冻结花瓣"); }
      const next = success ? (!row.batch_id || credits === Number(row.credits) ? "refunded" : "partially_refunded") : (row.batch_id || row.fulfillment === "none" ? "paid" : "review");
      this.db.run("UPDATE local_refunds SET state=?,completed_at=? WHERE id=?", success ? "succeeded":"failed",this.now(),refundId);
      this.db.run("UPDATE local_orders SET state=? WHERE id=?", next,row.id);
      this.audit(actor,success?"refund_succeeded":"refund_failed",String(row.id),requestKey,reason);
      return this.serialize(this.db.one("SELECT * FROM local_orders WHERE id=?", row.id)!);
    });
  }
}
