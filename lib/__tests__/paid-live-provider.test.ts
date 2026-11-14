import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  let reviewCalls = 0; let reviewStatus = 200; let lastReview = "";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer private-test-secret");
    const body = JSON.parse(String(init?.body));
    if (body.max_tokens === 96) {
      reviewCalls++;
      lastReview = body.messages[1].content;
      const review = /解雇协议|自行减半/.test(lastReview) ? { decision: "block", category: "legal" } : { decision: "allow", category: "none" };
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(review) } }] }, { status: reviewStatus });
    }
    lastBody = body; calls++;
    return Response.json(status === 200 ? { model: "actual-returned-model", choices: [{ finish_reason: finish, message: { content: JSON.stringify(reply) } }] } : { secret: "private-test-secret" }, { status });
  };
  const store = getPaidLocalStore(); const session = store.login("new");
  const request = async (action: string, body: Record<string, unknown>) => POST(new NextRequest(`http://127.0.0.1:3100/api/local-paid/${action}`, { method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "x-local-paid": "1", cookie: `flora_paid_local_session=${session.token}` }, body: JSON.stringify(body) }), { params: Promise.resolve({ path: [action] }) });
  try {
    await t.test("only explicit local AI with a dedicated key is accepted", () => {
      assert.ok(assertLocalEnvironment());
      assert.throws(() => assertLocalEnvironment({ ...process.env, NODE_ENV: "production" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, PAID_LOCAL_AI_KEY: "" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, SUPABASE_SERVICE_ROLE_KEY: "production-key" }));
      assert.throws(() => assertLocalEnvironment({ ...process.env, DEEPSEEK_API_KEY: "production-key" }));
    });
    const reading = store.draw(session.userId, { question: "如何推进创作项目？", spread: "three_card", requestKey: randomUUID() });
    await t.test("blocked completed draw is erased without touching balance or generating", async () => {
      const project = store.ensureDefaultProject(session.userId);
      const draw = store.startDrawSession(session.userId, { projectId: project.id, question: "解雇协议影响什么权利？", spread: "three_card", requestKey: randomUUID() });
      const selected = store.pickDrawCards(session.userId, draw.id, draw.deck.slice(0, 3).map(card => card.token), 0);
      const before = store.overview(session.userId);
      const reply = await Promise.all([request("unlock", { readingId: selected.readingId }), request("unlock", { readingId: selected.readingId })]);
      assert.deepEqual(reply.map(item => item.status), [422, 422]);
      assert.equal(reviewCalls, 1); assert.equal(calls, 0);
      assert.match((await reply[0].json() as { message: string }).message, /社区规范.*未扣花瓣.*不会留下这条记录/);
      assert.deepEqual(store.overview(session.userId).balance, before.balance);
      assert.deepEqual(store.overview(session.userId).ledger, before.ledger);
      assert.throws(() => store.reading(session.userId, selected.readingId!), { code: "NOT_FOUND" });
      assert.throws(() => store.drawSession(session.userId, draw.id), { code: "NOT_FOUND" });
    });
    await t.test("immediate danger shows the emergency category before calling AI", async () => {
      const draw = store.draw(session.userId, { question: "前伴侣正在门外砸门，我开门安全吗？", spread: "three_card", requestKey: randomUUID() });
      const response = await request("unlock", { readingId: draw.id });
      assert.equal(response.status, 422);
      assert.equal((await response.json() as { code: string }).code, "READING_IMMEDIATE_DANGER");
      assert.equal(reviewCalls, 1); assert.equal(calls, 0);
    });
    await t.test("an unavailable review preserves the cards and never reserves a petal", async () => {
      const before = store.overview(session.userId);
      reviewStatus = 503;
      const response = await request("unlock", { readingId: reading.id });
      reviewStatus = 200;
      assert.equal(response.status, 503);
      assert.equal((await response.json() as { code: string }).code, "READING_REVIEW_UNAVAILABLE");
      assert.equal(store.reading(session.userId, reading.id).state, "locked");
      assert.deepEqual(store.overview(session.userId).ledger, before.ledger);
      assert.equal(calls, 0);
    });
    await t.test("validated provider output is saved with its actual model and one debit", async () => {
      const response = await request("unlock", { readingId: reading.id }); assert.equal(response.status, 200);
      const output = await response.json() as PaidReading; assert.equal(output.result?.model, "actual-returned-model"); assert.equal(output.result?.interpretation, reply.interpretation);
      assert.equal(lastBody.model, "configured-model"); assert.equal(lastBody.max_tokens, 2800);
      assert.equal(store.overview(session.userId).balance.consumed, 1);
      assert.equal((await request("unlock", { readingId: reading.id })).status, 200); assert.equal(calls, 1);
      assert.equal(reviewCalls, 3);
    });
    await t.test("follow-ups receive the saved reading and conversation, preserving their own quota", async () => {
      reply = { answer: "先确认你能够在一周内完成的小成果。" };
      const key = randomUUID(); const body = { readingId: reading.id, question: "我可以先做什么？", requestKey: key };
      assert.equal((await request("follow-up", body)).status, 200);
      assert.equal((await request("follow-up", body)).status, 200); assert.equal(calls, 2);
      assert.match(JSON.stringify(lastBody), /原牌组合|我可以先做什么/);
      assert.equal(store.reading(session.userId, reading.id).followUpsRemaining, 1);
    });
    await t.test("blocked follow-up is never stored or counted against its allowance", async () => {
      const previous = store.reading(session.userId, reading.id);
      const key = randomUUID();
      const response = await request("follow-up", { readingId: reading.id, question: "今晚我可以把药自行减半吗？", requestKey: key });
      assert.equal(response.status, 422);
      assert.match((await response.json() as { message: string }).message, /未消耗追问次数.*不会留下这条追问/);
      assert.match(lastReview, /自行减半/);
      assert.equal(calls, 2);
      assert.deepEqual(store.reading(session.userId, reading.id), previous);
      const db = new DatabaseSync(process.env.PAID_LOCAL_DB!, { readOnly: true });
      try { assert.equal(db.prepare("SELECT id FROM paid_follow_ups WHERE request_key=?").get(key), undefined); }
      finally { db.close(); }
    });
    await t.test("new draws are reviewed before shuffle and confirmation reuses the result", async () => {
      store.grantTestCredits(session.userId, randomUUID());
      const project = store.ensureDefaultProject(session.userId);
      const base = { projectId: project.id, spread: "three_card", requestKey: randomUUID() };
      const before = store.overview(session.userId);
      const start = reviewCalls;
      const generationStart = calls;
      const blocked = await request("draw-session", { ...base, question: "解雇协议影响什么权利？" });
      assert.equal(blocked.status, 422);
      assert.equal(store.pendingDrawSession(session.userId, project.id), null);
      assert.deepEqual(store.overview(session.userId), before);
      assert.equal(reviewCalls, start + 1);
      const allowed = { ...base, requestKey: randomUUID(), question: "我想和朋友谈清楚什么？" };
      const draws = await Promise.all([request("draw-session", allowed), request("draw-session", allowed)]);
      assert.deepEqual(draws.map(draw => draw.status), [200, 200]);
      const [first, retry] = await Promise.all(draws.map(draw => draw.json())) as import("../paid-local/types").PaidDrawSession[];
      assert.equal(first.id, retry.id);
      const picked = store.pickDrawCards(session.userId, first.id, first.deck.slice(0, 3).map(card => card.token), 0);
      assert.equal(reviewCalls, start + 2);
      assert.deepEqual(store.overview(session.userId).balance, before.balance);
      reply = { conclusion: "结论", interpretation: "完整解读", uncertainty: "仅供参考", advice: "可以慢慢聊。" };
      assert.equal((await request("unlock", { readingId: picked.readingId })).status, 200);
      assert.equal(reviewCalls, start + 2);
      assert.equal(calls, generationStart + 1);
      assert.equal(store.overview(session.userId).balance.consumed, before.balance.consumed + 1);
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
        assert.deepEqual(saved.cards, next.cards); assert.equal(store.overview(session.userId).balance.reserved, 0); assert.equal(store.overview(session.userId).balance.consumed, 2);
      }
    });
    await t.test("test credits cannot accumulate while credits remain and never replace welcome history", () => {
      store.grantTestCredits(session.userId, randomUUID()); assert.equal(store.overview(session.userId).balance.available, 4);
      const rows = store.overview(session.userId).ledger; assert.equal(rows.filter((row) => row.kind === "welcome").length, 1); assert.equal(rows.filter((row) => row.kind === "local_test").length, 1);
      for (let i = 0; i < 4; i++) {
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
