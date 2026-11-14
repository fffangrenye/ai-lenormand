import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isDeepSpread, getDeepSpread } from "../deep-spreads";
import { LocalPaidError } from "./guard";
import { throwReadingBlocked } from "./reading-precheck";
import type { ReadingReview } from "./reviewed-reading";
import type { PaidProject, PaidSpread } from "./types";

export type DrawQuestion = { question: string; spread: PaidSpread; choices?: string[] };
export type ReadingReviewContext = Pick<PaidProject, "background" | "memorySummary">;

export function validateDrawQuestion(input: DrawQuestion) {
  const question = input.question.trim();
  if (!question || question.length > 300 || !isDeepSpread(input.spread)) {
    throw new LocalPaidError("INVALID_QUESTION", "请填写 1–300 字的问题并选择牌阵。");
  }
  const size = getDeepSpread(input.spread).choiceCount || 0;
  const choices = size ? (input.choices ?? []).map(value => value.trim()) : [];
  if (choices.length !== size || choices.some(value => !value || value.length > 80) || new Set(choices.map(value => value.toLowerCase())).size !== size) {
    throw new LocalPaidError("INVALID_CHOICES", `请填写 ${size} 个不同的具体选项，每项不超过 80 字。`);
  }
  return { question, spread: input.spread, choices };
}

export function readingReviewFingerprint(input: DrawQuestion, project?: ReadingReviewContext) {
  return createHash("sha256").update(JSON.stringify(["flora-review-v1", input.question, input.spread, input.choices ?? [], project?.background ?? "", project?.memorySummary ?? ""])).digest("hex");
}

export async function reviewNewDraw(input: DrawQuestion, review: ReadingReview, project?: ReadingReviewContext) {
  const blocked = await review({ ...input, followUps: [] }, project);
  if (blocked) throwReadingBlocked(blocked);
  return readingReviewFingerprint(input, project);
}

export async function issueGuestReview(input: DrawQuestion, key: string | Buffer, review: ReadingReview) {
  const fingerprint = await reviewNewDraw(validateDrawQuestion(input), review);
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  return { approval: `${expires}.${guestSignature(key, expires, fingerprint).toString("hex")}` };
}

function guestSignature(key: string | Buffer, expires: number, fingerprint: string) {
  return createHmac("sha256", key).update(`flora-guest-review-v1:${expires}:${fingerprint}`).digest();
}

export function getGuestReview(input: DrawQuestion, approval: string, key: string | Buffer) {
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(approval);
  if (!match || Number(match[1]) <= Date.now()) {
    throw new LocalPaidError("GUEST_REVIEW_EXPIRED", "这次提问的审查已过期，请返回并重新开始。", 409);
  }
  const fingerprint = readingReviewFingerprint(validateDrawQuestion(input));
  if (!timingSafeEqual(guestSignature(key, Number(match[1]), fingerprint), Buffer.from(match[2], "hex"))) {
    throw new LocalPaidError("GUEST_REVIEW_EXPIRED", "这次提问已变化，请返回并重新开始。", 409);
  }
  return fingerprint;
}
