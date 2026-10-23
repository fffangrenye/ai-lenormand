import assert from "node:assert/strict";
import test from "node:test";
import { autoShufflePose } from "../auto-shuffle";
import { createShuffleTable, containCard } from "../deep-shuffle-physics";
import { summarizeAiUsage } from "../paid-local/ai-usage";

test("automatic shuffle follows a repeatable split and ends with every card squared in the centre", () => {
  for (const width of [268, 614]) {
    const table = createShuffleTable(width, 280);
    for (let index = 0; index < table.cards.length; index++) {
      const card = table.cards[index];
      const origin = { ...card };
      assert.deepEqual(autoShufflePose(table, index, 0, origin), { x: card.x, y: card.y, angle: card.angle });
      for (let step = 0; step <= 100; step++) {
        const pose = autoShufflePose(table, index, step / 100, origin);
        assert.deepEqual(pose, autoShufflePose(table, index, step / 100, origin));
        Object.assign(card, pose); containCard(table, card);
        assert.ok(Number.isFinite(card.x) && Number.isFinite(card.y));
      }
      const end = autoShufflePose(table, index, 1, origin);
      assert.equal(end.angle, 0); assert.ok(Math.abs(end.x - width / 2) < 5); assert.ok(Math.abs(end.y - 140) < 5);
    }
    const a = autoShufflePose(table, 0, 0.38, table.cards[0]); const b = autoShufflePose(table, 1, 0.38, table.cards[1]);
    assert.ok(a.x < width / 2 && b.x > width / 2);
  }
});

test("usage accounting distinguishes cache hits and rejects absent/invalid provider usage", () => {
  assert.deepEqual(summarizeAiUsage({ prompt_tokens: 1800, prompt_cache_hit_tokens: 1200, completion_tokens: 900 }), { promptTokens: 1800, cachedInputTokens: 1200, uncachedInputTokens: 600, completionTokens: 900, totalTokens: 2700 });
  assert.equal(summarizeAiUsage(undefined), null); assert.equal(summarizeAiUsage({ prompt_tokens: -1, completion_tokens: 4 }), null);
  assert.equal(summarizeAiUsage({ prompt_tokens: 1.5, completion_tokens: 4 }), null);
});
