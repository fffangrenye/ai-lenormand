export class InvalidAiResponseError extends Error {
  constructor(message = "AI response did not contain valid JSON.") {
    super(message);
    this.name = "InvalidAiResponseError";
  }
}

function stripCodeFence(value: string) {
  const trimmed = value.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function removeJsonTrailingCommas(value: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ",") {
      let cursor = index + 1;
      while (cursor < value.length && /\s/.test(value[cursor])) cursor += 1;
      if (value[cursor] === "}" || value[cursor] === "]") continue;
    }

    result += char;
  }

  return result;
}

export function extractJsonObjectText(value: string) {
  const text = stripCodeFence(value);
  const start = text.indexOf("{");
  if (start === -1) throw new InvalidAiResponseError();

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  throw new InvalidAiResponseError();
}

export function parseAiJsonObject(value: string) {
  const jsonText = extractJsonObjectText(value);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    try {
      return JSON.parse(removeJsonTrailingCommas(jsonText));
    } catch {
      if (error instanceof InvalidAiResponseError) throw error;
      throw new InvalidAiResponseError("AI response JSON could not be parsed.");
    }
  }
}
