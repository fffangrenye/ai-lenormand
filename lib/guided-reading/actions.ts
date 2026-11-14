import { isLocalPaidError, LocalPaidError } from "../paid-local/guard";
import { throwReadingBlocked } from "../paid-local/reading-precheck";
import type { ReadingReview } from "../paid-local/reviewed-reading";
import { guidedCardCount } from "./details";
import type { GuidedPreviewStore } from "./preview";

const requestKey = /^[a-f0-9-]{36}$/i;

export async function guidedAction(
  guided: GuidedPreviewStore, owner: string, action: string, input: Record<string, unknown>,
  review: ReadingReview, limit: () => void, share: <T>(key: string, task: () => Promise<T>) => Promise<T>,
) {
  const field = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const id = field("id");
  if (action === "guided/advance") {
    try {
      return await guided.advance(owner, id);
    } catch (error) {
      if (isLocalPaidError(error) && error.code.startsWith("AI_")) {
        const saved = guided.open(owner, id);
        if (saved.petalPrice > 0 && saved.cards.length > 0) {
          throw new LocalPaidError(error.code, "这一步的 AI 暂时没有完成。已抽的牌已保存，重试不会再扣花瓣。", error.status);
        }
      }
      throw error;
    }
  }
  if (action === "guided/start") {
    const key = field("requestId");
    const question = field("question");
    const focus = field("focus");
    if (!requestKey.test(key)) throw new LocalPaidError("INVALID_REQUEST_KEY", "本次操作标识无效，请重试。");
    if (!question || question.length > 300 || focus.length > 200) throw new LocalPaidError("INVALID_QUESTION", "请填写 1–300 字，补充背景最多 200 字。");
    return share(JSON.stringify(["guided/start", owner, key, question, focus]), async () => {
      const started = guided.started(owner, question, focus, key);
      if (started) return started;
      guided.checkStartBalance(owner);
      limit();
      const blocked = await review({ question, choices: [], spread: "nine_grid", followUps: [] }, { background: focus, memorySummary: "" });
      if (blocked) throwReadingBlocked(blocked);
      return guided.start(owner, question, focus, key);
    });
  }
  if (action === "guided/draw") {
    const { step, custom } = input;
    const question = field("question");
    const planId = field("planId");
    if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step >= guidedCardCount) throw new LocalPaidError("INVALID_STEP", "抽牌进度无效，请刷新后继续。");
    if (!requestKey.test(planId)) throw new LocalPaidError("DRAW_CHANGED", "推荐已变化，请重新读取抽牌进度。", 409);
    if (!question || question.length > 200 || typeof custom !== "boolean") throw new LocalPaidError("INVALID_GUIDED_FOCUS", "请先选择或填写想看的问题，最多 200 字。");
    if (custom) {
      return share(JSON.stringify(["guided/draw", owner, id, step, planId, question]), async () => {
        const session = guided.open(owner, id);
        if (session.cards.length === step && session.plan?.id === planId) {
          const blocked = await review({ question: session.question, choices: [], spread: "nine_grid", followUps: [] }, { background: session.focus, memorySummary: "" }, question);
          if (blocked) throwReadingBlocked(blocked, true);
        }
        return guided.draw(owner, id, step, question, custom, planId);
      });
    }
    return guided.draw(owner, id, step, question, custom, planId);
  }
  throw new LocalPaidError("NOT_FOUND", "接口不存在。", 404);
}
