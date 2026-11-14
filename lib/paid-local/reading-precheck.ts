import { LocalPaidError } from "./guard";
import { readingReviewCategories } from "./reading-review-prompt";
import { readingSafetyMessage, type ReadingSafetyCode } from "./reading-safety";
import type { PaidProject, PaidReading } from "./types";

const immediateDanger = [
  /不想活|想自杀|想轻生|想自残|正在自残|想结束自己的生命|kill myself|hurt myself/i,
  /(?:正在|现在|眼下|此刻|已经在|门外).{0,26}(?:砸门|破门|持刀|持枪|威胁.{0,6}(?:杀|伤害)|掐我|打我)/,
  /无法呼吸|昏迷不醒|大出血|(?:刚|已经).{0,12}(?:服药过量|吞下.{0,8}(?:毒药|大量药物))/,
];

const previewUnsupported = [
  /停药|(?:自行|自己).{0,8}(?:减药|减半|换药)|该不该.{0,10}(?:吃药|手术)|(?:是不是|是否|会不会).{0,12}(?:怀孕|得了|癌症)/,
  /(?:签|协议|合同).{0,20}(?:索赔|赔偿|违约|该不该签|要不要签)|(?:官司|起诉|法院|抚养权).{0,16}(?:赢|判|拿到)/,
  /投资|炒股|炒币|(?:股票|基金|黄金).{0,12}(?:买|卖|涨|跌)|(?:押|赌).{0,8}(?:哪边|哪队)/,
  /(?:中国|国内).{0,16}(?:政治人物|政治事件|国家领导|领导人|领导层|政策走向|政治立场)/,
  /(?:是否|有没有|是不是|会不会|有没|到底有没)\s*出轨|出轨\s*(?:了\s*)?(?:没有|了吗|吗|没|不)\s*[？?。！!]*$/,
  /(?:家暴|失踪|失联).{0,16}(?:安全|下落|在哪)|(?:我|他|她|家人).{0,8}(?:哪天|何时|什么时候).{0,5}(?:会死|去世)/,
];

function reviewUnavailable() {
  return new LocalPaidError("READING_REVIEW_UNAVAILABLE", "这次暂时没能完成问题审查。未使用花瓣或追问次数，请稍后再试。", 503);
}

type ProjectContext = Pick<PaidProject, "background" | "memorySummary"> | undefined;
export type ReadingReviewInput = Pick<PaidReading, "question" | "choices" | "spread" | "followUps">;
type ReviewRequest = (input: string) => Promise<Record<string, unknown>>;

export function throwReadingBlocked(code: ReadingSafetyCode, followUp = false): never {
  throw new LocalPaidError(code, readingSafetyMessage(code, followUp), 422);
}

export async function precheckReading(reading: ReadingReviewInput, project: ProjectContext, followUp: string | undefined, requestReview?: ReviewRequest): Promise<ReadingSafetyCode | null> {
  const question = followUp ?? reading.question;
  const current = [question, ...(!followUp ? reading.choices ?? [] : [])];
  const priorQuestions = reading.followUps.map(item => item.question);
  const context = [reading.question, ...(reading.choices ?? []), ...priorQuestions, project?.background ?? "", project?.memorySummary ?? ""];
  const matches = (fields: string[], rules: RegExp[]) => fields.some(field => rules.some(rule => rule.test(field.normalize("NFKC"))));
  if (matches(current, immediateDanger)) return "READING_IMMEDIATE_DANGER";

  if (!requestReview) {
    // Deterministic responses used only by the loopback mock preview.
    return matches(followUp ? [...current, ...context] : current, previewUnsupported) ? "READING_TOPIC_UNSUPPORTED" : null;
  }

  const input = JSON.stringify({
    question: reading.question,
    choices: reading.choices ?? [],
    followUp,
    priorQuestions: followUp ? priorQuestions : undefined,
    background: project?.background,
    memorySummary: project?.memorySummary,
  });
  const result = await requestReview(input).catch(() => { throw reviewUnavailable(); });
  if (result.decision === "allow" && result.category === "none") return null;
  if (result.decision === "block" && typeof result.category === "string" && readingReviewCategories.includes(result.category)) {
    return result.category === "urgent_safety" ? "READING_IMMEDIATE_DANGER" : "READING_TOPIC_UNSUPPORTED";
  }
  if (result.decision === "clarify" && result.category === "none") return "READING_TOPIC_UNSUPPORTED";
  throw reviewUnavailable();
}
