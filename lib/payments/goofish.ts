import { createHash, timingSafeEqual } from "node:crypto";

// Server-side protocol only. No browser cookies, user-submitted payment proof,
// or mock-payment signatures are accepted by this connector.
export class GoofishError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "GoofishError"; }
}
export type GoofishCredentials = { appId: string; appSecret: string };
export type VirtualCredentials = GoofishCredentials & { merchantId: string; merchantSecret: string };
const md5 = (value: string) => createHash("md5").update(value, "utf8").digest("hex");
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function credentials(value: GoofishCredentials) {
  if (!/^\d{1,20}$/.test(value.appId) || value.appSecret.length < 16 || value.appSecret.includes(",")) throw new GoofishError("INVALID_CONFIGURATION");
}
export function signGoofish(body: string, timestamp: number, value: GoofishCredentials) {
  credentials(value);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new GoofishError("INVALID_TIMESTAMP");
  return md5(`${value.appId},${md5(body)},${timestamp},${value.appSecret}`);
}
export function signVirtualSource(body: string, timestamp: number, value: VirtualCredentials) {
  credentials(value);
  if (!value.merchantId || /[,\s]/.test(value.merchantId) || value.merchantSecret.length < 16 || value.merchantSecret.includes(",")) throw new GoofishError("INVALID_CONFIGURATION");
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new GoofishError("INVALID_TIMESTAMP");
  return md5(`${value.appId},${value.appSecret},${md5(body)},${timestamp},${value.merchantId},${value.merchantSecret}`);
}

/** Query parameters and raw body must be the exact bytes sent by 闲管家. */
export function verifyVirtualRequest(body: string, query: URLSearchParams, value: VirtualCredentials, now = Date.now()) {
  if (Buffer.byteLength(body, "utf8") > 65536) throw new GoofishError("REQUEST_TOO_LARGE");
  for (const name of ["mch_id", "timestamp", "sign"]) if (query.getAll(name).length !== 1) throw new GoofishError("INVALID_SIGNATURE");
  const rawTime = query.get("timestamp")!;
  if (!/^[1-9]\d{8,10}$/.test(rawTime)) throw new GoofishError("INVALID_SIGNATURE");
  const timestamp = Number(rawTime), signature = query.get("sign")!;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > 300) throw new GoofishError("EXPIRED_SIGNATURE");
  if (query.get("mch_id") !== value.merchantId || !/^[a-f0-9]{32}$/.test(signature)) throw new GoofishError("INVALID_SIGNATURE");
  const expected = signVirtualSource(body, timestamp, value);
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) throw new GoofishError("INVALID_SIGNATURE");
  let data: unknown;
  try { data = JSON.parse(body); } catch { throw new GoofishError("INVALID_BODY"); }
  if (!plain(data)) throw new GoofishError("INVALID_BODY");
  return data;
}

export type VerifiedOrder = {
  orderNo: string; orderType: number; state: number; paidCents: number;
  paidAt: number; refundState: number; refundedCents: number; sellerIdentity: string;
  productId: string; itemId: string; quantity: number;
  updatedAt: number;
};
function integer(value: unknown, name: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new GoofishError(`INVALID_${name}`);
  return value as number;
}
function identifier(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^[1-9]\d{0,29}$/.test(value)) return value;
  throw new GoofishError("INVALID_IDENTIFIER");
}
function normalizeOrder(value: unknown, expectedOrderNo: string): VerifiedOrder {
  if (!plain(value) || !plain(value.goods) || value.order_no !== expectedOrderNo || typeof value.seller_eid !== "string" || !value.seller_eid) throw new GoofishError("INVALID_ORDER_RESPONSE");
  return {
    orderNo: expectedOrderNo, orderType: integer(value.order_type, "ORDER_TYPE", 1), state: integer(value.order_status, "ORDER_STATE", 1),
    paidCents: integer(value.pay_amount, "PAID_AMOUNT"), paidAt: integer(value.pay_time, "PAID_TIME"),
    refundState: integer(value.refund_status, "REFUND_STATE"), refundedCents: integer(value.refund_amount, "REFUND_AMOUNT"),
    sellerIdentity: value.seller_eid, productId: identifier(value.goods.product_id), itemId: identifier(value.goods.item_id),
    quantity: integer(value.goods.quantity, "QUANTITY", 1),
    updatedAt: integer(value.update_time, "UPDATE_TIME", 1),
  };
}

/** Only the documented, fixed HTTPS order-query endpoint is allowed. */
export class GoofishOrderClient {
  constructor(private readonly config: GoofishCredentials, private readonly fetcher: typeof fetch = fetch, private readonly clock = Date.now) { credentials(config); }
  async order(orderNo: string): Promise<VerifiedOrder> {
    if (!/^[1-9]\d{9,29}$/.test(orderNo)) throw new GoofishError("INVALID_ORDER_NUMBER");
    const body = JSON.stringify({ order_no: orderNo }), timestamp = Math.floor(this.clock() / 1000);
    const url = new URL("https://open.goofish.pro/api/open/order/detail");
    url.search = new URLSearchParams({ appid: this.config.appId, timestamp: String(timestamp), sign: signGoofish(body, timestamp, this.config) }).toString();
    let response: Response;
    try {
      response = await this.fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
    } catch { throw new GoofishError("ORDER_QUERY_UNAVAILABLE"); }
    // Never surface URLs, signed query parameters, raw replies or buyer details.
    if (!response.ok) throw new GoofishError("ORDER_QUERY_UNAVAILABLE");
    let result: unknown;
    try { result = await response.json(); } catch { throw new GoofishError("INVALID_ORDER_RESPONSE"); }
    if (!plain(result) || result.code !== 0) throw new GoofishError("ORDER_QUERY_REJECTED");
    return normalizeOrder(result.data, orderNo);
  }
}

export type RechargeExpectation = {
  orderNo: string; accountCode: string; goodsNo: string; sellerIdentity: string;
  productId: string; itemId: string; amountCents: number;
};
/**
 * Call only after verifyVirtualRequest AND a fresh server-to-server order query.
 * max_amount is a merchant cost ceiling, NOT proof of the buyer's payment.
 * The caller must atomically claim both order numbers and the one-use account
 * code in the ledger before granting petals or reporting recharge success.
 */
export function verifyRechargeDelivery(body: Record<string, unknown>, order: VerifiedOrder, expected: RechargeExpectation) {
  if (!plain(body.biz_content) || body.biz_content.account !== expected.accountCode || body.goods_no !== expected.goodsNo || body.biz_order_no !== expected.orderNo || body.biz_order_no !== order.orderNo || typeof body.order_no !== "string" || !/^[1-9]\d{9,29}$/.test(body.order_no)) throw new GoofishError("RECHARGE_BINDING_MISMATCH");
  if (body.buy_quantity !== 1 || order.quantity !== 1 || order.orderType !== 8) throw new GoofishError("UNSUPPORTED_ORDER_TYPE");
  if (order.sellerIdentity !== expected.sellerIdentity || order.productId !== expected.productId || order.itemId !== expected.itemId) throw new GoofishError("WRONG_SELLER_OR_PRODUCT");
  if (!Number.isSafeInteger(expected.amountCents) || expected.amountCents <= 0 || order.paidCents !== expected.amountCents) throw new GoofishError("PAYMENT_AMOUNT_MISMATCH");
  if (![12,21,22].includes(order.state) || order.paidAt <= 0 || ![0,4,6].includes(order.refundState) || order.refundedCents !== 0) throw new GoofishError("PAYMENT_NOT_SETTLED");
  if (body.product_id !== undefined && identifier(body.product_id) !== expected.productId) throw new GoofishError("WRONG_SELLER_OR_PRODUCT");
  if (body.item_id !== undefined && identifier(body.item_id) !== expected.itemId) throw new GoofishError("WRONG_SELLER_OR_PRODUCT");
  return { providerOrderNo: body.order_no, xianyuOrderNo: order.orderNo };
}
