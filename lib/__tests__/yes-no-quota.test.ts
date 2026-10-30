import assert from "node:assert/strict";
import test from "node:test";
import { consumeYesNoQuota, readYesNoQuota, yesNoBeijingDay, YES_NO_QUOTA_KEY } from "../yes-no-quota";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const morning = Date.parse("2026-10-30T01:00:00Z");

test("three successful draws persist across reloads and the fourth is refused", () => {
  const storage = memoryStorage();
  for (let used = 1; used <= 3; used++) {
    assert.deepEqual(consumeYesNoQuota(storage, morning), { ok: true, used });
    assert.equal(readYesNoQuota(storage, morning).used, used);
  }
  const reloadedStorage = { ...storage };
  assert.deepEqual(consumeYesNoQuota(reloadedStorage, morning), { ok: false, reason: "limit" });
  assert.equal(readYesNoQuota(reloadedStorage, morning).used, 3);
});

test("Beijing midnight resets quota independently of the device timezone", () => {
  const storage = memoryStorage();
  const before = Date.parse("2026-10-30T15:59:59.999Z");
  const after = Date.parse("2026-10-30T16:00:00.000Z");
  assert.equal(yesNoBeijingDay(before), "2026-10-30");
  assert.equal(yesNoBeijingDay(after), "2026-10-31");
  for (let i = 0; i < 3; i++) consumeYesNoQuota(storage, before);
  assert.equal(readYesNoQuota(storage, after).used, 0);
  assert.deepEqual(consumeYesNoQuota(storage, after), { ok: true, used: 1 });
});

test("reading remaining quota does not spend uses; two views share one record", () => {
  const storage = memoryStorage();
  for (let i = 0; i < 5; i++) assert.equal(readYesNoQuota(storage, morning).used, 0);
  const otherTab = { ...storage };
  consumeYesNoQuota(storage, morning);
  consumeYesNoQuota(otherTab, morning);
  consumeYesNoQuota(storage, morning);
  assert.equal(readYesNoQuota(otherTab, morning).used, 3);
  assert.deepEqual(consumeYesNoQuota(otherTab, morning), { ok: false, reason: "limit" });
});

test("unavailable storage never grants a draw without recording it", () => {
  const blockedRead = { getItem: () => { throw Error("blocked"); }, setItem: () => {} };
  assert.equal(readYesNoQuota(blockedRead, morning).available, false);
  assert.deepEqual(consumeYesNoQuota(blockedRead, morning), { ok: false, reason: "storage" });
  const failedWrite = { getItem: () => null, setItem: () => { throw Error("full"); } };
  assert.deepEqual(consumeYesNoQuota(failedWrite, morning), { ok: false, reason: "storage" });
});

test("damaged records recover while an excessive stored count stays limited", () => {
  const storage = memoryStorage();
  storage.setItem(YES_NO_QUOTA_KEY, "{broken");
  assert.deepEqual(consumeYesNoQuota(storage, morning), { ok: true, used: 1 });
  storage.setItem(YES_NO_QUOTA_KEY, JSON.stringify({ day: "2026-10-30", used: 30 }));
  assert.deepEqual(consumeYesNoQuota(storage, morning), { ok: false, reason: "limit" });
});
