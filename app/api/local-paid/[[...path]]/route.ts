import { NextRequest, NextResponse } from "next/server";
import { assertLocalRequest, isLocalPaidError, LocalPaidError } from "@/lib/paid-local/guard";
import { getPaidLocalStore } from "@/lib/paid-local/store";
import { generatePaidMain, generatePaidFollowUp } from "@/lib/paid-local/provider";
import QRCode from "qrcode";
import type { SimulationMode } from "@/lib/paid-local/payment-store";
import type { PaidSpread } from "@/lib/paid-local/types";
import { xianyuConfig, reconcileXianyu } from "@/lib/paid-local/xianyu-config";
import { GoofishError } from "@/lib/payments/goofish";
import { cardCatalog } from "@/lib/paid-local/card-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "flora_paid_local_session";
const adminCookie = "flora_paid_local_admin";
type Context = { params: { path?: string[] } };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof GoofishError) return json({code:error.code,message:({OPEN_CHECKOUT:"你有一笔待付款闲鱼订单，请先从订单记录继续。",PRODUCT_NOT_CONFIGURED:"闲鱼套餐仍在配置，请暂勿付款。",NOT_FOUND:"订单不存在或不属于当前账号。",REQUEST_CONFLICT:"这次请求已用于其他订单。"} as Record<string,string>)[error.code] || "暂未核实订单，请稍后重试或联系反馈邮箱。"},error.code === "NOT_FOUND" ? 404 : 409);
  if (isLocalPaidError(error)) return json({ code: error.code, message: error.message }, error.status);
  console.error("Local paid operation failed", error);
  return json({ code: "LOCAL_ERROR", message: "本地操作失败，请刷新原记录后重试。" }, 500);
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    assertLocalRequest(request);
    const store = getPaidLocalStore();
    const segments = params.path ?? [];
    if (segments[0] === "admin") {
      store.payments.authenticateAdmin(request.cookies.get(adminCookie)?.value);
      if (segments.length===2 && segments[1]==="codes") return json(store.redemptions.adminOverview());
      return json({...store.payments.adminOverview(),xianyuOrders:store.xianyu.adminOrders()});
    }
    const userId = store.authenticate(request.cookies.get(cookieName)?.value);
    if (segments.length===1 && segments[0]==="card-catalog") return json(cardCatalog());
    if (segments.length===1 && segments[0]==="redemptions") return json(store.redemptions.history(userId));
    if (segments[0] === "xianyu") {
      const config=xianyuConfig(), sync=await reconcileXianyu(store.xianyu,userId);
      if (segments[1] === "orders" && segments[2]) return json(store.xianyu.order(userId,segments[2]));
      const catalog=store.payments.catalog(userId);
      return json({enabled:!!config?.allowRecharge,packages:catalog.packages.map(x=>({id:x.id,credits:x.credits,amountCents:x.amountCents,regularCents:x.regularCents,firstPurchase:x.firstPurchase,ready:!!config?.products.some(p=>p.packageId===x.id && p.firstPurchase===x.firstPurchase)})),orders:store.xianyu.orders(userId),syncOk:sync.ok});
    }
    if (segments[0] === "catalog") return json(store.payments.catalog(userId));
    if (segments[0] === "orders") {
      if (segments.length === 1) return json(store.payments.orders(userId));
      const order = store.payments.order(userId, segments[1]);
      if (segments[2] === "qr") {
        if (order.state !== "pending") throw new LocalPaidError("ORDER_CLOSED", "订单已结束或正在核实。", 409);
        const target = new URL(`/recharge/mock?order=${encodeURIComponent(order.id)}`, request.nextUrl.origin).href;
        return json({ dataUrl: await QRCode.toDataURL(target, { width: 240, margin: 2, color: { dark: "#6e2638", light: "#fffdf8" } }), mode: "simulation" });
      }
      return json(order);
    }
    if (segments.length === 1 && segments[0] === "daily") return json(store.dailyCalendar(userId, request.nextUrl.searchParams.get("month") || undefined));
    if (segments.length === 0) { const catalog = store.payments.catalog(userId); return json({ ...store.overview(userId), packages: catalog.packages, firstPurchaseEligible: catalog.firstPurchaseEligible }); }
    if (segments[0] === "projects") {
      if (segments.length === 1) return json(store.projects(userId));
      if (segments.length === 2) return json(store.project(userId, segments[1]));
      if (segments.length === 3 && segments[2] === "readings") return json(store.projectReadings(userId, segments[1]));
      if (segments.length === 3 && segments[2] === "draw-session") return json(store.pendingDrawSession(userId, segments[1]));
    }
    if (segments[0] === "readings" && segments.length === 2) return json(store.reading(userId, segments[1]));
    if (segments[0] === "draw-sessions" && segments.length === 2) return json(store.drawSession(userId, segments[1]));
    throw new LocalPaidError("NOT_FOUND", "接口不存在。", 404);
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    assertLocalRequest(request);
    if (Number(request.headers.get("content-length") || 0) > 8000) throw new LocalPaidError("TOO_LARGE", "请求过长。", 413);
    const raw = await request.text();
    if (raw.length > 8000) throw new LocalPaidError("TOO_LARGE", "请求过长。", 413);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw); } catch { throw new LocalPaidError("INVALID_JSON", "请求格式不正确。"); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new LocalPaidError("INVALID_JSON", "请求格式不正确。");
    const field = (key: string) => typeof input[key] === "string" ? input[key] as string : "";
    const store = getPaidLocalStore();
    const action = (params.path ?? []).join("/");
    const previousToken = request.cookies.get(cookieName)?.value;
    if (action === "admin/session") {
      const token = store.payments.adminLogin(field("key"));
      const response = json({ ok: true });
      response.cookies.set(adminCookie, token, { httpOnly: true, sameSite: "strict", path: "/api/local-paid/admin", maxAge: 7200 });
      return response;
    }
    if (action.startsWith("admin/")) {
      const token = request.cookies.get(adminCookie)?.value;
      const actor = store.payments.authenticateAdmin(token);
      if (action === "admin/codes/generate") return json(store.redemptions.createBatch(actor,field("packageId"),Number(input.quantity),field("requestKey"),field("reason")));
      if (action === "admin/codes/export") return json(store.redemptions.exportBatch(actor,field("batchId"),field("requestKey"),field("reason")));
      if (action === "admin/codes/disable") return json(store.redemptions.disable(actor,field("codeId"),field("requestKey"),field("reason")));
      if (action === "admin/codes/refund") return json(store.redemptions.recordRefund(actor,field("codeId"),field("requestKey"),field("reason")));
      if (action === "admin/xianyu-sync") { const result=await reconcileXianyu(store.xianyu);return json(result); }
      if (action === "admin/logout") {
        store.payments.adminLogout(token!); const response = json({ ok: true });
        response.cookies.set(adminCookie, "", { httpOnly: true, sameSite: "strict", path: "/api/local-paid/admin", maxAge: 0 }); return response;
      }
      if (action === "admin/reconcile") return json(store.payments.reconcile(actor, field("orderId"), field("requestKey"), field("reason")));
      if (action === "admin/compensate") { store.payments.compensate(actor, field("userId"), Number(input.count), field("requestKey"), field("reason")); return json({ ok: true }); }
      if (action === "admin/refund-request") return json(store.payments.requestRefund(field("userId"), field("orderId"), field("requestKey"), field("reason"), actor));
      if (action === "admin/refund-complete") {
        if (typeof input.success !== "boolean") throw new LocalPaidError("INVALID_REFUND", "请选择退款成功或失败。");
        return json(store.payments.completeRefund(actor, field("refundId"), input.success, field("requestKey"), field("reason")));
      }
      throw new LocalPaidError("NOT_FOUND", "接口不存在。", 404);
    }
    if (action === "session") {
      const session = store.login(field("account"), previousToken);
      const response = json(store.overview(session.userId));
      response.cookies.set(cookieName, session.token, { httpOnly: true, sameSite: "strict", path: "/api/local-paid", maxAge: 7 * 86400 });
      return response;
    }
    const userId = store.authenticate(previousToken);
    if (action === "redeem") {
      if (field("expectedUserId") && field("expectedUserId")!==userId) throw new LocalPaidError("ACCOUNT_CHANGED","登录账号已变更，请刷新并确认接收花瓣的账号。",409);
      return json(store.redemptions.redeem(userId,field("code"),field("readingId")||undefined));
    }
    if (action === "xianyu/checkout") {
      const config=xianyuConfig();
      if (!config?.allowRecharge) throw new LocalPaidError("XIANYU_DISABLED","闲鱼正在联调，尚未开放真实购买。",409);
      return json(store.xianyu.prepare(userId,field("packageId"),field("requestKey"),config.products,field("readingId")||undefined));
    }
    if (action === "xianyu/cancel") return json(store.xianyu.cancel(userId,field("orderId")));
    if (action === "orders") return json(store.payments.create(userId, { packageId: field("packageId"), channel: field("channel"), requestKey: field("requestKey"), readingId: field("readingId") || undefined }));
    if (action === "order-cancel") return json(store.payments.cancel(userId, field("orderId")));
    if (action === "order-query") return json(store.payments.order(userId, field("orderId")));
    if (action === "payment-simulate") return json(store.payments.simulate(userId, field("orderId"), field("mode") as SimulationMode));
    if (action === "refund-request") return json(store.payments.requestRefund(userId, field("orderId"), field("requestKey"), field("reason")));
    if (action === "daily-check-in") return json(store.checkIn(userId));
    if (action === "test-credits") return json(store.grantTestCredits(userId, field("requestKey")));
    if (action === "logout") {
      if (previousToken) store.logout(previousToken);
      const response = json({ ok: true });
      response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "strict", path: "/api/local-paid", maxAge: 0 });
      return response;
    }
    if (action === "projects") return json(store.saveProject(userId, { title: field("title"), background: field("background") }));
    if (action === "project-default") return json(store.ensureDefaultProject(userId));
    if (action === "project-update") return json(store.saveProject(userId, {
      ...(typeof input.title === "string" ? { title: input.title } : {}),
      ...(typeof input.background === "string" ? { background: input.background } : {}),
      ...(typeof input.memorySummary === "string" ? { memorySummary: input.memorySummary } : {})
    }, field("projectId")));
    if (action === "project-touch") { store.touchProject(userId, field("projectId")); return json({ ok: true }); }
    if (action === "project-remove") { store.archiveProject(userId, field("projectId")); return json({ ok: true }); }
    const choices = Array.isArray(input.choices) ? input.choices.filter((value): value is string => typeof value === "string") : undefined;
    if (action === "draw") return json(store.draw(userId, { question: field("question"), spread: field("spread") as PaidSpread, requestKey: field("requestKey"), projectId: field("projectId") || undefined, choices }));
    if (action === "draw-session") return json(store.startDrawSession(userId, { projectId: field("projectId"), question: field("question"), spread: field("spread") as PaidSpread, requestKey: field("requestKey"), choices }));
    if (action === "draw-pick") return json(store.pickDrawCard(userId, field("sessionId"), field("token"), Number(input.expectedCount)));
    if (action === "draw-abandon") { store.abandonDrawSession(userId, field("sessionId")); return json({ ok: true }); }
    if (action === "unlock") {
      const readingId = field("readingId");
      const reserved = store.reserveReading(userId, readingId);
      if (!reserved.runId) return json(reserved.reading, reserved.reading.state === "generating" ? 202 : 200);
      let completed;
      try {
        const project = reserved.reading.projectId ? store.project(userId, reserved.reading.projectId) : undefined;
        const result = await generatePaidMain(reserved.reading, input.simulateFailure === true, project);
        completed = store.completeReading(userId, readingId, reserved.runId, result);
      } catch (error) { store.releaseReading(userId, readingId, reserved.runId); throw error; }
      // Transport-failure simulation occurs after commit. Refresh finds the saved result;
      // it must never refund a successful generation merely because the browser saw 503.
      if (input.simulateLostResponse === true) throw new LocalPaidError("RESPONSE_LOST", "已模拟保存后断网。请刷新原记录：结果已保存，次数不会重复扣除。", 503);
      return json(completed);
    }
    if (action === "follow-up") {
      const readingId = field("readingId");
      const reserved = store.reserveFollowUp(userId, readingId, field("question"), field("requestKey"));
      if (!reserved.attempt) return json(reserved.reading);
      try {
        const project = reserved.reading.projectId ? store.project(userId, reserved.reading.projectId) : undefined;
        const answer = await generatePaidFollowUp(reserved.reading, field("question"), input.simulateFailure === true, project);
        return json(store.completeFollowUp(userId, readingId, reserved.id, reserved.attempt, answer));
      } catch (error) { store.releaseFollowUp(userId, readingId, reserved.id, reserved.attempt); throw error; }
    }
    throw new LocalPaidError("NOT_FOUND", "接口不存在。", 404);
  } catch (error) { return failure(error); }
}
