const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const scanRoots = [".open-next", ".next"].map((item) => path.join(root, item));

const publicValueNames = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DEEPSEEK_MODEL",
  "RULE_ENGINE_ENABLED",
  "RULE_ENGINE_DEFAULT",
  "RULE_ENGINE_ALLOW_EXPLICIT",
  "RULE_ENGINE_ROLLOUT_PERCENT",
]);

const secretLikePatterns = [
  { id: "sb_secret", regex: /sb_secret_[A-Za-z0-9_-]+/g },
  { id: "sk_token", regex: /sk-[A-Za-z0-9_-]{16,}/g },
  { id: "private_key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: "cloudflare_token_name", regex: /\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\b/g },
  { id: "vercel_oidc_name", regex: /\bVERCEL_OIDC_TOKEN\b/g },
];

const processSensitiveNames = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) result[match[1]] = value;
  }
  return result;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function isClientArtifact(filePath) {
  const rel = relative(filePath);
  return (
    rel.includes("/assets/") ||
    rel.includes("/static/") ||
    rel.endsWith(".html") ||
    rel.endsWith(".css") ||
    rel.endsWith(".map")
  );
}

const envVars = parseEnvFile(envPath);
for (const name of processSensitiveNames) {
  if (process.env[name] && process.env[name].length >= 8) {
    envVars[name] = process.env[name];
  }
}
const files = scanRoots.flatMap(walk);
const nameHits = [];
const sensitiveValueHits = [];
const publicValueHits = [];
const clientSensitiveValueHits = [];
const patternHits = [];

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const [name, value] of Object.entries(envVars)) {
    if (text.includes(name)) {
      nameHits.push({ name, file: relative(file) });
    }
    if (value.length >= 8 && text.includes(value)) {
      const hit = { name, file: relative(file) };
      if (publicValueNames.has(name)) {
        publicValueHits.push(hit);
      } else {
        sensitiveValueHits.push(hit);
        if (isClientArtifact(file)) clientSensitiveValueHits.push(hit);
      }
    }
  }

  for (const pattern of secretLikePatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) {
      patternHits.push({ pattern: pattern.id, file: relative(file) });
    }
  }
}

function printHits(label, hits, fields) {
  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    const key = fields.map((field) => hit[field]).join("\t");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(hit);
    }
  }
  if (unique.length === 0) {
    console.log(`${label}: PASS count=0`);
    return;
  }
  console.log(`${label}: count=${unique.length}`);
  for (const hit of unique) {
    console.log(`  ${fields.map((field) => `${field}=${hit[field]}`).join(" ")}`);
  }
}

printHits("VARIABLE_NAME_SCAN", nameHits, ["name", "file"]);
printHits("PUBLIC_VALUE_SCAN", publicValueHits, ["name", "file"]);
printHits("SENSITIVE_VALUE_SCAN", sensitiveValueHits, ["name", "file"]);
printHits("CLIENT_SENSITIVE_VALUE_SCAN", clientSensitiveValueHits, ["name", "file"]);
printHits("SECRET_PATTERN_REVIEW_SCAN", patternHits, ["pattern", "file"]);

if (sensitiveValueHits.length > 0 || clientSensitiveValueHits.length > 0) {
  process.exit(1);
}
