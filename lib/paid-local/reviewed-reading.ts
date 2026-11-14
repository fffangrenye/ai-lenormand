import type { PaidLedger } from "./ledger";
import { LocalPaidError } from "./guard";
import { throwReadingBlocked, type ReadingReviewInput } from "./reading-precheck";
import type { ReadingSafetyCode } from "./reading-safety";
import { readingReviewFingerprint, reviewNewDraw, validateDrawQuestion, type DrawQuestion, type ReadingReviewContext } from "./reviewed-draw";

export type ReadingReview = (reading: ReadingReviewInput, project?: ReadingReviewContext, followUp?: string) => Promise<ReadingSafetyCode | null>;

export async function startReviewedDraw(store: PaidLedger, userId: string, input: DrawQuestion & { projectId: string; requestKey: string }, review: ReadingReview) {
  const question = validateDrawQuestion(input);
  const current = store.drawForReview(userId, { ...input, ...question });
  if (current.previous) return current.previous;
  const key = readingReviewFingerprint(question, current.project);
  return store.shareReadingReview(`draw:${userId}:${input.projectId}:${input.requestKey}:${key}`, async () => {
    store.limitNewDrawReview(userId);
    const reviewedContext = await reviewNewDraw(question, review, current.project);
    if (readingReviewFingerprint(question, store.project(userId, input.projectId)) !== reviewedContext) {
      throw new LocalPaidError("READING_CONTEXT_CHANGED", "项目背景刚有更新，请重新开始这次提问。", 409);
    }
    return store.startDrawSession(userId, { ...input, ...question }, reviewedContext);
  });
}

export async function reserveReviewedReading(store: PaidLedger, userId: string, readingId: string, review: ReadingReview) {
  store.recoverExpired(userId);
  const reading = store.reading(userId, readingId);
  if (reading.state === "completed" || reading.state === "generating") {
    return { reserved: { runId: null, reading }, project: undefined };
  }
  const project = await store.shareReadingReview(`main:${userId}:${readingId}`, async () => {
    const project = reading.projectId ? store.project(userId, reading.projectId) : undefined;
    if (store.matchesReadingReview(userId, readingId, readingReviewFingerprint(reading, project))) return project;
    const blocked = await review(reading, project);
    store.checkReadingReviewProject(userId, readingId, project);
    if (blocked) {
      store.discardBlockedReading(userId, readingId);
      throwReadingBlocked(blocked);
    }
    return project;
  });
  return { reserved: store.reserveReading(userId, readingId), project };
}

export async function reserveReviewedFollowUp(store: PaidLedger, userId: string, readingId: string, question: string, key: string, review: ReadingReview) {
  const candidate = store.followUpForReview(userId, readingId, question, key);
  if (candidate.active) return { reserved: { attempt: null, reading: candidate.reading }, project: undefined };
  const project = await store.shareReadingReview(`follow:${userId}:${readingId}:${key}:${question.trim()}`, async () => {
    const reading = candidate.reading;
    const project = reading.projectId ? store.project(userId, reading.projectId) : undefined;
    const blocked = await review(reading, project, question.trim());
    store.checkReadingReviewProject(userId, readingId, project);
    if (blocked) {
      store.discardRejectedFollowUp(userId, readingId, key, question.trim());
      throwReadingBlocked(blocked, true);
    }
    return project;
  });
  return { reserved: store.reserveFollowUp(userId, readingId, question, key), project };
}
