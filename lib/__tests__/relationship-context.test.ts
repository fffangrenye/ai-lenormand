import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { schema } from "../../workers/flora-api/schema";
import { PaidLedger } from "../paid-local/ledger";
import { relationshipMigration } from "../paid-local/relationship-migration";
import { PaidLocalStore } from "../paid-local/store";
import { normalizeRelationshipContext, relationshipPrompt } from "../paid-local/relationship-context";
import { buildPaidReadingPrompt } from "../paid-local/model";
import { getGuestReview, issueGuestReview, validateDrawQuestion } from "../paid-local/reviewed-draw";
import { getDeepSpread } from "../deep-spreads";

test("adding H context preserves existing readings, sessions and balances and remains readable by the previous schema", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  const tx = <T>(work: () => T) => {
    db.exec("BEGIN");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const store = new PaidLedger(db, tx);
  try {
    const owner = randomUUID(), reading = randomUUID(), session = randomUUID();
    store.ensureUser(owner, "migration@example.invalid");
    const project = store.saveProject(owner, { title: "历史兼容性测试" });
    db.prepare("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,created_at) VALUES(?,?,?,?,?,'[]',?)")
      .run(reading, owner, randomUUID(), "以前的问题", "h_seven", new Date().toISOString());
    db.prepare("INSERT INTO paid_draw_sessions(id,user_id,project_id,request_key,question,spread,choices_json,deck_json,created_at) VALUES(?,?,?,?,?,?,'[]','[]',?)")
      .run(session, owner, project.id, randomUUID(), "以前的抽牌", "h_seven", new Date().toISOString());
    const oldReading = store.reading(owner, reading), balance = store.summary(owner).balance;
    tx(() => db.exec(relationshipMigration));
    assert.deepEqual(store.reading(owner, reading), oldReading);
    assert.deepEqual(store.summary(owner).balance, balance);
    assert.equal(db.prepare("SELECT relationship_json FROM paid_readings WHERE id=?").get(reading)!.relationship_json, "null");
    assert.equal(db.prepare("SELECT relationship_json FROM paid_draw_sessions WHERE id=?").get(session)!.relationship_json, "null");
    assert.equal(db.prepare("SELECT id,question FROM paid_readings WHERE id=?").get(reading)!.question, "以前的问题");
    assert.equal(db.prepare("SELECT count(*) n FROM local_schema_versions WHERE version=15").get()!.n, 1);
  } finally { db.close(); }
});

test("H identities persist through resume and card selection, cannot change on retries, and stay isolated", async () => {
  const before = { ...process.env };
  const file = path.resolve(".local-paid", `relationship-${randomUUID()}.sqlite`);
  Object.assign(process.env, { NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "mock", PAID_LOCAL_DB: file, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "" });
  let store = new PaidLocalStore(file);
  try {
    const user = store.login("new").userId, other = store.login("other").userId;
    const project = store.saveProject(user, { title: "本地 H 牌阵人物测试" });
    const input = { projectId: project.id, question: "我们目前的相处状态是什么？", spread: "h_seven" as const, requestKey: randomUUID(), relationship: { selfGender: "woman" as const, otherGender: "man" as const } };
    const draw = store.startDrawSession(user, input);
    assert.deepEqual(draw.relationship, input.relationship);
    assert.equal(draw.deck.length, 36);
    assert.equal(store.startDrawSession(user, input).id, draw.id);
    assert.throws(() => store.startDrawSession(user, { ...input, relationship: { selfGender: "man", otherGender: "woman" } }), /改变/);
    assert.throws(() => store.drawSession(other, draw.id), /找不到/);
    store.close(); store = new PaidLocalStore(file);
    assert.deepEqual(store.drawSession(user, draw.id).relationship, input.relationship);
    const finished = store.pickDrawCards(user, draw.id, draw.deck.slice(0, 7).map(c => c.token), 0);
    const reading = store.reading(user, finished.readingId!);
    assert.deepEqual(reading.relationship, input.relationship);
    assert.equal(new Set(reading.cards.map(c => c.number)).size, 7);
    assert.equal(store.summary(user).balance.consumed, 0);
    assert.match(buildPaidReadingPrompt(reading), /女人牌（29）作为我方/);
    assert.match(buildPaidReadingPrompt(reading), /男人牌（28）作为对方/);
    assert.deepEqual(getDeepSpread("h_seven").paths.map(p => p.indices), [[0, 1, 2], [4, 5, 6], [1, 3, 5]]);
    const plain = store.draw(user, { question: "这次合作现在的状态？", spread: "three_card", requestKey: randomUUID() });
    assert.equal(plain.relationship, undefined);
  } finally { store.close(); process.env = before; }
});

test("guest approvals bind H identities while same-gender readings do not invent unique people", async () => {
  const input = { question: "我们如何相处？", spread: "h_seven" as const, relationship: { selfGender: "woman" as const, otherGender: "woman" as const } };
  const key = "test-only-relationship-key".repeat(3);
  const { approval } = await issueGuestReview(input, key, async () => null);
  assert(getGuestReview(input, approval, key));
  assert.throws(() => getGuestReview({ ...input, relationship: { selfGender: "woman", otherGender: "man" } }, approval, key), /变化/);
  assert.match(relationshipPrompt(input.relationship), /不把单张人物牌唯一绑定/);
  assert.doesNotMatch(relationshipPrompt(input.relationship), /作为我方的指示牌/);
  assert.throws(() => normalizeRelationshipContext("h_seven", { selfGender: "unknown", otherGender: "man" }));
  assert.throws(() => normalizeRelationshipContext("three_card", input.relationship));
  assert.equal(validateDrawQuestion({ question: "目前状态？", spread: "three_card" }).relationship, undefined);
});
