import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { lenormandCards } from "../lenormand-cards";
import { LocalPaidError } from "../paid-local/guard";
import { coreCardMeaningsZh } from "../paid-local/reading-guidance";
import { guidedCardCount, guidedPetalPrice, guidedPlanVersion, type GuidedSession } from "./details";
import { interpretGuidedRound, planNextCard, summarizeGuidedReading, type GuidedJsonRequest } from "./model";

export const guidedSchema = `
  CREATE TABLE IF NOT EXISTS guided_preview_sessions (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_id TEXT NOT NULL,
    payload TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner, request_id)
  );
  CREATE INDEX IF NOT EXISTS guided_preview_history ON guided_preview_sessions(owner, updated_at DESC);
`;

type SavedSession = GuidedSession & { deck: number[]; initialFocus?: string; previousSuggestions?: string[][] };
const name = (card: number) => lenormandCards[card - 1].nameZh;

function stageText(session: GuidedSession) {
  const card = session.cards.at(-1)!;
  const question = session.rounds.at(-1)?.question || session.question;
  return `回到「${question}」，这张是${name(card)}。它让我们留意${coreCardMeaningsZh[card]}，可以把这一点和自己已经观察到的情况对照看看。`;
}

function mockSummary(session: GuidedSession) {
  const topics = session.rounds.flatMap(round => round.question ? [`「${round.question}」`] : []);
  return `我们从${topics.length ? topics.join("、") : "九个观察角度"}回看「${session.question}」。可以把多次出现的线索放在一起，想想其中哪一项最贴近你实际遇到的情况。`;
}

function decode(payload: unknown): SavedSession {
  const session = JSON.parse(String(payload)) as SavedSession;
  session.petalPrice ??= 0;
  // Sessions saved before per-card questions already have their revealed cards.
  session.rounds ??= session.cards.map((_, index) => ({
    question: "",
    interpretation: session.messages.find(message => message.role === "assistant" && message.step === index + 1)?.text ?? null,
  }));
  // Keep drawn cards while letting the user resume with the current recommendation rules.
  if (!session.plan?.groups || session.plan.version !== guidedPlanVersion) session.plan = null;
  return session;
}

export class GuidedPreviewStore {
  private readonly inProgress = new Map<string, Promise<GuidedSession>>();

  constructor(
    private readonly db: DatabaseSync,
    private readonly transaction: <T>(work: () => T) => T,
    private readonly ensureCredits: (owner: string, price: number) => void,
    private readonly debitCredits: (owner: string, id: string, price: number) => void,
    private readonly request?: GuidedJsonRequest,
  ) {}

  private publicSession(session: SavedSession): GuidedSession {
    const { deck: _deck, initialFocus: _initialFocus, previousSuggestions: _previousSuggestions, ...visible } = session;
    return visible;
  }

  history(owner: string) {
    const rows = this.db.prepare("SELECT payload FROM guided_preview_sessions WHERE owner=? ORDER BY updated_at DESC LIMIT 20").all(owner);
    return rows.map(row => {
      const { id, question, cards, final, updatedAt } = JSON.parse(String(row.payload)) as SavedSession;
      return { id, question, step: cards.length, complete: Boolean(final), updatedAt };
    });
  }

  private read(owner: string, id: string): SavedSession {
    const row = this.db.prepare("SELECT payload FROM guided_preview_sessions WHERE owner=? AND id=?").get(owner, id);
    if (!row) throw new LocalPaidError("NOT_FOUND", "找不到这次洋葱解牌。", 404);
    return decode(row.payload);
  }

  open(owner: string, id: string) {
    return this.publicSession(this.read(owner, id));
  }

  started(owner: string, question: string, focus: string, requestId: string) {
    const prior = this.db.prepare("SELECT payload FROM guided_preview_sessions WHERE owner=? AND request_id=?").get(owner, requestId);
    if (prior) {
      const saved = decode(prior.payload);
      if (saved.question !== question || (saved.initialFocus !== undefined && saved.initialFocus !== focus)) {
        throw new LocalPaidError("REQUEST_CONFLICT", "这次请求已用于另一个问题或背景。", 409);
      }
      return this.publicSession(saved);
    }
    return null;
  }

  checkStartBalance(owner: string) {
    this.ensureCredits(owner, guidedPetalPrice.test);
  }

  start(owner: string, question: string, focus: string, requestId: string) {
    const saved = this.started(owner, question, focus, requestId);
    if (saved) return saved;
    this.checkStartBalance(owner);
    const pool = lenormandCards.map(card => card.number);
    const deck = Array.from({ length: guidedCardCount }, () => pool.splice(randomInt(pool.length), 1)[0]);
    const session: SavedSession = { id: randomUUID(), question, focus, petalPrice: guidedPetalPrice.test, initialFocus: focus, deck, cards: [], messages: [], rounds: [], plan: null, final: null, updatedAt: new Date().toISOString() };
    this.db.prepare("INSERT INTO guided_preview_sessions VALUES (?, ?, ?, ?, ?)").run(session.id, owner, requestId, JSON.stringify(session), session.updatedAt);
    return this.publicSession(session);
  }

  draw(owner: string, id: string, expectedStep: number, question: string, custom: boolean, planId: string) {
    return this.transaction(() => {
      const session = this.read(owner, id);
      if (expectedStep < session.cards.length) {
        if (session.rounds[expectedStep].question !== question) {
          throw new LocalPaidError("DRAW_CHANGED", "这张牌已经翻开，请读取最新进度。", 409);
        }
      } else {
        if (expectedStep !== session.cards.length || session.final || session.plan?.id !== planId || expectedStep >= guidedCardCount) {
          throw new LocalPaidError("DRAW_CHANGED", "这一张还不能抽，请读取最新进度。", 409);
        }
        if (!custom && !session.plan.groups.some(group => group.includes(question))) {
          throw new LocalPaidError("INVALID_GUIDED_FOCUS", "请选择当前推荐的问题，或输入自己的问题。", 400);
        }
        if (expectedStep === 0 && session.petalPrice > 0) this.debitCredits(owner, id, session.petalPrice);
        session.cards.push(session.deck[expectedStep]);
        session.rounds.push({ question, interpretation: null });
        session.previousSuggestions = [...(session.previousSuggestions ?? []), session.plan.groups.flat()].slice(-2);
        session.plan = null;
        this.write(owner, session);
      }
      return this.publicSession(session);
    });
  }

  async advance(owner: string, id: string) {
    const session = this.read(owner, id);
    if (session.final || session.plan) return this.publicSession(session);
    const running = this.inProgress.get(session.id);
    if (running) return running;
    const task = this.generatePending(owner, session);
    this.inProgress.set(session.id, task);
    try {
      return await task;
    } finally {
      this.inProgress.delete(session.id);
    }
  }

  private async generatePending(owner: string, session: SavedSession) {
    const round = session.rounds.at(-1);
    if (round && !round.interpretation) {
      round.interpretation = this.request ? await interpretGuidedRound(session, this.request) : stageText(session);
      this.write(owner, session);
      return this.publicSession(session);
    }
    if (session.cards.length === guidedCardCount) {
      session.final = this.request ? await summarizeGuidedReading(session, this.request) : mockSummary(session);
    } else {
      session.plan = await planNextCard(session, this.request, session.previousSuggestions?.flat());
    }
    this.write(owner, session);
    return this.publicSession(session);
  }

  private write(owner: string, session: SavedSession) {
    session.updatedAt = new Date().toISOString();
    this.db.prepare("UPDATE guided_preview_sessions SET payload=?, updated_at=? WHERE owner=? AND id=?")
      .run(JSON.stringify(session), session.updatedAt, owner, session.id);
  }
}
