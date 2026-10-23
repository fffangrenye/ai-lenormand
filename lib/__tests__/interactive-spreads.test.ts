import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deepSpreads, getDeepSpread } from "../deep-spreads";
import { PaidLocalStore } from "../paid-local/store";
import { generateLocalMain, buildPaidReadingPrompt } from "../paid-local/model";
import { lenormandCards } from "../lenormand-cards";

test("spread layouts and interactive draws preserve ordering, privacy and historical data", async (t) => {
  const before = { ...process.env };
  const file = path.join(process.cwd(), ".local-paid", `interactive-${randomUUID()}.sqlite`);
  Object.assign(process.env, { NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "mock", PAID_LOCAL_DB: file, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "" });
  let now = Date.now();
  let store = new PaidLocalStore(file, () => now);
  const user = store.login("new").userId;
  const other = store.login("other").userId;
  const project = store.saveProject(user, { title: "交互式抽牌验收" });
  try {
    await t.test("all eight layouts have valid unique positions and meaningful reading paths", () => {
      assert.deepEqual(deepSpreads.map((spread) => spread.positions.length), [3,5,6,5,6,9,7,9]);
      for (const spread of deepSpreads) {
        assert.equal(new Set(spread.positions.map((slot) => `${slot.row}:${slot.col}`)).size, spread.positions.length);
        for (const slot of spread.positions) assert.ok(slot.row < spread.rows && slot.col < spread.cols);
        for (const line of spread.paths) for (const index of line.indices) assert.ok(index >= 0 && index < spread.positions.length);
      }
      assert.deepEqual(getDeepSpread("h_seven").positions[3], { label: "双方连接点", row: 1, col: 1 });
      assert.deepEqual(getDeepSpread("cross_five").paths[0].indices, [1,0,2]);
      assert.deepEqual(getDeepSpread("choice_three").paths.map((line) => line.indices), [[0,1,2],[3,4,5],[6,7,8]]);
    });
    await t.test("every spread draws the exact clicked cards into its own positions, with no debit before interpretation", async () => {
      for (const spread of deepSpreads) {
        now += 61000;
        const choices = spread.choiceCount ? ["留在原岗位", "接受新邀请", "先学习再求职"].slice(0, spread.choiceCount) : [];
        const input = { projectId: project.id, question: `未来一个月：${spread.name}验收`, spread: spread.id, choices, requestKey: randomUUID() };
        const started = store.startDrawSession(user, input);
        assert.equal(store.startDrawSession(user, input).id, started.id);
        assert.doesNotMatch(JSON.stringify(started), /nameZh|nameEn|slug|number|cards_json/);
        assert.equal(started.deck.length, 36); assert.equal(new Set(started.deck.map((card) => card.token)).size, 36);
        let current = started;
        for (let index = 0; index < spread.positions.length; index++) {
          const token = started.deck[(index * 5 + 3) % 36].token;
          current = store.pickDrawCard(user, started.id, token, index);
          assert.equal(current.selected.length, index + 1);
          assert.deepEqual(store.pickDrawCard(user, started.id, token, index), current);
        }
        assert.equal(current.state, "completed"); assert.ok(current.readingId);
        const reading = store.reading(user, current.readingId);
        assert.deepEqual(reading.cards, current.selected);
        assert.equal(new Set(reading.cards.map((card) => card.number)).size, spread.positions.length);
        assert.equal(reading.state, "locked"); assert.equal(store.overview(user).balance.available, 1);
        const result = await generateLocalMain(reading);
        for (const card of reading.cards) assert.ok(result.interpretation.includes(card.nameZh));
        for (const line of spread.paths) assert.ok(result.interpretation.includes(line.label));
        assert.ok(result.advice.includes("1.") && result.advice.includes("3."));
        assert.doesNotMatch(result.conclusion, /结构倾向|相关因素/);
        const prompt = buildPaidReadingPrompt(reading, { background: "双方已约好见面", memorySummary: "只讨论下个月" });
        assert.ok(prompt.includes(spread.rules) && prompt.includes("双方已约好见面"));
        for (const choice of choices) assert.ok(prompt.includes(choice));
      }
    });
    await t.test("refresh, stale picks, forged cards, ownership and cancellation keep the deck intact", () => {
      now += 61000;
      const input = { projectId: project.id, question: "刷新后继续原牌", spread: "h_seven" as const, requestKey: randomUUID() };
      const start = store.startDrawSession(user, input);
      const first = store.pickDrawCard(user, start.id, start.deck[12].token, 0);
      assert.throws(() => store.pickDrawCard(user, start.id, randomUUID(), 1));
      assert.throws(() => store.pickDrawCard(other, start.id, start.deck[1].token, 1));
      assert.throws(() => store.pickDrawCard(user, start.id, start.deck[1].token, 0));
      store.close(); store = new PaidLocalStore(file, () => now);
      assert.deepEqual(store.pendingDrawSession(user, project.id), first);
      store.abandonDrawSession(user, start.id);
      assert.equal(store.pendingDrawSession(user, project.id), null);
      assert.throws(() => store.pickDrawCard(user, start.id, start.deck[1].token, 1));
      assert.equal(store.overview(user).balance.available, 1);
      assert.throws(() => store.startDrawSession(user, { ...input, requestKey: randomUUID(), spread: "choice_two", choices: ["相同", "相同"] }));
      assert.throws(() => store.startDrawSession(user, { ...input, requestKey: randomUUID(), spread: "choice_three", choices: ["A", "B"] }));
      const raw = new DatabaseSync(file); assert.deepEqual(raw.prepare("PRAGMA foreign_key_check").all(), []); raw.close();
      assert.equal(store.overview(user).readings.length, 8);
      const defaultProject = store.ensureDefaultProject(other);
      assert.equal(store.ensureDefaultProject(other).id, defaultProject.id);
      assert.equal(store.projects(other).length, 1);
    });
    await t.test("the v2 database upgrade preserves old cards, results, follow-ups, balances and references", () => {
      const legacyFile = path.join(process.cwd(), ".local-paid", `upgrade-${randomUUID()}.sqlite`);
      const raw = new DatabaseSync(legacyFile);
      raw.exec(readFileSync("lib/paid-local/migrations/001_v1.sql", "utf8"));
      raw.exec(readFileSync("lib/paid-local/migrations/002_original_projects.sql", "utf8"));
      const date = "2026-10-01T00:00:00Z";
      const cards = lenormandCards.slice(0,3).map((card) => ({ ...card, position: "原牌位" }));
      const result = { conclusion: "原结论", interpretation: "原解读", advice: "原建议", uncertainty: "", model: "local_mock", promptVersion: "old" };
      raw.prepare("INSERT INTO local_users VALUES (?,?,?,?)").run("old-user", "老用户", "legacy", date);
      raw.prepare("INSERT INTO local_projects(id,user_id,title,created_at,updated_at,last_opened_at) VALUES (?,?,?,?,?,?)").run("old-project", "old-user", "原项目", date,date,date);
      raw.prepare("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,consumed,created_at) VALUES (?,?,?,?,?,?,?)").run("old-batch","old-user","welcome","old-gift",5,1,date);
      raw.prepare("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,state,result_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("old-reading","old-user","old-request","原问题","three_card",JSON.stringify(cards),"completed",JSON.stringify(result),date);
      raw.prepare("INSERT INTO local_reading_projects VALUES (?,?)").run("old-reading","old-project");
      raw.prepare("INSERT INTO reading_runs VALUES (?,?,?,?,?,?)").run("old-run","old-reading","old-batch","completed",0,date);
      raw.prepare("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?,?)").run("old-ledger","old-user","old-batch","consume:old-run","consume",0,-1,1,"原扣除",date);
      raw.prepare("INSERT INTO paid_follow_ups VALUES (?,?,?,?,?,?,?,?,?)").run("old-follow","old-reading","old-follow-key","原追问","completed","原回答",0,"old-attempt",date);
      raw.close();
      const upgraded = new PaidLocalStore(legacyFile, () => now);
      try {
        const original = upgraded.reading("old-user", "old-reading");
        assert.deepEqual(original.cards, cards); assert.deepEqual(original.result, result);
        assert.equal(original.followUps[0].answer, "原回答"); assert.equal(original.followUpsRemaining, 1);
        assert.deepEqual(upgraded.overview("old-user").balance, { available: 4, reserved: 0, consumed: 1 });
        assert.equal(upgraded.projectReadings("old-user", "old-project").length, 1);
        const inspect = new DatabaseSync(legacyFile); assert.deepEqual(inspect.prepare("PRAGMA foreign_key_check").all(), []); inspect.close();
      } finally { upgraded.close(); }
    });
  } finally {
    store.close();
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
