export const readingSafetyNotices = {
  READING_TOPIC_UNSUPPORTED: {
    title: "这次先不解读",
    message: "这个问题超出了 Flora 社区规范允许的解读范围。你可以换个更贴近日常感受或自我探索的问题。",
  },
  READING_IMMEDIATE_DANGER: {
    title: "请先照顾好自己的安全",
    message: "这类情况超出了 Flora 社区规范允许的解读范围。如果你或他人正面临危险，请立即联系当地紧急服务，并尽可能向可信任的人求助。",
  },
} as const;

export type ReadingSafetyCode = keyof typeof readingSafetyNotices;

export function isReadingSafetyCode(code: unknown): code is ReadingSafetyCode {
  return code === "READING_TOPIC_UNSUPPORTED" || code === "READING_IMMEDIATE_DANGER";
}

export function readingSafetyMessage(code: ReadingSafetyCode, followUp = false) {
  const quotaNotice = followUp ? "本次未消耗追问次数，也不会留下这条追问。" : "本次未扣花瓣，也不会留下这条记录。";
  return `${readingSafetyNotices[code].message} ${quotaNotice}`;
}
