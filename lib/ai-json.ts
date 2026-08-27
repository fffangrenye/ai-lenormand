function normalizeJsonText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function removeTrailingCommas(text: string) {
  return text.replace(/,\s*([}\]])/g, "$1").trim();
}

function tryParse(candidate: string): unknown | undefined {
  for (const attempt of [candidate, removeTrailingCommas(candidate)]) {
    try {
      const parsed = JSON.parse(attempt);
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed);
        } catch {
          return parsed;
        }
      }
      return parsed;
    } catch {
      // Try the next conservative repair.
    }
  }
  return undefined;
}

function extractBalancedObjectFrom(text: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

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
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
      if (depth < 0) return null;
    }
  }

  return null;
}

function extractJsonCandidates(text: string) {
  const candidates: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "{") continue;
    const candidate = extractBalancedObjectFrom(text, i);
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

function looksLikeReadingObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return [
    "core_conclusion",
    "coreConclusion",
    "conclusion",
    "summary",
    "interpretation",
    "analysis",
    "reading",
    "answer",
    "response"
  ].some((key) => typeof record[key] === "string" && record[key]!.trim());
}

export function extractJsonObject(content: string) {
  const normalized = normalizeJsonText(content);

  const direct = tryParse(normalized);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }

  // Parse every balanced object independently. This intentionally handles a
  // malformed prefix followed by a complete valid JSON object, e.g.
  // `{ "core_conclusion": "...` + a second complete JSON object.
  const parsedCandidates = extractJsonCandidates(normalized)
    .map((candidate) => tryParse(candidate))
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value));

  const readingCandidate = parsedCandidates.find(looksLikeReadingObject);
  if (readingCandidate) return readingCandidate;

  if (parsedCandidates[0]) return parsedCandidates[0];

  // Do not surface arbitrary malformed prose/JSON fragments to the user. A
  // response that cannot be parsed safely must fail and use the normal AI
  // unavailable UI instead of exposing schema labels such as core_conclusion.
  throw new Error("DeepSeek final content did not contain a safely parseable JSON object.");
}
