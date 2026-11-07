import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PaidLocalStore } from "../paid-local/store";
import type { PaidResult } from "../paid-local/types";

test("conversation management preserves original content and enforces ownership and the 30-day recovery window", () => {
  const file = path.join(process.cwd(), ".local-paid", "conversation-test-" + randomUUID() + ".sqlite");
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: "test", PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: "mock", PAID_LOCAL_DB: file,
    NEXT_PUBLIC_PAID_LOCAL_CONVERSATION_PREVIEW: "0", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: ""
  });
  let now = Date.parse("2026-11-06T12:00:00Z");
  let store: PaidLocalStore | undefined;
  try {
    store = new PaidLocalStore(file, () => now);
    const user = store.login("new").userId;
    const other = store.login("other").userId;
    const source = store.saveProject(user, { title: "我的解读" });
    const historical = store.draw(user, { projectId: source.id, question: "升级前的历史记录", spread: "three_card", requestKey: randomUUID() });
    store.close();
    store = undefined;
    process.env.NEXT_PUBLIC_PAID_LOCAL_CONVERSATION_PREVIEW = "1";
    store = new PaidLocalStore(file, () => now);
    const local = store;
    assert.deepEqual(local.reading(user, historical.id), historical);
    const destination = local.saveProject(user, { title: "工作项目" });
    const foreignProject = local.saveProject(other, { title: "另一用户的项目" });
    const start = local.startDrawSession(user, { projectId: source.id, question: "原问题", spread: "three_card", requestKey: randomUUID() });
    const selected = local.pickDrawCards(user, start.id, start.deck.slice(0, 3).map(card => card.token), 0);
    assert.ok(selected.readingId);
    const id = selected.readingId;
    const untouched = local.draw(user, { projectId: source.id, question: "应当保留的另一条", spread: "three_card", requestKey: randomUUID() });
    const reservation = local.reserveReading(user, id);
    assert.ok(reservation.runId);
    assert.throws(() => local.trashReading(user, id, source.id), { code: "READING_BUSY" });
    assert.throws(() => local.moveReading(user, id, source.id, destination.id), { code: "READING_BUSY" });
    const mockResult: PaidResult = { conclusion: "原结论", interpretation: "原解读", uncertainty: "原提示", advice: "原建议", model: "test", promptVersion: "test" };
    local.completeReading(user, id, reservation.runId, mockResult);
    const follow = local.reserveFollowUp(user, id, "原追问", randomUUID());
    assert.ok(follow.attempt);
    assert.throws(() => local.trashReading(user, id, source.id), { code: "READING_BUSY" });
    local.completeFollowUp(user, id, follow.id, follow.attempt, "原回复");
    const original = local.reading(user, id);
    const balance = local.summary(user).balance;

    assert.throws(() => local.moveReading(user, id, source.id, foreignProject.id), { code: "NOT_FOUND" });
    assert.throws(() => local.trashReading(other, id, source.id), { code: "NOT_FOUND" });
    local.trashReading(user, id, source.id);
    const firstDeletion = local.readingTrash(user).items[0];
    now += 1000;
    local.trashReading(user, id, source.id);
    assert.deepEqual(local.readingTrash(user).items[0], firstDeletion);
    assert.deepEqual(new Set(local.projectReadingPage(user, source.id).items.map(reading => reading.id)), new Set([historical.id, untouched.id]));
    assert.deepEqual(new Set(local.overview(user).readings.map(reading => reading.id)), new Set([historical.id, untouched.id]));
    assert.equal(local.usagePage(user).items.length, 0);
    assert.throws(() => local.reading(user, id), { code: "NOT_FOUND" });
    assert.throws(() => local.drawSession(user, start.id), { code: "NOT_FOUND" });
    assert.deepEqual(local.readingTrash(other).items, []);
    assert.throws(() => local.restoreReading(other, id, foreignProject.id), { code: "NOT_FOUND" });

    now = Date.parse(firstDeletion.expiresAt) - 1;
    assert.equal(local.restoreReading(user, id).projectId, source.id);
    assert.deepEqual(local.reading(user, id), original);
    assert.equal(local.readingTrash(user).items.length, 0);
    assert.equal(local.moveReading(user, id, source.id, destination.id).projectId, destination.id);
    assert.equal(local.moveReading(user, id, source.id, destination.id).projectId, destination.id);
    assert.deepEqual(new Set(local.projectReadings(user, source.id).map(reading => reading.id)), new Set([historical.id, untouched.id]));
    assert.deepEqual(local.projectReadings(user, destination.id)[0], { ...original, projectId: destination.id });
    assert.equal(local.drawSession(user, start.id).projectId, destination.id);
    assert.deepEqual(local.summary(user).balance, balance);
    assert.throws(() => local.trashReading(user, id, source.id), { code: "READING_MOVED" });

    local.trashReading(user, id, destination.id);
    local.archiveProject(user, destination.id);
    assert.throws(() => local.restoreReading(user, id), { code: "NOT_FOUND" });
    assert.equal(local.restoreReading(user, id, source.id).projectId, source.id);
    local.trashReading(user, id, source.id);
    now = Date.parse(local.readingTrash(user).items[0].expiresAt);
    assert.equal(local.readingTrash(user).items.length, 0);
    assert.throws(() => local.restoreReading(user, id), { code: "TRASH_EXPIRED" });
    assert.deepEqual(local.summary(user).balance, balance);
  } finally {
    store?.close();
    process.env = previousEnv;
    for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
  }
});
