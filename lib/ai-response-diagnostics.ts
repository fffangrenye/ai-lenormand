export type DeepSeekPayload = {
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      content?: unknown;
      reasoning_content?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  usage?: {
    completion_tokens_details?: {
      reasoning_tokens?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function getLength(value: unknown) {
  return typeof value === "string" ? value.length : null;
}

function getLineCount(value: unknown) {
  return typeof value === "string" && value.length ? value.split(/\r\n|\r|\n/).length : null;
}

function includesText(value: unknown, pattern: RegExp) {
  return typeof value === "string" ? pattern.test(value) : false;
}

function detectLabels(value: unknown) {
  if (typeof value !== "string") return [];

  const labels: string[] = [];
  const checks: Array<[string, RegExp]> = [
    ["core_conclusion", /core[_\s-]?conclusion|核心结论/i],
    ["interpretation", /interpretation|analysis|组合解读|解读/i],
    ["time_window", /time[_\s-]?window|时间/i],
    ["uncertainty", /uncertainty|caveat|boundary|边界|不确定/i],
    ["answer", /answer|reply|response|回答|回复/i]
  ];

  checks.forEach(([label, pattern]) => {
    if (pattern.test(value)) labels.push(label);
  });

  return labels;
}

export function buildAiResponseDiagnostics(payload: DeepSeekPayload) {
  const choice = payload.choices?.[0];
  const message = choice?.message;
  const content = message?.content;
  const reasoningContent = message?.reasoning_content;

  return {
    payload_keys: Object.keys(payload),
    choice_keys: choice ? Object.keys(choice) : [],
    message_keys: message ? Object.keys(message) : [],
    finish_reason: choice?.finish_reason ?? null,
    content_type: content === null ? "null" : typeof content,
    content_length: getLength(content),
    reasoning_content_type: reasoningContent === null ? "null" : typeof reasoningContent,
    reasoning_content_length: getLength(reasoningContent),
    has_json_object_markers: includesText(content, /\{[\s\S]*\}/),
    has_code_fence: includesText(content, /```/),
    line_count: getLineCount(content),
    detected_labels: detectLabels(content),
    reasoning_tokens: payload.usage?.completion_tokens_details?.reasoning_tokens ?? null
  };
}
