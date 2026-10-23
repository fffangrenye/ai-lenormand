import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../app/api/deep-reading/route";
import { GET } from "../../app/api/deep-reading/quota/route";
import { FREE_DEEP_READING_LIMIT } from "../reading-quota";

test("server enforces daily quota and reports authoritative usage", async (t) => {
  const originalFetch = globalThis.fetch;
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DEEPSEEK_API_KEY", "ADMIN_EMAILS"];
  const saved = keys.map((key) => process.env[key]);
  keys.forEach((key) => { process.env[key] = key === "NEXT_PUBLIC_SUPABASE_URL" ? "https://quota.test" : "test"; });
  process.env.ADMIN_EMAILS = "admin@example.com";
  let used = 0;
  let aiCalls = 0;
  let failAi = false;
  let invalidAi = false;
  let failQuota = false;
  let crossMidnight = false;
  const OriginalDate = globalThis.Date;
  let admin = false;
  let reservationDate = "";
  let refundDate = "";
  const result = { core_conclusion: "测试结论", interpretation: "测试解读", time_window: null, uncertainty: "测试不确定性" };
  const request = () => new Request("https://app.test/api/deep-reading", {
    method: "POST", headers: { authorization: "Bearer token", "Content-Type": "application/json" },
    body: JSON.stringify({ reading: { id: "reading", question: "测试问题", spreadType: "three_card" }, project: { title: "测试" }, cards: [], recentReadings: [] })
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user", email: admin ? "admin@example.com" : "user@example.com" });
    if (url.includes("/rpc/")) {
      const body = JSON.parse(String(init?.body));
      if (url.endsWith("reserve_daily_ai_quota")) {
        if (failQuota) return new Response("quota unavailable", { status: 503 });
        reservationDate = body.p_date_key;
        const allowed = used < body.p_limit;
        if (allowed) used++;
        return Response.json([{ allowed, used, remaining: Math.max(body.p_limit - used, 0) }]);
      }
      if (url.endsWith("refund_daily_ai_quota")) {
        refundDate = body.p_date_key;
        used--;
        return Response.json([{ allowed: true, used, remaining: 0 }]);
      }
      if (url.endsWith("check_daily_ai_quota")) return Response.json([{ allowed: used < body.p_limit, used, remaining: Math.max(body.p_limit - used, 0) }]);
      throw new Error(`Unexpected quota RPC: ${url}`);
    }
    if (url.includes("/analytics_events")) return new Response(null, { status: 201 });
    if (url.includes("api.deepseek.com")) {
      aiCalls++;
      if (crossMidnight) {
        globalThis.Date = class extends OriginalDate {
          constructor(value?: string | number | Date) { super(value === undefined ? "2026-10-21T00:00:01+08:00" : value); }
        } as DateConstructor;
      }
      if (failAi) return new Response("provider unavailable", { status: 502 });
      if (invalidAi) return Response.json({ choices: [{ message: { content: "invalid json" } }] });
      return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    await t.test("first three succeed, fourth is blocked before AI", async () => {
      assert.equal(FREE_DEEP_READING_LIMIT, 3);
      for (let i = 0; i < 3; i++) assert.equal((await POST(request())).status, 200);
      const denied = await POST(request());
      assert.equal(denied.status, 429);
      assert.equal(((await denied.json()) as { code: string }).code, "QUOTA_EXCEEDED");
      assert.equal(aiCalls, 3);
      assert.equal(used, 3);
    });
    await t.test("concurrent requests cannot exceed three reservations", async () => {
      used = aiCalls = 0;
      const responses = await Promise.all(Array.from({ length: 8 }, () => POST(request())));
      assert.equal(responses.filter((response) => response.status === 200).length, 3);
      assert.equal(responses.filter((response) => response.status === 429).length, 5);
      assert.equal(aiCalls, 3);
      assert.equal(used, 3);
    });
    await t.test("provider failure refunds the reserved date", async () => {
      used = aiCalls = 0;
      globalThis.Date = class extends OriginalDate {
        constructor(value?: string | number | Date) { super(value === undefined ? "2026-10-20T23:59:59+08:00" : value); }
      } as DateConstructor;
      crossMidnight = true;
      failAi = true;
      assert.equal((await POST(request())).status, 503);
      assert.equal(used, 0);
      assert.equal(refundDate, reservationDate);
      assert.equal(refundDate, "2026-10-20");
      crossMidnight = false;
      globalThis.Date = OriginalDate;
      failAi = false;
    });
    await t.test("invalid AI output also refunds the reservation", async () => {
      used = 0;
      invalidAi = true;
      assert.equal((await POST(request())).status, 503);
      assert.equal(used, 0);
      invalidAi = false;
    });
    await t.test("quota service failure blocks AI instead of granting free access", async () => {
      const before = aiCalls;
      failQuota = true;
      assert.equal((await POST(request())).status, 500);
      assert.equal(aiCalls, before);
      failQuota = false;
    });
    await t.test("quota endpoint reads server usage with private uncached response", async () => {
      used = 2;
      const response = await GET(new Request("https://app.test/api/deep-reading/quota", { headers: { authorization: "Bearer token" } }));
      const quota = (await response.json()) as { used: number; limit: number; remaining: number };
      assert.equal(quota.used, 2);
      assert.equal(quota.limit, 3);
      assert.equal(quota.remaining, 1);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    });
    await t.test("admin exemption is displayed and enforced consistently", async () => {
      admin = true;
      used = 3;
      assert.equal((await POST(request())).status, 200);
      assert.equal(used, 3);
      const response = await GET(new Request("https://app.test/api/deep-reading/quota", { headers: { authorization: "Bearer token" } }));
      assert.equal(((await response.json()) as { resetLabel: string }).resetLabel, "管理员无限额度");
      admin = false;
    });
    await t.test("unauthenticated requests cannot generate or read quota", async () => {
      assert.equal((await POST(new Request("https://app.test", { method: "POST" }))).status, 401);
      assert.equal((await GET(new Request("https://app.test"))).status, 401);
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.Date = OriginalDate;
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  }
});
