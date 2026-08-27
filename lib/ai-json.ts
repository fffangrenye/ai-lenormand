function normalizeJsonText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function repairCommonJsonIssues(text: string) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function tryParse(candidate: string): unknown | undefined {
  const attempts = [candidate, repairCommonJsonIssues(candidate)];

  for (const attempt of attempts) {
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
      // Try the next local repair before giving up.
    }
  }

  return undefined;
}

function extractBalancedObjects(text: string) {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
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

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

export function extractJsonObject(content: string) {
  const normalized = normalizeJsonText(content);

  const direct = tryParse(normalized);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }

  for (const candidate of extractBalancedObjects(normalized)) {
    const parsed = tryParse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  }

  throw new Error("DeepSeek response did not contain parseable JSON after local repair.");
}
