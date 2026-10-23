import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { beijingDateKey, calendarDaySlots, consecutiveCheckInProgress, nextBeijingMidnight } from "../check-in-calendar";
import { getPaidLocalStore, PaidLocalStore } from "../paid-local/store";
import type { DailyCheckInResult, PaidResult } from "../paid-local/types";
import { GET, POST } from "../../app/api/local-paid/[[...path]]/route";

test("V2 daily cards, consecutive rewards and API ownership remain consistent", async (t) => {
  const before = { ...process.env };
  const file = path.join(process.cwd(), ".local-paid", `daily-${randomUUID()}.sqlite`);
  Object.assign(process.env, { NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "mock", PAID_LOCAL_DB: file, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "" });
  let now = Date.parse("2026-10-30T15:59:59.000Z");
  let store = new PaidLocalStore(file, () => now); const user = store.login("new").userId; let apiUsed = false;
  try {
    await t.test("visiting the calendar does not draw, and repeated draws preserve the exact fortune", () => {
      assert.equal(store.dailyCalendar(user).todayEntry, null); assert.equal(store.dailyCalendar(user).totalDays, 0);
      const first = store.checkIn(user);
      assert.equal(first.today, "2026-10-30"); assert.equal(first.newlyCheckedIn, true); assert.equal(first.totalDays, 1);
      assert.equal(first.balance.available, 1); assert.equal(first.grantedMilestones.length, 0);
      assert.deepEqual(store.checkIn(user).entry, first.entry); assert.equal(store.checkIn(user).newlyCheckedIn, false);
      assert.equal(store.dailyCalendar(user).entries.length, 1);
      store.close(); store = new PaidLocalStore(file, () => now);
      assert.deepEqual(store.checkIn(user).entry, first.entry);
    });
    await t.test("gaps reset reward progress; each consecutive three-day block earns once", () => {
      now = Date.parse("2026-10-30T16:00:00Z");
      const second = store.checkIn(user); assert.equal(second.today, "2026-10-31"); assert.equal(second.totalDays, 2);
      now = Date.parse("2026-11-02T04:00:00Z");
      const third = store.checkIn(user); assert.equal(third.totalDays, 3); assert.equal(third.currentStreak, 1); assert.deepEqual(third.grantedMilestones, []); assert.equal(third.balance.available, 1); assert.equal(third.nextRewardIn, 2);
      assert.equal(store.dailyCalendar(user, "2026-10").entries.length, 2); assert.equal(store.dailyCalendar(user, "2026-11").entries.length, 1);
      now = Date.parse("2026-11-03T04:00:00Z"); assert.deepEqual(store.checkIn(user).grantedMilestones, []);
      now = Date.parse("2026-11-04T04:00:00Z"); const reward = store.checkIn(user); assert.equal(reward.currentStreak, 3); assert.deepEqual(reward.grantedMilestones, [3]); assert.equal(reward.balance.available, 2);
      assert.equal(store.checkIn(user).totalRewards, 1); assert.deepEqual(store.checkIn(user).grantedMilestones, []);
      for (const day of [5, 6, 7]) { now = Date.parse(`2026-11-0${day}T04:00:00Z`); store.checkIn(user); }
      const sixth = store.dailyCalendar(user); assert.equal(sixth.currentStreak, 6); assert.equal(sixth.totalRewards, 2); assert.equal(sixth.balance.available, 3);
      now = Date.parse("2026-11-08T04:00:00Z"); assert.equal(store.dailyCalendar(user).currentStreak, 6); // Today can still extend yesterday's streak.
      now = Date.parse("2026-11-09T04:00:00Z"); const expired = store.dailyCalendar(user); assert.equal(expired.currentStreak, 0); assert.equal(expired.cycleDays, 0); assert.equal(expired.nextRewardIn, 3); assert.equal(expired.totalRewards, 2);
      for (const day of [9, 10, 11]) { now = Date.parse(`2026-11-${String(day).padStart(2, "0")}T04:00:00Z`); store.checkIn(user); }
      assert.equal(store.dailyCalendar(user).currentStreak, 3); assert.equal(store.dailyCalendar(user).totalRewards, 3);
      assert.equal(store.overview(user).ledger.filter((row) => row.kind === "checkin_reward").length, 3);
    });
    await t.test("separate processes racing on the third day create one card and one reward", async () => {
      const other = store.login("other").userId;
      now = Date.parse("2026-12-30T04:00:00Z"); store.checkIn(other);
      now = Date.parse("2026-12-31T04:00:00Z"); store.checkIn(other);
      now = Date.parse("2027-01-01T04:00:00Z");
      const results = await Promise.all(Array.from({ length: 8 }, () => new Promise<{ date: string; card: number; newlyCheckedIn: boolean; rewards: number[] }>((resolve, reject) => {
        const worker = spawn(process.execPath, ["scripts/daily-check-in-worker.cjs", other, String(now)], { cwd: process.cwd(), env: process.env, windowsHide: true });
        let out = ""; let err = ""; worker.stdout.on("data", (data) => out += data); worker.stderr.on("data", (data) => err += data);
        worker.on("error", reject); worker.on("exit", (code) => code ? reject(new Error(err)) : resolve(JSON.parse(out)));
      })));
      assert.equal(new Set(results.map((row) => row.card)).size, 1); assert.equal(results.filter((row) => row.newlyCheckedIn).length, 1);
      assert.equal(results.reduce((count, row) => count + row.rewards.length, 0), 1);
      const summary = store.dailyCalendar(other); assert.equal(summary.totalDays, 3); assert.equal(summary.currentStreak, 3); assert.equal(summary.totalRewards, 1); assert.equal(summary.balance.available, 2);
      assert.equal(store.dailyCalendar(user, "2027-01").entries.length, 0);
    });
    await t.test("upgrading preserves old cumulative rewards without paying the saved day twice", () => {
      const upgradeFile = path.join(process.cwd(), ".local-paid", `daily-upgrade-${randomUUID()}.sqlite`);
      let upgradeNow = Date.parse("2026-09-01T04:00:00Z");
      let upgrade = new PaidLocalStore(upgradeFile, () => upgradeNow);
      try {
        const id = upgrade.login("new").userId;
        for (const day of [1, 2, 3]) { upgradeNow = Date.parse(`2026-09-0${day}T04:00:00Z`); upgrade.checkIn(id); }
        const saved = upgrade.dailyCalendar(id).todayEntry;
        upgrade.close();
        const old = new DatabaseSync(upgradeFile);
        old.exec("INSERT INTO check_in_rewards(user_id,milestone,batch_id,earned_on,created_at) SELECT user_id,milestone,batch_id,earned_on,created_at FROM consecutive_check_in_rewards; DROP TABLE consecutive_check_in_rewards; DELETE FROM local_schema_versions WHERE version=5;");
        old.close(); upgrade = new PaidLocalStore(upgradeFile, () => upgradeNow);
        const repeat = upgrade.checkIn(id); assert.deepEqual(repeat.entry, saved); assert.deepEqual(repeat.grantedMilestones, []); assert.equal(repeat.totalRewards, 1); assert.equal(repeat.balance.available, 2);
        for (const day of [4, 5, 6]) { upgradeNow = Date.parse(`2026-09-0${day}T04:00:00Z`); upgrade.checkIn(id); }
        assert.equal(upgrade.dailyCalendar(id).totalRewards, 2); assert.equal(upgrade.dailyCalendar(id).balance.available, 3);
      } finally { upgrade.close(); }
    });
    await t.test("earned petals unlock a complete reading and its two follow-ups", () => {
      const other = "local-other";
      const result: PaidResult = { conclusion: "测试结论", interpretation: "保留原牌", uncertainty: "测试", advice: "测试", model: "local_mock", promptVersion: "test" };
      let finalId = "";
      for (let i = 0; i < 2; i++) {
        const reading = store.draw(other, { question: `签到奖励验证 ${i}`, spread: "three_card", requestKey: randomUUID() });
        const run = store.reserveReading(other, reading.id); store.completeReading(other, reading.id, run.runId!, result); finalId = reading.id;
      }
      assert.equal(store.overview(other).balance.available, 0);
      for (let i = 0; i < 2; i++) { const follow = store.reserveFollowUp(other, finalId, `追问 ${i}`, randomUUID()); store.completeFollowUp(other, finalId, follow.id, follow.attempt!, "原牌回复"); }
      assert.equal(store.reading(other, finalId).followUpsRemaining, 0);
      assert.throws(() => store.reserveFollowUp(other, finalId, "超出追问", randomUUID()));
      const raw = new DatabaseSync(file); assert.equal(raw.prepare("SELECT consumed FROM credit_batches WHERE user_id=? AND source=?").get(other, "checkin_reward")?.consumed, 1); assert.deepEqual(raw.prepare("PRAGMA foreign_key_check").all(), []); raw.close();
    });
    await t.test("calendar dates cover leap months and server-local midnight correctly", () => {
      assert.equal(beijingDateKey(Date.parse("2026-10-20T16:00:00Z")), "2026-10-21");
      assert.equal(nextBeijingMidnight(Date.parse("2026-10-21T04:00:00Z")), "2026-10-21T16:00:00.000Z");
      const leap = calendarDaySlots("2028-02"); assert.equal(leap.filter(Boolean).length, 29); assert.ok(leap.includes("2028-02-29")); assert.equal(leap.length % 7, 0);
      assert.deepEqual(consecutiveCheckInProgress(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01"), { currentStreak: 3, streakStart: "2028-02-28" });
      assert.throws(() => store.dailyCalendar(user, "2026-13")); assert.throws(() => store.checkIn("forged-user"));
    });
    await t.test("API ignores forged client dates/cards and requires a local authenticated owner", async () => {
      const apiFile = path.join(process.cwd(), ".local-paid", `daily-api-${randomUUID()}.sqlite`); process.env.PAID_LOCAL_DB = apiFile; apiUsed = true;
      const req = (action: string, body?: object, token = "") => new NextRequest(`http://127.0.0.1:3100/api/local-paid/${action}`, { method: body ? "POST" : "GET", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "x-local-paid": "1", cookie: token }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal((await GET(req("daily"), { params: { path: ["daily"] } })).status, 401);
      const login = await POST(req("session", { account: "new" }), { params: { path: ["session"] } }); const cookie = login.headers.get("set-cookie")!.split(";")[0];
      const firstResponse = await POST(req("daily-check-in", { date: "2099-01-01", cardNumber: 999 }, cookie), { params: { path: ["daily-check-in"] } });
      assert.equal(firstResponse.status, 200); const first = await firstResponse.json() as DailyCheckInResult;
      assert.equal(first.userId, "local-new");
      assert.equal(first.today, beijingDateKey()); assert.ok(first.entry.card.number >= 1 && first.entry.card.number <= 36);
      const again = await POST(req("daily-check-in", {}, cookie), { params: { path: ["daily-check-in"] } });
      assert.deepEqual((await again.json() as DailyCheckInResult).entry, first.entry);
      const denied = await POST(new NextRequest("http://127.0.0.1:3100/api/local-paid/daily-check-in", { method: "POST", headers: { host: "127.0.0.1:3100", origin: "https://foreign.invalid", cookie }, body: "{}" }), { params: { path: ["daily-check-in"] } }); assert.equal(denied.status, 403);
      const otherLogin = await POST(req("session", { account: "legacy" }, cookie), { params: { path: ["session"] } });
      const otherCookie = otherLogin.headers.get("set-cookie")!.split(";")[0];
      const calendar = await GET(req(`daily?userId=local-new&month=${first.today.slice(0, 7)}`, undefined, otherCookie), { params: { path: ["daily"] } });
      const isolated = await calendar.json() as DailyCheckInResult; assert.equal(isolated.userId, "local-legacy"); assert.equal(isolated.totalDays, 0); assert.deepEqual(isolated.entries, []);
      assert.equal((await GET(req("daily", undefined, cookie), { params: { path: ["daily"] } })).status, 401);
    });
  } finally {
    if (apiUsed) getPaidLocalStore().close(); store.close(); for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before);
  }
});
