// Visual table only: the real, hidden deck is still created by the server after this ritual.
export type TableCard = { x: number; y: number; angle: number; vx: number; vy: number; spin: number; layer: number };
export type ShuffleTable = { width: number; height: number; cardWidth: number; cardHeight: number; layer: number; cards: TableCard[] };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function containCard(table: ShuffleTable, card: TableCard) {
  const cos = Math.abs(Math.cos(card.angle)); const sin = Math.abs(Math.sin(card.angle));
  const rx = (table.cardWidth * cos + table.cardHeight * sin) / 2 + 9;
  const ry = (table.cardHeight * cos + table.cardWidth * sin) / 2 + 9;
  const x = clamp(card.x, rx, table.width - rx); const y = clamp(card.y, ry, table.height - ry);
  if (x !== card.x) card.vx *= -0.16;
  if (y !== card.y) card.vy *= -0.16;
  card.x = x; card.y = y;
}

export function createShuffleTable(width: number, height: number): ShuffleTable {
  const cardWidth = clamp(width * 0.105, 44, 70);
  const table: ShuffleTable = { width, height, cardWidth, cardHeight: cardWidth * 1.5, layer: 36, cards: [] };
  table.cards = Array.from({ length: 36 }, (_, i) => {
    const card = { x: width / 2 + ((i % 6) - 2.5) * Math.min(width / 12, 38) + Math.sin(i * 3.7) * 10, y: height / 2 + (Math.floor(i / 6) - 2.5) * 17 + Math.cos(i * 2.7) * 12, angle: Math.sin(i * 8.3) * 0.8, vx: 0, vy: 0, spin: 0, layer: i };
    containCard(table, card); return card;
  });
  return table;
}

/** A palm acts only along its travelled path, so untouched cards stay where they were. */
export function pushShuffleCards(table: ShuffleTable, fromX: number, fromY: number, toX: number, toY: number): number {
  const length = Math.hypot(toX - fromX, toY - fromY);
  if (!length) return 0;
  const steps = Math.ceil(length / 12); const dx = (toX - fromX) / steps; const dy = (toY - fromY) / steps;
  const radius = table.cardWidth * 1.25; let contact = 0;
  for (let step = 1; step <= steps; step++) {
    const x = fromX + dx * step; const y = fromY + dy * step;
    let touched = false;
    for (const card of table.cards) {
      const ox = card.x - x; const oy = card.y - y; const gap = Math.hypot(ox, oy);
      if (gap >= radius) continue;
      touched = true;
      const weight = (1 - gap / radius) * (0.55 + (card.layer % 7) * 0.065);
      card.x += dx * weight * 1.3 + ox * weight * 0.035;
      card.y += dy * weight * 1.3 + oy * weight * 0.035;
      card.vx = clamp(card.vx + dx * weight * 0.16, -7, 7);
      card.vy = clamp(card.vy + dy * weight * 0.16, -7, 7);
      const torque = clamp((ox * dy - oy * dx) / (radius * radius), -0.07, 0.07) * weight;
      card.angle += torque * 2.4; card.spin = clamp(card.spin + torque * 0.12, -0.035, 0.035);
      containCard(table, card);
    }
    if (touched) contact += length / steps;
  }
  // Lift only the card nearest the finishing palm, rather than moving the entire pile as one layer.
  const top = table.cards.reduce((best, card) => Math.hypot(card.x - toX, card.y - toY) < Math.hypot(best.x - toX, best.y - toY) ? card : best);
  if (Math.hypot(top.x - toX, top.y - toY) < radius) top.layer = ++table.layer;
  return contact;
}

export function settleShuffleCards(table: ShuffleTable, frames: number, reducedMotion = false): boolean {
  let moving = false;
  const damping = reducedMotion ? 0 : Math.pow(0.8, frames);
  // Permit natural overlaps, but let a moving card gently nudge a neighbour instead of passing through it.
  for (let i = 0; i < table.cards.length; i++) for (let j = i + 1; j < table.cards.length; j++) {
    const a = table.cards[i]; const b = table.cards[j];
    if (Math.abs(a.vx) + Math.abs(a.vy) + Math.abs(b.vx) + Math.abs(b.vy) < 0.2) continue;
    const dx = b.x - a.x; const dy = b.y - a.y; const gap = Math.hypot(dx, dy);
    const minimum = table.cardWidth * 0.42;
    if (gap >= minimum || gap < 0.01) continue;
    const force = (minimum - gap) * 0.025 * Math.min(frames, 2);
    a.vx -= dx / gap * force; a.vy -= dy / gap * force;
    b.vx += dx / gap * force; b.vy += dy / gap * force;
  }
  for (const card of table.cards) {
    card.x += card.vx * frames; card.y += card.vy * frames; card.angle += card.spin * frames;
    card.vx *= damping; card.vy *= damping; card.spin *= damping;
    containCard(table, card);
    if (Math.abs(card.vx) + Math.abs(card.vy) + Math.abs(card.spin) > 0.06) moving = true;
    else { card.vx = 0; card.vy = 0; card.spin = 0; }
  }
  return moving;
}
