import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { PaidLocalStore } from "../paid-local/store";
import { assertLocalEnvironment, assertLocalRequest, isLocalPaidError, LocalPaidError } from "../paid-local/guard";
import { paidConfig, packagePrice } from "../paid-local/config";
import { generateLocalMain, generateLocalFollowUp, paidMainSystemPrompt, paidModelSettings } from "../paid-local/model";
import type { PaidResult } from "../paid-local/types";
import { generateRuleEngineReading } from "../rule-engine-production";
import { GET, POST } from "../../app/api/local-paid/[[...path]]/route";
import { NextRequest } from "next/server";
import { getPaidLocalStore } from "../paid-local/store";

const mockResult: PaidResult = { conclusion: "总体判断", interpretation: "测试解读已保存", uncertainty: "仍有条件", advice: "核实下一步", model: "local_mock", promptVersion: "test" };
const errorCode = (code: string) => (error: unknown) => error instanceof LocalPaidError && error.code === code;

test("isolated paid V1 persistence, entitlement and generation invariants", async (t) => {
  const saved = { ...process.env };
  const filename = path.join(process.cwd(), ".local-paid", `test-${randomUUID()}.sqlite`);
  Object.assign(process.env, { NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "mock", PAID_LOCAL_DB: filename, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "" });
  let now = Date.now();
  const store = new PaidLocalStore(filename, () => now);
  const user = store.login("new").userId;
  const draw = (question = "我和对方的关系会如何发展？", account = user) => {
    now += 61000; // deterministic clock, no need to wait for draw rate limits
    return store.draw(account, { question, spread: "three_card", requestKey: randomUUID() });
  };
  const unlock = (id: string, account = user) => {
    const run = store.reserveReading(account, id);
    assert.ok(run.runId);
    return store.completeReading(account, id, run.runId, mockResult);
  };
  try {
    await t.test("disabled, production and unsafe environments are rejected", () => {
      assert.throws(() => assertLocalEnvironment({ ...process.env, NODE_ENV: "production" }), errorCode("LOCAL_ONLY"));
      assert.throws(() => assertLocalEnvironment({ ...process.env, PAID_LOCAL_MODE: "0" }), errorCode("LOCAL_ONLY"));
      assert.throws(() => assertLocalEnvironment({ ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co" }), errorCode("UNSAFE_ENVIRONMENT"));
      assert.throws(() => assertLocalEnvironment({ ...process.env, SUPABASE_SERVICE_ROLE_KEY: "real-secret" }), errorCode("UNSAFE_ENVIRONMENT"));
      assert.throws(() => assertLocalEnvironment({ ...process.env, PAID_LOCAL_DB: path.join(process.cwd(), "wrong.sqlite") }), errorCode("UNSAFE_DATABASE"));
      assert.throws(() => assertLocalRequest(new Request("https://public.example/api/local-paid")), errorCode("LOCAL_ONLY"));
      assert.throws(() => assertLocalRequest(new Request("http://localhost:3100/api/local-paid/session", { method: "POST", headers: { origin: "https://foreign.example", "x-local-paid": "1" } })), errorCode("INVALID_ORIGIN"));
      assert.equal(isLocalPaidError(Object.assign(new Error("旧模块登录错误"), { code: "UNAUTHORIZED", status: 401 })), true);
      assert.equal(isLocalPaidError(Object.assign(new Error("数据库错误"), { code: "ERR_SQLITE_ERROR" })), false);
    });
    await t.test("new and legacy accounts receive exactly one once across logins", () => {
      store.login("new"); store.login("new");
      assert.equal(store.overview(user).balance.available, 1);
      assert.equal(store.overview(user).ledger.length, 1);
      const legacy = store.login("legacy").userId;
      store.login("legacy");
      assert.equal(store.overview(legacy).balance.available, 1);
      assert.equal(store.overview(legacy).ledger[0].kind, "legacy_launch");
      const second = new PaidLocalStore(filename, () => now);
      second.login("new"); assert.equal(second.overview(user).balance.available, 1); second.close();
    });
    await t.test("V3 trims only unused onboarding gifts, preserving purchases, rewards and in-flight or completed readings", () => {
      const fixture = path.join(process.cwd(), ".local-paid", `trial-upgrade-${randomUUID()}.sqlite`);
      const allowance = paidConfig.welcomeCredits; let old: PaidLocalStore | undefined;
      let raw: DatabaseSync | undefined;
      try {
        paidConfig.welcomeCredits = 5;
        old = new PaidLocalStore(fixture, () => now);
        const id = old.login("new").userId; const exhausted = old.login("other").userId; const unused = old.login("legacy").userId;
        const pending: {id:string; run:string}[] = [];
        for (let i=0; i<4; i++) { const reading = old.draw(id, {question:`历史试用 ${i}`, spread:"three_card", requestKey:randomUUID()}); const run=old.reserveReading(id,reading.id).runId!; if(i<2) old.completeReading(id,reading.id,run,mockResult); else pending.push({id:reading.id,run}); }
        for (let i=0; i<5; i++) { const reading=old.draw(exhausted,{question:`已使用试用 ${i}`,spread:"three_card",requestKey:randomUUID()}); const run=old.reserveReading(exhausted,reading.id).runId!; old.completeReading(exhausted,reading.id,run,mockResult); }
        raw = new DatabaseSync(fixture);
        for (const [source,count] of [["purchase",7],["checkin_reward",1]] as const) {
          const batch=randomUUID(); raw.prepare("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,created_at) VALUES(?,?,?,?,?,?)").run(batch,id,source,randomUUID(),count,new Date(now).toISOString());
          raw.prepare("INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),id,batch,randomUUID(),source,count,0,0,"历史已到账花瓣",new Date(now).toISOString());
        }
        paidConfig.welcomeCredits = allowance; old.close(); old = new PaidLocalStore(fixture, () => now);
        assert.deepEqual(old.overview(id).balance,{available:8,reserved:2,consumed:2});
        assert.equal(old.overview(unused).balance.available,1);
        assert.deepEqual(old.overview(exhausted).balance,{available:0,reserved:0,consumed:5});
        for (const item of pending) old.releaseReading(id,item.id,item.run);
        assert.deepEqual(old.overview(id).balance,{available:8,reserved:0,consumed:2});
        old.login("new"); old.close(); old = new PaidLocalStore(fixture, () => now);
        assert.equal(old.overview(id).balance.available,8);
        assert.equal(raw.prepare("SELECT sum(available_delta) n FROM credit_ledger WHERE user_id=? AND kind='trial_adjustment'").get(id)?.n,-3);
        assert.equal(raw.prepare("SELECT sum(available_delta) n FROM credit_ledger WHERE user_id=?").get(id)?.n,8);
        assert.equal(raw.prepare("SELECT quantity FROM credit_batches WHERE user_id=? AND source='purchase'").get(id)?.quantity,7);
        assert.equal(raw.prepare("SELECT quantity FROM credit_batches WHERE user_id=? AND source='checkin_reward'").get(id)?.quantity,1);
        assert.deepEqual(raw.prepare("PRAGMA foreign_key_check").all(),[]);
      } finally { paidConfig.welcomeCredits = allowance; raw?.close(); old?.close(); }
    });
    await t.test("session tokens are server validated, revoked and expire", () => {
      const first = store.login("other");
      assert.equal(store.authenticate(first.token), first.userId);
      const second = store.login("other", first.token);
      assert.throws(() => store.authenticate(first.token), errorCode("UNAUTHORIZED"));
      store.logout(second.token);
      assert.throws(() => store.authenticate(second.token), errorCode("UNAUTHORIZED"));
      assert.throws(() => store.authenticate("forged"), errorCode("UNAUTHORIZED"));
      const expiring = store.login("other");
      now += 7 * 86400000 + 1;
      assert.throws(() => store.authenticate(expiring.token), errorCode("UNAUTHORIZED"));
    });
    await t.test("draw is persisted, idempotent, limited and never leaks hidden content", () => {
      const key = randomUUID();
      const first = store.draw(user, { question: "关系发展如何？", spread: "five_card_linear", requestKey: key });
      const second = store.draw(user, { question: "关系发展如何？", spread: "five_card_linear", requestKey: key });
      assert.equal(first.id, second.id); assert.deepEqual(first.cards, second.cards);
      assert.equal(new Set(first.cards.map((card) => card.number)).size, 5);
      assert.equal(first.result, null); assert.doesNotMatch(JSON.stringify(first), /systemPrompt|promptVersion|interpretation|copy_prompt/);
      assert.throws(() => store.draw(user, { question: "篡改问题", spread: "five_card_linear", requestKey: key }), errorCode("REQUEST_CONFLICT"));
      for (let i = 0; i < 7; i++) store.draw(user, { question: `问题 ${i}`, spread: "three_card", requestKey: randomUUID() });
      assert.throws(() => store.draw(user, { question: "过量抽牌", spread: "three_card", requestKey: randomUUID() }), errorCode("DRAW_RATE_LIMIT"));
      assert.equal(store.overview(user).balance.available, 1);
    });
    await t.test("reading result and debit commit together; duplicate calls do not consume", () => {
      const reading = draw();
      const run = store.reserveReading(user, reading.id);
      assert.ok(run.runId);
      assert.equal(store.overview(user).balance.reserved, 1);
      assert.equal(store.reserveReading(user, reading.id).runId, null);
      assert.equal(reading.completedAt, null);
      now += 5000;
      store.completeReading(user, reading.id, run.runId, mockResult);
      const completedAt = new Date(now).toISOString();
      now += 5000;
      store.completeReading(user, reading.id, run.runId, mockResult);
      store.releaseReading(user, reading.id, run.runId); // a lost response must not refund completed output
      assert.equal(store.reserveReading(user, reading.id).runId, null);
      assert.equal(store.overview(user).balance.consumed, 1);
      assert.deepEqual(store.reading(user, reading.id).result, mockResult);
      assert.equal(store.reading(user, reading.id).completedAt, completedAt);
      assert.notEqual(completedAt, reading.createdAt);
    });
    await t.test("failed and expired runs release once, and late workers cannot commit", () => {
      // This scenario needs two additional credits after consuming the welcome
      // gift. Use an explicit purchase fixture rather than a larger free gift.
      const fixtureDb = new DatabaseSync(filename), fixtureBatch = randomUUID();
      fixtureDb.prepare("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,created_at) VALUES(?,?,?,?,?,?)").run(fixtureBatch,user,"purchase",randomUUID(),2,new Date(now).toISOString());
      fixtureDb.prepare("INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),user,fixtureBatch,randomUUID(),"purchase",2,0,0,"测试购买",new Date(now).toISOString());
      fixtureDb.close();
      const reading = draw();
      const failed = store.reserveReading(user, reading.id);
      assert.ok(failed.runId);
      store.releaseReading(user, reading.id, failed.runId); store.releaseReading(user, reading.id, failed.runId);
      assert.equal(store.overview(user).balance.available, 2);
      const expired = store.reserveReading(user, reading.id); assert.ok(expired.runId);
      now += paidConfig.reservationLeaseMs + 1;
      store.recoverExpired(user); store.recoverExpired(user);
      assert.equal(store.overview(user).balance.reserved, 0);
      const current = store.reserveReading(user, reading.id); assert.ok(current.runId);
      assert.throws(() => store.completeReading(user, reading.id, expired.runId!, mockResult), errorCode("STALE_RUN"));
      store.completeReading(user, reading.id, current.runId, mockResult);
      assert.equal(store.overview(user).balance.consumed, 2);
    });
    await t.test("zero balance keeps original cards and unlocked historical follow ups", () => {
      const original = store.overview(user).readings.find((reading) => reading.state === "completed")!;
      for (let i = 0; i < 1; i++) unlock(draw(`问题 ${i}`).id);
      assert.equal(store.overview(user).balance.available, 0);
      const locked = draw("充值后解锁原牌？");
      assert.throws(() => store.reserveReading(user, locked.id), errorCode("NO_CREDITS"));
      assert.deepEqual(store.reading(user, locked.id).cards, locked.cards);
      const one = store.reserveFollowUp(user, original.id, "需要注意什么？", randomUUID()); assert.ok(one.attempt);
      store.completeFollowUp(user, original.id, one.id, one.attempt, "继续沿用原牌的回答");
      assert.equal(store.reading(user, original.id).followUpsRemaining, 1);
      assert.equal(store.overview(user).balance.available, 0);
      const raw = new DatabaseSync(filename);
      const batchId = randomUUID();
      raw.prepare("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,created_at) VALUES (?,?,?,?,?,?)").run(batchId, user, "check_in", randomUUID(), 1, new Date(now).toISOString());
      raw.prepare("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?,?)").run(randomUUID(), user, batchId, randomUUID(), "check_in", 1, 0, 0, "隔离测试赠送", new Date(now).toISOString());
      const unlocked = unlock(locked.id);
      assert.deepEqual(unlocked.cards, locked.cards);
      assert.equal(unlocked.followUpsRemaining, 2);
      raw.close();
    });
    await t.test("follow up failure, duplicate retry and concurrent slots stay within two", () => {
      const reading = store.overview(user).readings.find((item) => item.followUps.length === 1)!;
      const key = randomUUID();
      const first = store.reserveFollowUp(user, reading.id, "还可以怎么做？", key); assert.ok(first.attempt);
      store.releaseFollowUp(user, reading.id, first.id, first.attempt);
      assert.equal(store.reading(user, reading.id).followUpsRemaining, 1);
      const retry = store.reserveFollowUp(user, reading.id, "还可以怎么做？", key); assert.ok(retry.attempt);
      assert.throws(() => store.completeFollowUp(user, reading.id, first.id, first.attempt!, "旧回答"), errorCode("STALE_RUN"));
      assert.equal(store.reserveFollowUp(user, reading.id, "还可以怎么做？", key).attempt, null);
      assert.throws(() => store.reserveFollowUp(user, reading.id, "第三次？", randomUUID()), errorCode("FOLLOW_UP_LIMIT"));
      store.completeFollowUp(user, reading.id, retry.id, retry.attempt, "成功回答");
      assert.equal(store.reserveFollowUp(user, reading.id, "还可以怎么做？", key).attempt, null);
      assert.equal(store.reading(user, reading.id).followUpsRemaining, 0);
    });
    await t.test("other accounts cannot view, unlock or follow up another user's record", () => {
      const reading = store.overview(user).readings[0];
      const other = store.login("other").userId;
      assert.throws(() => store.reading(other, reading.id), errorCode("NOT_FOUND"));
      assert.throws(() => store.reserveReading(other, reading.id), errorCode("NOT_FOUND"));
      assert.throws(() => store.reserveFollowUp(other, reading.id, "越权", randomUUID()), errorCode("NOT_FOUND"));
      assert.equal(store.overview(other).balance.available, 1);
    });
    await t.test("stored entitlements and card history survive reopening the database", () => {
      const snapshot = store.overview(user);
      const reopened = new PaidLocalStore(filename, () => now);
      assert.deepEqual(reopened.overview(user), snapshot); reopened.close();
      const raw = new DatabaseSync(filename);
      const totals = raw.prepare("SELECT sum(available_delta) as available,sum(reserved_delta) as reserved,sum(consumed_delta) as consumed FROM credit_ledger WHERE user_id=?").get(user)!;
      assert.equal(totals.available, snapshot.balance.available);
      assert.equal(totals.reserved, snapshot.balance.reserved);
      assert.equal(totals.consumed, snapshot.balance.consumed);
      raw.close();
    });
    await t.test("package prices and activity changes use integer cents", () => {
      assert.deepEqual(paidConfig.packages.map((item) => packagePrice(item.id).amountCents), [499, 1499, 2499]);
      assert.deepEqual(paidConfig.packages.map((item) => packagePrice(item.id, new Date(), paidConfig, true).amountCents), [499, 1499, 2499]);
      const regular = { ...paidConfig, promotion: { ...paidConfig.promotion, enabled: false } };
      const lockedOrder = packagePrice("five");
      assert.deepEqual(regular.packages.map((item) => packagePrice(item.id, new Date(), regular).amountCents), [499, 1499, 2499]);
      assert.equal(lockedOrder.amountCents, 1499);
    });
    await t.test("existing purchases survive onboarding; gifts are consumed before older purchases", () => {
      const other = store.login("other").userId;
      const raw = new DatabaseSync(filename);
      const batchId = randomUUID();
      raw.prepare("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,created_at) VALUES (?,?,?,?,?,?)").run(batchId, other, "purchase", randomUUID(), 2, "2000-01-01T00:00:00Z");
      store.login("other");
      assert.equal(store.overview(other).balance.available, 3);
      const reading = draw("测试优先使用赠送", other);
      const run = store.reserveReading(other, reading.id); assert.ok(run.runId);
      const source = raw.prepare("SELECT b.source FROM credit_batches b JOIN reading_runs r ON r.batch_id=b.id WHERE r.id=?").get(run.runId);
      assert.equal(source?.source, "welcome");
      store.releaseReading(other, reading.id, run.runId); raw.close();
    });
    await t.test("existing unlocked results and successful follow-up usage remain accessible", () => {
      const legacy = store.login("legacy").userId;
      const raw = new DatabaseSync(filename);
      const id = randomUUID();
      const cards = store.overview(user).readings[0].cards;
      raw.prepare("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,state,result_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, legacy, randomUUID(), "历史已解锁测试记录", "three_card", JSON.stringify(cards), "completed", JSON.stringify(mockResult), "2026-01-01T00:00:00Z");
      raw.prepare("INSERT INTO paid_follow_ups(id,reading_id,request_key,question,state,answer,lease_until,created_at,attempt) VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(), id, randomUUID(), "已有追问", "completed", "旧回答", 0, "2026-01-01T00:00:00Z", randomUUID());
      store.login("legacy");
      assert.equal(store.reading(legacy, id).state, "completed");
      assert.equal(store.reading(legacy, id).followUpsRemaining, 1);
      assert.equal(store.overview(legacy).balance.available, 1); raw.close();
    });
    await t.test("expanded mock preserves rule evidence and provider settings without leaking prompt", async () => {
      const reading = store.overview(user).readings.find((item) => item.state === "completed")!;
      const result = await generateLocalMain(reading);
      assert.match(result.interpretation, /牌位与问题|相邻组合/);
      assert.ok(reading.spread === "three_card" || reading.spread === "five_card_linear");
      const baseline = generateRuleEngineReading({ question: reading.question, spreadType: reading.spread, cards: reading.cards.map((card, index) => ({ cardNumber: index + 1, cardSlug: card.slug, nameEn: card.nameEn, nameZh: card.nameZh })) });
      assert.ok(result.interpretation.length > baseline.deepReadingResult.interpretation.length);
      for (const card of reading.cards) assert.ok(result.interpretation.includes(card.nameZh));
      assert.ok(result.advice.length > 40);
      assert.match(paidMainSystemPrompt, /600–800|800–1000/);
      assert.equal(paidModelSettings.mainMaxTokens, 2800);
      assert.equal(paidModelSettings.followUpMaxTokens, 420);
      assert.doesNotMatch(JSON.stringify(result), /你是花语雷诺曼的专业解读者/);
      assert.ok((await generateLocalFollowUp({ ...reading, result }, "有什么建议？")).includes(reading.cards[0].nameZh));
    });
    await t.test("separate Node processes cannot reserve more than the available balance", async () => {
      const concurrencyFile = path.join(process.cwd(), ".local-paid", `concurrency-${randomUUID()}.sqlite`);
      const shared = new PaidLocalStore(concurrencyFile);
      const sharedUser = shared.login("new").userId;
      const readings = Array.from({ length: 8 }, (_, i) => shared.draw(sharedUser, { question: `并发问题 ${i}`, spread: "three_card", requestKey: randomUUID() }));
      const outputs = await Promise.all(readings.map((reading) => new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/paid-local-worker.cjs", reading.id], { cwd: process.cwd(), env: { ...process.env, PAID_LOCAL_DB: concurrencyFile }, windowsHide: true });
        let stdout = ""; let stderr = "";
        child.stdout.on("data", (data) => stdout += data); child.stderr.on("data", (data) => stderr += data);
        child.on("error", reject); child.on("exit", (code) => code ? reject(new Error(stderr)) : resolve(stdout));
      })));
      assert.equal(outputs.filter((item) => item === "reserved").length, 1);
      assert.equal(outputs.filter((item) => item === "denied").length, 7);
      assert.equal(shared.overview(sharedUser).balance.reserved, 1);
      assert.equal(shared.overview(sharedUser).balance.available, 0); shared.close();
    });
    await t.test("API boundaries: onboarding, retries, lost response, forged history and isolation", async () => {
      const apiFile = path.join(process.cwd(), ".local-paid", `api-${randomUUID()}.sqlite`);
      process.env.PAID_LOCAL_DB = apiFile;
      let cookie = "";
      const post = async (action: string, body: Record<string, unknown>, origin = "http://127.0.0.1:3100") => {
        const response = await POST(new NextRequest(`http://localhost:3100/api/local-paid/${action}`, {
          method: "POST", headers: { host: "127.0.0.1:3100", origin, "x-local-paid": "1", "Content-Type": "application/json", cookie }, body: JSON.stringify(body)
        }), { params: { path: [action] } });
        const nextCookie = response.headers.get("set-cookie");
        if (nextCookie) cookie = nextCookie.split(";")[0];
        return response;
      };
      const overview = async () => {
        const response = await GET(new NextRequest("http://localhost:3100/api/local-paid", { headers: { host: "127.0.0.1:3100", cookie } }), { params: {} });
        return await response.json() as { balance: { available: number }; readings: { id: string; state: string; result: unknown; cards: unknown[]; followUpsRemaining: number }[] };
      };
      assert.equal((await post("draw", { question: "未登录", spread: "three_card", requestKey: randomUUID() })).status, 401);
      assert.equal((await post("session", { account: "new" }, "https://foreign.example")).status, 403);
      assert.equal((await post("session", { account: "new" })).status, 200);
      assert.equal((await overview()).balance.available, 1);
      const drawn = await (await post("draw", { question: "这次关系如何发展？", spread: "three_card", requestKey: randomUUID() })).json() as { id: string; cards: unknown[] };
      assert.equal((await post("unlock", { readingId: drawn.id, simulateFailure: true })).status, 503);
      assert.equal((await overview()).balance.available, 1);
      assert.equal((await post("unlock", { readingId: drawn.id, simulateLostResponse: true })).status, 503);
      const saved = await overview();
      assert.equal(saved.balance.available, 0);
      assert.equal(saved.readings[0].state, "completed");
      assert.ok(saved.readings[0].result);
      assert.deepEqual(saved.readings[0].cards, drawn.cards);
      assert.equal((await post("unlock", { readingId: drawn.id })).status, 200);
      assert.equal((await overview()).balance.available, 0);
      const followKey = randomUUID();
      assert.equal((await post("follow-up", { readingId: drawn.id, question: "需要注意什么？", requestKey: followKey, simulateFailure: true })).status, 503);
      assert.equal((await overview()).readings[0].followUpsRemaining, 2);
      assert.equal((await post("follow-up", { readingId: drawn.id, question: "需要注意什么？", requestKey: followKey })).status, 200);
      assert.equal((await post("follow-up", { readingId: drawn.id, question: "需要注意什么？", requestKey: followKey })).status, 200);
      assert.equal((await overview()).readings[0].followUpsRemaining, 1);
      assert.equal((await post("follow-up", { readingId: drawn.id, question: "下一步呢？", requestKey: randomUUID() })).status, 200);
      assert.equal((await post("follow-up", { readingId: drawn.id, question: "伪造空历史", requestKey: randomUUID(), messages: [] })).status, 429);
      await post("session", { account: "other" });
      assert.equal((await post("unlock", { readingId: drawn.id })).status, 404);
      const forbidden = await GET(new NextRequest(`http://localhost:3100/api/local-paid/readings/${drawn.id}`, { headers: { cookie } }), { params: { path: ["readings", drawn.id] } });
      assert.equal(forbidden.status, 404);
      process.env.PAID_LOCAL_MODE = "0";
      assert.equal((await post("session", { account: "new" })).status, 404);
      process.env.PAID_LOCAL_MODE = "1";
      getPaidLocalStore().close();
      process.env.PAID_LOCAL_DB = filename;
    });
  } finally {
    store.close();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
