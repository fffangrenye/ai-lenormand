import { createHash, createHmac, randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import { packagePrice, paidConfig } from "./config";
import { GoofishError, verifyRechargeDelivery, type VerifiedOrder, type RechargeExpectation } from "../payments/goofish";
import { localAdminKey } from "./admin-auth";

type Row = Record<string, string | number | null>;
type Port = {
  one: (sql: string, ...params: SQLInputValue[]) => Row | undefined;
  all: (sql: string, ...params: SQLInputValue[]) => Row[];
  run: (sql: string, ...params: SQLInputValue[]) => unknown;
  tx: <T>(action: () => T) => T;
  clock: () => number;
  grant: (user: string, count: number, source: string, event: string, reason?: string) => string;
  ledger: (user: string, batch: string, event: string, kind: string, available: number, reserved: number, consumed: number, reason: string) => void;
};
export type XianyuProduct = {
  packageId: string; firstPurchase: boolean; goodsNo: string;
  sellerIdentity: string; productId: string; itemId: string;
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// Deliberately has no public HTTP route. Real activation still requires the
// private merchant configuration, approved product mappings and a public gateway.
export class LocalXianyuPayments {
  constructor(private readonly db: Port) {}
  private accountCode(id: string) { return `FL${createHmac("sha256",localAdminKey()).update(`xianyu-checkout:${id}`).digest("hex").slice(0,32).toUpperCase()}`; }
  private first(user: string) {
    return !this.db.one("SELECT 1 FROM local_purchase_history WHERE user_id=? UNION ALL SELECT 1 FROM credit_batches WHERE user_id=? AND source='purchase' LIMIT 1", user, user);
  }
  prepare(user: string, packageId: string, requestKey: string, products: XianyuProduct[], readingId?: string) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey)) throw new GoofishError("INVALID_REQUEST_KEY");
    if (!this.db.one("SELECT id FROM local_users WHERE id=?", user)) throw new GoofishError("UNAUTHORIZED");
    return this.db.tx(() => {
      // A retry must not mint another account code. Only a hash is persisted;
      // callers keep the original checkout response until it expires.
      const previous = this.db.one("SELECT * FROM local_xianyu_intents WHERE user_id=? AND request_key=?", user, requestKey);
      if (previous) {
        const expectedGoods = `flora-${packageId}-${previous.first_purchase ? "first" : "regular"}`;
        if (previous.goods_no !== expectedGoods || (previous.reading_id || "") !== (readingId || "")) throw new GoofishError("REQUEST_CONFLICT");
        return this.order(user,String(previous.id));
      }
      const pending = this.db.one("SELECT id FROM local_xianyu_intents WHERE user_id=? AND state='pending' AND expires_at>?", user, this.db.clock());
      if (pending) throw new GoofishError("OPEN_CHECKOUT");
      const recent=this.db.one("SELECT count(*) n FROM local_xianyu_intents WHERE user_id=? AND created_at>?",user,this.db.clock()-60000);
      if (Number(recent?.n)>=8) throw new GoofishError("CHECKOUT_RATE_LIMIT");
      const first = this.first(user), price = packagePrice(packageId, new Date(this.db.clock()), paidConfig, first);
      const product = products.find(x => x.packageId === packageId && x.firstPurchase === price.firstPurchase);
      if (!product || !product.goodsNo || !product.sellerIdentity || !product.productId || !product.itemId) throw new GoofishError("PRODUCT_NOT_CONFIGURED");
      let returnPath = "/profile";
      if (readingId) {
        const reading=this.db.one("SELECT r.id,p.project_id FROM paid_readings r LEFT JOIN local_reading_projects p ON p.reading_id=r.id WHERE r.user_id=? AND r.id=?",user,readingId);
        if (!reading) throw new GoofishError("NOT_FOUND");
        returnPath=reading.project_id ? `/deep/project/${encodeURIComponent(String(reading.project_id))}?view=history&reading=${encodeURIComponent(readingId)}#reading-${encodeURIComponent(readingId)}` : "/deep";
      }
      const id = randomUUID(), accountCode = this.accountCode(id), expiresAt = this.db.clock() + 30 * 60000;
      this.db.run("INSERT INTO local_xianyu_intents(id,user_id,request_key,account_hash,goods_no,seller_identity,product_id,item_id,credits,amount_cents,first_purchase,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", id,user,requestKey,hash(accountCode),product.goodsNo,product.sellerIdentity,product.productId,product.itemId,price.credits,price.amountCents,Number(price.firstPurchase),this.db.clock(),expiresAt);
      this.db.run("UPDATE local_xianyu_intents SET reading_id=?,return_path=? WHERE id=?",readingId||null,returnPath,id);
      return this.order(user,id);
    });
  }
  order(user: string, id: string) {
    const row = this.db.one("SELECT i.*,d.xianyu_order_no FROM local_xianyu_intents i LEFT JOIN local_xianyu_deliveries d ON d.intent_id=i.id WHERE i.user_id=? AND i.id=?", user,id);
    if (!row) throw new GoofishError("NOT_FOUND");
    const accountCode=this.accountCode(String(row.id));
    return { id:String(row.id), goodsNo:String(row.goods_no), credits:Number(row.credits), amountCents:Number(row.amount_cents), state:row.state === "pending" && Number(row.expires_at) <= this.db.clock() ? "expired" : String(row.state), expiresAt:Number(row.expires_at),
      accountCode:row.state === "pending" && hash(accountCode) === row.account_hash ? accountCode : "", purchaseUrl:`https://www.goofish.com/item?id=${encodeURIComponent(String(row.item_id))}`, firstPurchase:Boolean(row.first_purchase), createdAt:Number(row.created_at), returnPath:String(row.return_path), readingId:row.reading_id as string|null, xianyuOrderNo:row.xianyu_order_no as string|null,
      refundStatus:Number(row.refund_status),refundedCents:Number(row.refunded_cents),heldCredits:Number(row.held_credits),refundedCredits:Number(row.refunded_credits),refundReview:Boolean(row.refund_review),syncedAt:Number(row.sync_at) };
  }
  orders(user:string) { return this.db.all("SELECT id FROM local_xianyu_intents WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200",user).map(x=>this.order(user,String(x.id))); }
  cancel(user:string,id:string) {
    this.order(user,id);
    this.db.tx(()=>{this.db.run("UPDATE local_xianyu_intents SET state='expired',expires_at=? WHERE user_id=? AND id=? AND state='pending'",this.db.clock(),user,id);});
    return this.order(user,id);
  }
  adminOrders() { return this.db.all("SELECT id,user_id FROM local_xianyu_intents ORDER BY created_at DESC,rowid DESC LIMIT 200").map(x=>({...this.order(String(x.user_id),String(x.id)),accountCode:"",userId:String(x.user_id)})); }
  reconcileQueue(user?:string) { return this.db.all(`SELECT d.xianyu_order_no FROM local_xianyu_deliveries d JOIN local_xianyu_intents i ON i.id=d.intent_id WHERE (? IS NULL OR i.user_id=?) AND i.sync_at<? ORDER BY i.sync_at LIMIT 20`,user||null,user||null,this.db.clock()-30000).map(x=>String(x.xianyu_order_no)); }
  syncRefund(order:VerifiedOrder) {
    return this.db.tx(()=>{
      const row=this.db.one("SELECT i.*,d.batch_id FROM local_xianyu_intents i JOIN local_xianyu_deliveries d ON d.intent_id=i.id WHERE d.xianyu_order_no=?",order.orderNo);
      if (!row || order.sellerIdentity !== row.seller_identity || order.productId !== row.product_id || order.itemId !== row.item_id || order.paidCents !== row.amount_cents || order.orderType !== 8 || order.quantity !== 1) throw new GoofishError("REFUND_ORDER_MISMATCH");
      if (order.refundedCents < Number(row.refunded_cents) || order.refundedCents > Number(row.amount_cents)) throw new GoofishError("STALE_REFUND_RESPONSE");
      if (!Number.isSafeInteger(order.updatedAt) || order.updatedAt < Number(row.provider_updated_at)) throw new GoofishError("STALE_REFUND_RESPONSE");
      if (order.updatedAt === Number(row.provider_updated_at) && order.refundState !== Number(row.refund_status) && order.refundedCents === Number(row.refunded_cents)) throw new GoofishError("STALE_REFUND_RESPONSE");
      const batch=row.batch_id ? this.db.one("SELECT * FROM credit_batches WHERE id=?",row.batch_id) : undefined;
      const completed=Math.ceil(Number(row.credits)*order.refundedCents/Number(row.amount_cents));
      const pending=[1,2,3,8].includes(order.refundState);
      let held=Number(row.held_credits),revoked=Number(row.refunded_credits), review=0;
      if (batch) {
        const available=Number(batch.quantity)-Number(batch.consumed)-Number(batch.reserved)-Number(batch.revoked);
        const removable=available+held+revoked;
        const targetRevoked=Math.min(completed,removable);
        const targetHeld=pending ? Math.max(0,removable-targetRevoked) : 0;
        const delta=targetRevoked+targetHeld-held-revoked;
        if (delta) {
          this.db.run("UPDATE credit_batches SET revoked=revoked+? WHERE id=?",delta,batch.id);
          this.db.ledger(String(row.user_id),String(batch.id),`xianyu-refund:${order.orderNo}:${randomUUID()}`,"xianyu_refund",-delta,0,0,pending ? "闲鱼退款处理中，冻结本单未使用花瓣" : order.refundedCents ? "闲鱼退款已核实，调整对应购买花瓣" : "闲鱼退款已关闭，恢复冻结花瓣");
        }
        held=targetHeld;revoked=targetRevoked;
        review=Number(completed>removable || (pending && Number(batch.reserved)>0));
      }
      this.db.run("UPDATE local_xianyu_intents SET refund_status=?,refunded_cents=?,held_credits=?,refunded_credits=?,refund_review=?,sync_at=? WHERE id=?",order.refundState,order.refundedCents,held,revoked,review,this.db.clock(),row.id);
      this.db.run("UPDATE local_xianyu_intents SET provider_updated_at=? WHERE id=?",order.updatedAt,row.id);
      return this.order(String(row.user_id),String(row.id));
    });
  }
  delivery(providerOrderNo: string, outOrderNo?: string) {
    const row = this.db.one("SELECT d.*,i.goods_no,i.amount_cents,i.created_at FROM local_xianyu_deliveries d JOIN local_xianyu_intents i ON i.id=d.intent_id WHERE d.provider_order_no=?", providerOrderNo);
    if (!row || (outOrderNo && outOrderNo !== row.intent_id)) throw new GoofishError("NOT_FOUND");
    return { order_no:String(row.provider_order_no), out_order_no:String(row.intent_id), order_type:1, order_status:row.state === "granted" ? 20 : 10,
      order_amount:Number(row.amount_cents), goods_no:String(row.goods_no), order_time:Math.floor(Number(row.created_at)/1000),
      ...(row.state === "granted" ? {end_time:Math.floor(Number(row.received_at)/1000)} : {}) };
  }
  externalOrderNo(providerOrderNo:string) {
    const row=this.db.one("SELECT xianyu_order_no FROM local_xianyu_deliveries WHERE provider_order_no=?",providerOrderNo);
    if (!row) throw new GoofishError("NOT_FOUND"); return String(row.xianyu_order_no);
  }
  /** Called by authenticated gateway only, after a fresh order API query. */
  settle(body: Record<string, unknown>, order: VerifiedOrder, products: XianyuProduct[]) {
    if (!body.biz_content || typeof body.biz_content !== "object" || Array.isArray(body.biz_content)) throw new GoofishError("RECHARGE_BINDING_MISMATCH");
    const accountCode = (body.biz_content as Record<string,unknown>).account;
    if (typeof accountCode !== "string" || !/^FL[A-F0-9]{32}$/.test(accountCode)) throw new GoofishError("RECHARGE_BINDING_MISMATCH");
    return this.db.tx(() => {
      const row = this.db.one("SELECT * FROM local_xianyu_intents WHERE account_hash=?", hash(accountCode));
      if (!row) throw new GoofishError("RECHARGE_BINDING_MISMATCH");
      const product = products.find(x => x.goodsNo === row.goods_no && x.sellerIdentity === row.seller_identity && x.productId === row.product_id && x.itemId === row.item_id);
      if (!product) throw new GoofishError("PRODUCT_NOT_CONFIGURED");
      const expected: RechargeExpectation = { ...product, orderNo: order.orderNo, accountCode, amountCents:Number(row.amount_cents) };
      const receipt = verifyRechargeDelivery(body, order, expected);
      const evidence = hash(JSON.stringify({ ...receipt, accountHash:hash(accountCode), goodsNo:body.goods_no, seller:order.sellerIdentity, item:order.itemId, product:order.productId, amount:order.paidCents }));
      const previous = this.db.one("SELECT * FROM local_xianyu_deliveries WHERE provider_order_no=? OR xianyu_order_no=? OR intent_id=?", receipt.providerOrderNo,receipt.xianyuOrderNo,row.id);
      if (previous) {
        if (previous.evidence_hash !== evidence) throw new GoofishError("RECHARGE_ALREADY_CLAIMED");
        return { state:String(previous.state), duplicate:true };
      }
      // A genuinely paid late order is retained for review rather than silently
      // discarded or given a second first-purchase discount.
      const review = Number(row.expires_at) <= this.db.clock() || (Boolean(row.first_purchase) && !this.first(String(row.user_id)));
      const batch = review ? null : this.db.grant(String(row.user_id), Number(row.credits), "purchase", `purchase:xianyu:${order.orderNo}`, `闲鱼充值 ${row.credits} 花瓣 · 订单 ${order.orderNo}`);
      this.db.run("INSERT INTO local_xianyu_deliveries VALUES(?,?,?,?,?,?,?)", receipt.providerOrderNo,receipt.xianyuOrderNo,row.id,evidence,batch,review ? "review" : "granted",this.db.clock());
      this.db.run("UPDATE local_xianyu_intents SET state=? WHERE id=?", review ? "review" : "paid",row.id);
      this.db.run("UPDATE local_xianyu_intents SET sync_at=? WHERE id=?",this.db.clock(),row.id);
      return { state:review ? "review" : "granted", duplicate:false };
    });
  }
}
