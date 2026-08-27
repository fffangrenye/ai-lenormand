type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, "[phone]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[key]")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabels(content: string) {
  const labels = new Set<string>();
  const regex = /(?:^|[\n,{])\s*["“”']?([A-Za-z_][A-Za-z0-9_]{1,40}|[\u4e00-\u9fff]{2,12})["“”']?\s*[:：]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) && labels.size < 12) {
    labels.add(match[1]);
  }

  return Array.from(labels);
}

export function buildAiResponseDiagnostic(payload: unknown, content?: string | null) {
  const root = isRecord(payload) ? payload : {};
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(choice.message) ? choice.message : {};
  const rawContent = typeof content === "string" ? content : "";
  const trimmed = rawContent.trim();
  const redactedPreview = redactSensitiveText(trimmed).slice(0, 180);

  return {
    payload_keys: Object.keys(root).slice(0, 20),
    choice_keys: Object.keys(choice).slice(0, 20),
    message_keys: Object.keys(message).slice(0, 20),
    finish_reason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
    content_type: typeof message.content,
    content_length: typeof message.content === "string" ? message.content.length : null,
    reasoning_content_type: typeof message.reasoning_content,
    reasoning_content_length: typeof message.reasoning_content === "string" ? message.reasoning_content.length : null,
    first_char: trimmed.slice(0, 1) || null,
    starts_with_code_fence: /^```/.test(trimmed),
    has_object_braces: trimmed.includes("{") && trimmed.includes("}"),
    line_count: trimmed ? trimmed.split(/\r?\n/).length : 0,
    detected_labels: extractLabels(trimmed),
    redacted_preview: redactedPreview || null
  };
}
