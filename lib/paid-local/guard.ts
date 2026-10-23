import path from "node:path";

export class LocalPaidError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = "LocalPaidError"; }
}

// The persistent store survives Next hot reloads, so its Error class may come
// from an earlier module instance. Recognize its explicit public error shape.
export function isLocalPaidError(error: unknown): error is LocalPaidError {
  if (!(error instanceof Error)) return false;
  const candidate = error as Partial<LocalPaidError>;
  return typeof candidate.code === "string" && /^[A-Z_]{3,}$/.test(candidate.code) && typeof candidate.status === "number" && Number.isInteger(candidate.status) && candidate.status >= 400 && candidate.status <= 599;
}

export function assertLocalEnvironment(env = process.env) {
  if (env.PAID_LOCAL_MODE !== "1" || env.NODE_ENV === "production") {
    throw new LocalPaidError("LOCAL_ONLY", "此功能仅在隔离本地测试环境开放。", 404);
  }
  const modelAllowed = env.PAID_LOCAL_MODEL === "mock" || (env.PAID_LOCAL_MODEL === "deepseek" && Boolean(env.PAID_LOCAL_AI_KEY?.trim()));
  if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:9" || env.SUPABASE_SERVICE_ROLE_KEY || env.DEEPSEEK_API_KEY || !modelAllowed) {
    throw new LocalPaidError("UNSAFE_ENVIRONMENT", "本地测试配置未隔离，已阻止启动。", 503);
  }
  const root = path.resolve(process.cwd(), ".local-paid");
  const target = path.resolve(env.PAID_LOCAL_DB || path.join(root, "v1.sqlite"));
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !target.endsWith(".sqlite")) {
    throw new LocalPaidError("UNSAFE_DATABASE", "本地数据库必须保存在项目 .local-paid 目录。", 503);
  }
  return target;
}

export function assertLocalRequest(request: Request) {
  assertLocalEnvironment();
  const url = new URL(request.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new LocalPaidError("LOCAL_ONLY", "仅允许本机访问。", 403);
  // Next may normalize request.url to localhost even when the browser uses 127.0.0.1.
  const host = request.headers.get("host") || url.host;
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) throw new LocalPaidError("INVALID_HOST", "访问地址不匹配。", 403);
  let browserUrl: URL;
  try { browserUrl = new URL(`${url.protocol}//${host}`); } catch { throw new LocalPaidError("INVALID_HOST", "访问地址不匹配。", 403); }
  if (!["127.0.0.1", "localhost"].includes(browserUrl.hostname) || browserUrl.port !== url.port) throw new LocalPaidError("INVALID_HOST", "访问地址不匹配。", 403);
  if (request.method !== "GET") {
    if (request.headers.get("origin") !== browserUrl.origin || request.headers.get("x-local-paid") !== "1") {
      throw new LocalPaidError("INVALID_ORIGIN", "请从本地测试页面提交。", 403);
    }
  }
}
