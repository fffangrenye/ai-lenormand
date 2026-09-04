export const ruleEngineErrorCodes = [
  "QUESTION_PARSE_FAILED",
  "INVALID_SPREAD_SIZE",
  "INVALID_CARD_IDS",
  "PRESELECTION_FAILED",
  "PAIR_RESOLUTION_FAILED",
  "FINAL_RESOLUTION_FAILED",
  "SPREAD_FAILED",
  "SYNTHESIS_FAILED",
  "TEMPO_FAILED",
  "ANSWER_FAILED",
  "RENDER_FAILED"
] as const;

export type RuleEngineErrorCode = (typeof ruleEngineErrorCodes)[number];

export class RuleEngineError extends Error {
  code: RuleEngineErrorCode;
  detail?: unknown;

  constructor(code: RuleEngineErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "RuleEngineError";
    this.code = code;
    this.detail = detail;
  }
}
