const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const holdPath = path.join(root, ".env.local.codex-build-hold");
const lockPath = path.join(root, ".codex-secure-cf-build.lock");
const generatedDirs = [".next", ".open-next"];

const allowedBuildEnv = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DEEPSEEK_MODEL",
  "RULE_ENGINE_ENABLED",
  "RULE_ENGINE_DEFAULT",
  "RULE_ENGINE_ALLOW_EXPLICIT",
  "RULE_ENGINE_ROLLOUT_PERCENT",
]);

const forbiddenBuildEnv = [
  "DEEPSEEK_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_OIDC_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CF_API_TOKEN",
  "ADMIN_EMAILS",
];

const requiredHostEnv = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "PROCESSOR_ARCHITECTURE",
  "NUMBER_OF_PROCESSORS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
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
    result[match[1]] = value;
  }
  return result;
}

function assertInsideRoot(targetPath) {
  const resolvedRoot = fs.realpathSync(root);
  const resolvedTarget = fs.existsSync(targetPath)
    ? fs.realpathSync(targetPath)
    : path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Refusing to touch path outside workspace: ${targetPath}`);
  }
}

function removeGeneratedDirs() {
  for (const dir of generatedDirs) {
    const target = path.join(root, dir);
    if (!fs.existsSync(target)) continue;
    assertInsideRoot(target);
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

if (fs.existsSync(holdPath)) {
  throw new Error("Refusing to build: .env.local.codex-build-hold already exists.");
}

let lockHandle;
try {
  lockHandle = fs.openSync(lockPath, "wx");
} catch {
  throw new Error("Refusing to build: another secure Cloudflare build appears to be running.");
}

const localEnv = parseEnvFile(envPath);
const buildEnv = {};

for (const name of requiredHostEnv) {
  if (process.env[name]) buildEnv[name] = process.env[name];
}

for (const name of allowedBuildEnv) {
  if (localEnv[name]) buildEnv[name] = localEnv[name];
}

buildEnv.DEEPSEEK_MODEL = buildEnv.DEEPSEEK_MODEL || "deepseek-v4-flash";
buildEnv.RULE_ENGINE_ENABLED = buildEnv.RULE_ENGINE_ENABLED || "true";
buildEnv.RULE_ENGINE_DEFAULT = buildEnv.RULE_ENGINE_DEFAULT || "false";
buildEnv.RULE_ENGINE_ALLOW_EXPLICIT = buildEnv.RULE_ENGINE_ALLOW_EXPLICIT || "true";
buildEnv.RULE_ENGINE_ROLLOUT_PERCENT = buildEnv.RULE_ENGINE_ROLLOUT_PERCENT || "0";

removeGeneratedDirs();

let movedEnv = false;
try {
  if (fs.existsSync(envPath)) {
    assertInsideRoot(envPath);
    fs.renameSync(envPath, holdPath);
    movedEnv = true;
  }

  run("npm", ["run", "cf:patch"], buildEnv);
  run("opennextjs-cloudflare", ["build", "--dangerouslyUseUnsupportedNextVersion"], buildEnv);
} finally {
  if (movedEnv && fs.existsSync(holdPath)) {
    fs.renameSync(holdPath, envPath);
  }
  if (lockHandle !== undefined) {
    fs.closeSync(lockHandle);
    fs.rmSync(lockPath, { force: true });
  }
}
