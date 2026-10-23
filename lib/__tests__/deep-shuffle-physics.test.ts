import assert from "node:assert/strict";
import test from "node:test";
import { createShuffleTable, pushShuffleCards, settleShuffleCards } from "../deep-shuffle-physics";

test("rubbing moves nearby cards independently, while empty-table gestures earn no mixing progress", () => {
  const table = createShuffleTable(730, 370);
  const initial = structuredClone(table.cards);
  assert.equal(pushShuffleCards(table, 10, 10, 70, 10), 0);
  assert.deepEqual(table.cards, initial);
  assert.ok(pushShuffleCards(table, 350, 185, 465, 205) > 0);
  const displacements = table.cards.map((card, i) => Math.round(Math.hypot(card.x - initial[i].x, card.y - initial[i].y)));
  assert.ok(new Set(displacements).size > 5);
  assert.ok(displacements.some((value) => value === 0));
});

test("all rotated card corners remain within the table after vigorous desktop and phone gestures", () => {
  for (const width of [268, 320, 730]) {
    const table = createShuffleTable(width, 340);
    for (let i = 0; i < 180; i++) {
      const x = width / 2 + Math.sin(i * 0.7) * width;
      const y = 170 + Math.cos(i * 0.9) * 340;
      pushShuffleCards(table, width / 2, 170, x, y);
      settleShuffleCards(table, 2);
      for (const card of table.cards) {
        const rx = (table.cardWidth * Math.abs(Math.cos(card.angle)) + table.cardHeight * Math.abs(Math.sin(card.angle))) / 2;
        const ry = (table.cardHeight * Math.abs(Math.cos(card.angle)) + table.cardWidth * Math.abs(Math.sin(card.angle))) / 2;
        assert.ok(card.x - rx >= 0 && card.x + rx <= width);
        assert.ok(card.y - ry >= 0 && card.y + ry <= 340);
      }
    }
    let moving = true;
    for (let i = 0; i < 300 && moving; i++) moving = settleShuffleCards(table, 1);
    assert.equal(moving, false, "released cards should come to rest");
    assert.equal(table.cards.length, 36);
    pushShuffleCards(table, width / 2, 170, width / 2 + 50, 200);
    assert.equal(settleShuffleCards(table, 1, true), false, "reduced motion skips inertia");
  }
});
