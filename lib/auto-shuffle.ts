import type { ShuffleTable } from "./deep-shuffle-physics";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
type Pose = { x: number; y: number; angle: number };
const blend = (a: Pose, b: Pose, t: number): Pose => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: a.angle + (b.angle - a.angle) * t });

/** A repeatable gather → split → interleave → cut → square ritual, independent of frame rate. */
export function autoShufflePose(table: Pick<ShuffleTable, "width" | "height">, index: number, progress: number, origin: Pose): Pose {
  const t = clamp01(progress); const cx = table.width / 2; const cy = table.height / 2;
  const side = index % 2 === 0 ? -1 : 1; const rank = Math.floor(index / 2);
  const stacked = { x: cx + index * 0.12 - 2.1, y: cy - index * 0.17 + 3, angle: 0 };
  const split = { x: cx + side * Math.min(table.width * 0.2, 116) + rank * 0.14, y: cy + rank * 0.2 - 3, angle: side * 0.18 };
  const joined = { x: cx + side * 5 + rank * 0.12, y: cy - rank * 0.25, angle: side * 0.025 };
  const cut = { x: stacked.x + (index >= 18 ? Math.min(table.width * 0.19, 104) : -22), y: stacked.y + (index >= 18 ? -24 : 8), angle: index >= 18 ? 0.08 : 0 };
  if (t < 0.18) return blend(origin, stacked, ease(t / 0.18));
  if (t < 0.38) return blend(stacked, split, ease((t - 0.18) / 0.2));
  if (t < 0.7) return blend(split, joined, ease((t - 0.38 - rank * 0.004) / 0.23));
  if (t < 0.82) return blend(joined, cut, ease((t - 0.7) / 0.12));
  return blend(cut, stacked, ease((t - 0.82) / 0.18));
}
