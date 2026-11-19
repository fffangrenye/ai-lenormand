import assert from "node:assert/strict";
import test from "node:test";
import { consumeYesNoQuota, getYesNoQuotaSnapshot, getYesNoServerSnapshot, readYesNoQuota, yesNoBeijingDay, yesNoDailyLimit, YES_NO_QUOTA_KEY } from "../yes-no-quota";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const morning = Date.parse("2026-10-30T01:00:00Z");
const changeAt = Date.parse("2026-11-20T00:00:00+08:00");

test("the daily limit changes from five to three at exactly Beijing November 20 midnight", () => {
  assert.equal(yesNoDailyLimit(changeAt - 1), 5);
  assert.equal(yesNoDailyLimit(changeAt), 3);
  assert.equal(yesNoDailyLimit(Date.parse("2026-11-21T12:00:00+08:00")), 3);
});

test("November 19 keeps all five uses and November 20 resets to three without changing old records", () => {
  const storage = memoryStorage();
  for (let used = 1; used <= 5; used++) assert.deepEqual(consumeYesNoQuota(storage, changeAt - 1), { ok: true, used });
  assert.deepEqual(consumeYesNoQuota(storage, changeAt - 1), { ok: false, reason: "limit" });
  const previous = storage.getItem(YES_NO_QUOTA_KEY);
  assert.equal(readYesNoQuota(storage, changeAt).used, 0);
  assert.equal(storage.getItem(YES_NO_QUOTA_KEY), previous);
  for (let used = 1; used <= 3; used++) assert.deepEqual(consumeYesNoQuota(storage, changeAt), { ok: true, used });
  assert.deepEqual(consumeYesNoQuota(storage, changeAt), { ok: false, reason: "limit" });
  assert.equal(JSON.parse(storage.getItem(YES_NO_QUOTA_KEY)!).day, "2026-11-20");
});

test("an old five-use record on November 20 cannot grant a fourth use", () => {
  const storage = memoryStorage();
  storage.setItem(YES_NO_QUOTA_KEY, JSON.stringify({ day: "2026-11-20", used: 5 }));
  assert.equal(readYesNoQuota(storage, changeAt).used, 3);
  assert.deepEqual(consumeYesNoQuota(storage, changeAt), { ok: false, reason: "limit" });
});

test("snapshot updates the day and limit at midnight even when no draws were used", () => {
  const beforeWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const clock = Date.now;
  const storage = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  try {
    Date.now = () => changeAt - 1;
    assert.equal(getYesNoQuotaSnapshot(), "2026-11-19|5|0");
    Date.now = () => changeAt;
    assert.equal(getYesNoQuotaSnapshot(), "2026-11-20|3|0");
    assert.equal(getYesNoServerSnapshot(), "loading|5|-2");
    const blocked = { getItem: () => { throw new Error("unavailable"); } };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: blocked } });
    assert.equal(getYesNoQuotaSnapshot(), "2026-11-20|3|-1");
  } finally {
    Date.now = clock;
    if (beforeWindow) Object.defineProperty(globalThis, "window", beforeWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("five successful draws persist across reloads and the sixth is refused", () => {
  const storage = memoryStorage();
  for (let used = 1; used <= 3; used++) {
    assert.deepEqual(consumeYesNoQuota(storage, morning), { ok: true, used });
    assert.equal(readYesNoQuota(storage, morning).used, used);
  }
  const reloadedStorage = { ...storage };
  assert.deepEqual(consumeYesNoQuota(reloadedStorage, morning), { ok: true, used: 4 });
  assert.deepEqual(consumeYesNoQuota(reloadedStorage, morning), { ok: true, used: 5 });
  assert.deepEqual(consumeYesNoQuota(reloadedStorage, morning), { ok: false, reason: "limit" });
  assert.equal(readYesNoQuota(reloadedStorage, morning).used, 5);
});

test("Beijing midnight resets quota independently of the device timezone", () => {
  const storage = memoryStorage();
  const before = Date.parse("2026-10-30T15:59:59.999Z");
  const after = Date.parse("2026-10-30T16:00:00.000Z");
  assert.equal(yesNoBeijingDay(before), "2026-10-30");
  assert.equal(yesNoBeijingDay(after), "2026-10-31");
  for (let i = 0; i < 5; i++) consumeYesNoQuota(storage, before);
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
  consumeYesNoQuota(otherTab, morning);
  consumeYesNoQuota(storage, morning);
  assert.equal(readYesNoQuota(otherTab, morning).used, 5);
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
