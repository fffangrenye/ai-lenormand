// Loopback-only preview. Real AI is opt-in; database/payment credentials stay isolated.
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const aiEnabled = process.argv.includes("--ai");
if (aiEnabled && fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const aiKey = aiEnabled ? (process.env.PAID_LOCAL_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "").trim() : "";
const aiModel = aiEnabled ? (process.env.PAID_LOCAL_DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-flash").trim() : "";
if (aiEnabled && !aiKey) throw new Error("本地 AI 测试需要配置 PAID_LOCAL_DEEPSEEK_API_KEY 或现有 DEEPSEEK_API_KEY。");
const port = Number(process.env.PAID_LOCAL_PORT || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local port");
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/SUPABASE|DEEPSEEK|PAYPAL|ALIPAY|STRIPE|WECHAT|WXPAY|WAFFO|ADMIN_EMAILS|NEXT_PUBLIC_API_BASE/.test(key)) env[key] = "";
}
Object.assign(env, {
  NODE_ENV: "development", PAID_LOCAL_MODE: "1", NEXT_PUBLIC_PAID_LOCAL_MODE: "1", PAID_LOCAL_MODEL: aiEnabled ? "deepseek" : "mock",
  PAID_LOCAL_AI_KEY: aiKey, PAID_LOCAL_AI_MODEL: aiModel, NEXT_PUBLIC_PAID_LOCAL_AI: aiEnabled ? "1" : "0",
  PAID_LOCAL_DB: path.join(root, ".local-paid", "v1.sqlite"),
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "", DEEPSEEK_API_KEY: "", ADMIN_EMAILS: "",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_API_BASE: "http://127.0.0.1:9", PAYPAL_CLIENT_SECRET: "", ALIPAY_PRIVATE_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1"
});
fs.mkdirSync(path.join(root, ".local-paid"), { recursive: true });
console.log(`雷诺曼 V3 本地预览：http://127.0.0.1:${port}/`);
console.log(aiEnabled ? `真实 DeepSeek 解读已启用（${aiModel}），会产生 API 用量；记录仅保存在本机，无真实支付。` : "仅本机访问；SQLite 独立存储；模拟模型；无真实支付；生产凭据已隔离。");
const child = spawn(process.execPath, [...(aiEnabled ? ["--use-env-proxy"] : []), require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root, env, stdio: "inherit", windowsHide: true
});
child.on("exit", (code) => { process.exitCode = code || 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
