import assert from "node:assert/strict";
import test from "node:test";
import { getYesNoResult, yesNoDeck } from "../yes-no";

test("Yes/No follows the net tendency and reserves unclear for a tie", () => {
  for (const [scores, expected] of [
    [[1, 1, -1], "YES"], [[-1, -1, 1], "NO"],
    [[1, 0, 0], "YES"], [[-1, 0, 0], "NO"],
    [[1, -1, 0], "UNCLEAR"], [[0, 0, 0], "UNCLEAR"]
  ] as const) {
    assert.equal(getYesNoResult(scores.map((score) => ({ score }))), expected);
  }
});

test("enumerate every three-card draw to verify unclear frequency", () => {
  assert.equal(new Set(yesNoDeck.map((card) => card.number)).size, 36);
  let total = 0;
  let oldUnclear = 0;
  let newUnclear = 0;
  for (let a = 0; a < 34; a++) for (let b = a + 1; b < 35; b++) for (let c = b + 1; c < 36; c++) {
    const cards = [yesNoDeck[a], yesNoDeck[b], yesNoDeck[c]];
    const score = cards.reduce((sum, card) => sum + card.score, 0);
    total++;
    if (Math.abs(score) < 2) oldUnclear++;
    if (getYesNoResult(cards) === "UNCLEAR") newUnclear++;
  }
  assert.equal(total, 7140);
  assert.ok(newUnclear / total < 0.3);
  console.log(JSON.stringify({ total, oldUnclear, newUnclear, oldRate: oldUnclear / total, newRate: newUnclear / total }));
});
