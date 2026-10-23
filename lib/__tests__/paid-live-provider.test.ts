import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/local-paid/[[...path]]/route";
import { getPaidLocalStore } from "../paid-local/store";
import { assertLocalEnvironment } from "../paid-local/guard";
import type { PaidReading } from "../paid-local/types";

test("opt-in local AI preserves real output, failures refund, and retries never call the provider twice", async (t) => {
  const before = { ...process.env }; const originalFetch = globalThis.fetch;
  Object.assign(process.env, { NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "deepseek", PAID_LOCAL_AI_KEY: "private-test-secret", PAID_LOCAL_AI_MODEL: "configured-model", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "", PAID_LOCAL_DB: path.join(process.cwd(), ".local-paid", `provider-${randomUUID()}.sqlite`) });
  let calls = 0; let reply = { conclusion: "项目有推进空间", interpretation: "原牌组合需要先把目标落到具体的小成果。", uncertainty: "实际反馈仍需观察", advice: "先完成一个可以展示的小版本。" } as Record<string, string>;
  let status = 200; let finish = "stop"; let lastBody: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer private-test-secret");
    lastBody = JSON.parse(String(init?.body)); calls++;
    return Response.json(status === 200 ? { model: "actual-returned-model", choices: [{ finish_reason: finish, message: { content: JSON.stringify(reply) } }] } : { secret: "private-test-secret" }, { status });
  };
  const store = getPaidLocalStore(); const session = store.login("new");
  const request = async (action: string, body: Record<string, unknown>) => POST(new NextRequest(`http://127.0.0.1:3100/api/local-paid/${action}`, { method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "x-local-paid": "1", cookie: `flora_paid_local_session=${session.token}` }, body: JSON.stringify(body) }), { params: { path: [action] } });
  try {
    await t.test("only explicit local AI with a dedicated key is accepted", () => {
      assert.ok(assertLocalEnvironment());
      assert.throws(() => assertLocalEnvironment({ ...process.env, NODE_ENV: "production" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, PAID_LOCAL_AI_KEY: "" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, SUPABASE_SERVICE_ROLE_KEY: "production-key" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, DEEPSEEK_API_KEY: "production-key" }));
    });
    const reading = store.draw(session.userId, { question: "如何推进创作项目？", spread: "three_card", requestKey: randomUUID() });
    await t.test("validated provider output is saved with its actual model and one debit", async () => {
      const response = await request("unlock", { readingId: reading.id }); assert.equal(response.status, 200);
      const output = await response.json() as PaidReading; assert.equal(output.result?.model, "actual-returned-model"); assert.equal(output.result?.interpretation, reply.interpretation);
      assert.equal(lastBody.model, "configured-model"); assert.equal(lastBody.max_tokens, 2800);
      assert.equal(store.overview(session.userId).balance.consumed, 1);
      assert.equal((await request("unlock", { readingId: reading.id })).status, 200); assert.equal(calls, 1);
    });
    await t.test("follow-ups receive the saved reading and conversation, preserving their own quota", async () => {
      reply = { answer: "先确认你能够在一周内完成的小成果。" };
      const key = randomUUID(); const body = { readingId: reading.id, question: "我可以先做什么？", requestKey: key };
      assert.equal((await request("follow-up", body)).status, 200);
      assert.equal((await request("follow-up", body)).status, 200); assert.equal(calls, 2);
      assert.match(JSON.stringify(lastBody), /原牌组合|我可以先做什么/);
      assert.equal(store.reading(session.userId, reading.id).followUpsRemaining, 1);
    });
    await t.test("provider errors, truncation and missing fields release reservations without fake fallback", async () => {
      store.grantTestCredits(session.userId, randomUUID());
      for (const failure of ["provider", "truncated", "missing"]) {
        const next = store.draw(session.userId, { question: `失败测试 ${failure}`, spread: "three_card", requestKey: randomUUID() });
        status = failure === "provider" ? 402 : 200; finish = failure === "truncated" ? "length" : "stop";
        reply = { conclusion: "缺少正文" };
        const response = await request("unlock", { readingId: next.id });
        assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /private-test-secret/);
        const saved = store.reading(session.userId, next.id); assert.equal(saved.state, "failed"); assert.equal(saved.result, null);
        assert.deepEqual(saved.cards, next.cards); assert.equal(store.overview(session.userId).balance.reserved, 0); assert.equal(store.overview(session.userId).balance.consumed, 1);
      }
    });
    await t.test("test credits cannot accumulate while credits remain and never replace welcome history", () => {
      store.grantTestCredits(session.userId, randomUUID()); assert.equal(store.overview(session.userId).balance.available, 5);
      const rows = store.overview(session.userId).ledger; assert.equal(rows.filter((row) => row.kind === "welcome").length, 1); assert.equal(rows.filter((row) => row.kind === "local_test").length, 1);
      for (let i = 0; i < 5; i++) {
        const fixtureDb = new (require("node:sqlite").DatabaseSync)(process.env.PAID_LOCAL_DB);
        fixtureDb.prepare("UPDATE paid_readings SET created_at=? WHERE user_id=?").run("2000-01-01T00:00:00Z",session.userId); fixtureDb.close();
        const next = store.draw(session.userId, { question: `消耗测试额度 ${i}`, spread: "three_card", requestKey: randomUUID() });
        const run = store.reserveReading(session.userId, next.id);
        store.completeReading(session.userId, next.id, run.runId!, store.reading(session.userId, reading.id).result!);
      }
      assert.equal(store.overview(session.userId).balance.available, 0);
      const key = randomUUID(); store.grantTestCredits(session.userId, key); store.grantTestCredits(session.userId, key);
      const overview = store.overview(session.userId); assert.equal(overview.balance.available, 5);
      assert.equal(overview.ledger.filter((row) => row.kind === "local_test").length, 2);
    });
  } finally {
    store.close(); globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
