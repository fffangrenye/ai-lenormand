import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import type * as ProjectStore from "../project-store";
import type * as SiteBridge from "../paid-local/site-bridge";

const key = "ai-lenormand:auth-session";
const account = { userId: "alice", email: "alice@example.invalid", accessToken: "old", refreshToken: "refresh-old", expiresAt: Date.now() + 3_600_000 };
const replacement = { ...account, userId: "bob", email: "bob@example.invalid" };
const renewed = () => Response.json({
  user: { id: account.userId, email: account.email },
  access_token: "new", refresh_token: "refresh-new", expires_in: 3600
});
const invalid = () => Response.json({ error_code: "refresh_token_not_found" }, { status: 400 });
const unauthorized = () => Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
const sources = Object.fromEntries(["project-store", "paid-local/site-bridge"].map(name => [
  name, ts.transpileModule(readFileSync(`lib/${name}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
]));

function fixture(start = account) {
  const storage = new Map([[key, JSON.stringify(start)]]);
  let queue: Promise<unknown> = Promise.resolve();
  let authCalls = 0;
  const apiCalls: { method: string; token?: string }[] = [];
  let auth = async () => renewed();
  let api = async (_request: (typeof apiCalls)[number]) => Response.json({ ok: true });
  const locks = { request(_key: string, action: () => Promise<unknown>) {
    const next = queue.then(action);
    queue = next.catch(() => undefined);
    return next;
  } };

  function tab(navigator: { locks?: typeof locks } = {}) {
    const context = vm.createContext({
      process: { env: {
        NEXT_PUBLIC_PAID_ONLINE_MODE: "1", NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture"
      } },
      window: { setTimeout, clearTimeout, navigator, location: { hostname: "floralenormand.site" },
        localStorage: { getItem: (name: string) => storage.get(name) ?? null, setItem: (name: string, value: string) => storage.set(name, value), removeItem: (name: string) => storage.delete(name) } },
      AbortController, setTimeout, clearTimeout,
      fetch: (url: string, options: RequestInit) => {
        if (url.startsWith("https://auth.example.invalid/auth/v1/token?grant_type=refresh_token")) {
          authCalls++;
          return auth();
        }
        assert.ok(url.startsWith("/api/flora/"));
        const request = { method: options.method || "GET", token: (options.headers as Record<string, string>).Authorization };
        apiCalls.push(request);
        return api(request);
      }
    });
    const modules: Record<string, { exports: unknown }> = {
      "project-store": { exports: {} }, "paid-local/site-bridge": { exports: {} }
    };
    for (const [name, module] of Object.entries(modules)) {
      const load = vm.runInContext(`(function (module, exports, require) { ${sources[name]}\n})`, context);
      load(module, module.exports, (specifier: string) => {
        if (specifier === "../project-store") return modules["project-store"].exports;
        if (specifier === "./paid-local/site-bridge") return modules["paid-local/site-bridge"].exports;
        if (specifier === "./reading-safety") return require("../paid-local/reading-safety");
        return require(name === "project-store" ? "." + specifier : specifier);
      });
    }
    return { store: modules["project-store"].exports as typeof ProjectStore, bridge: modules["paid-local/site-bridge"].exports as typeof SiteBridge };
  }
  return {
    tab, locks, apiCalls, count: () => authCalls, save: (value: typeof account) => storage.set(key, JSON.stringify(value)),
    session: () => JSON.parse(storage.get(key) || "null") as typeof account | null,
    auth: (respond: typeof auth) => { auth = respond; },
    api: (respond: typeof api) => { api = respond; }
  };
}

test("expired credentials are refreshed once for simultaneous requests and browser tabs", async () => {
  const f = fixture({ ...account, expiresAt: 1 });
  const first = f.tab({ locks: f.locks });
  const second = f.tab({ locks: f.locks });
  const results = await Promise.all([first.store.getValidSession(), first.store.getValidSession(), second.store.getValidSession()]);
  assert.deepEqual(results.map(result => result.accessToken), ["new", "new", "new"]);
  assert.equal(f.count(), 1);
  assert.equal(f.session()?.refreshToken, "refresh-new");
});

test("timeout, service failure and rate limiting preserve credentials and allow a retry", async () => {
  const f = fixture({ ...account, expiresAt: 1 });
  const { bridge } = f.tab();
  for (const respond of [
    async () => { throw new DOMException("Timed out", "AbortError"); },
    async () => Response.json({ error_code: "unexpected_failure" }, { status: 503 }),
    async () => Response.json({ error_code: "over_request_rate_limit" }, { status: 429 })
  ]) {
    f.auth(respond);
    await assert.rejects(bridge.restorePaidSiteSession(), { code: "AUTH_UNAVAILABLE", status: 503 });
    assert.equal(f.session()?.refreshToken, "refresh-old");
  }
  f.auth(async () => renewed());
  assert.equal((await bridge.restorePaidSiteSession())?.accessToken, "new");
});

test("confirmed invalid credentials require sign-in while a late refresh cannot replace another account", async () => {
  const f = fixture({ ...account, expiresAt: 1 });
  const { bridge } = f.tab();
  f.auth(async () => invalid());
  assert.equal(await bridge.restorePaidSiteSession(), null);
  assert.equal(f.session(), null);

  f.save({ ...account, expiresAt: 1 });
  let finish!: (response: Response) => void;
  f.auth(() => new Promise(resolve => { finish = resolve; }));
  const pending = bridge.restorePaidSiteSession();
  await new Promise(resolve => setImmediate(resolve));
  f.save(replacement);
  finish(renewed());
  await assert.rejects(pending, { code: "ACCOUNT_CHANGED" });
  assert.equal(f.session()?.userId, replacement.userId);
});

test("a stale refresh failure cannot clear a session another tab already renewed", async () => {
  const f = fixture({ ...account, expiresAt: 1 });
  const { store } = f.tab();
  let finish!: (response: Response) => void;
  f.auth(() => new Promise(resolve => { finish = resolve; }));
  const first = store.getValidSession();
  const second = store.getValidSession();
  f.save({ ...account, accessToken: "new", refreshToken: "refresh-new" });
  finish(invalid());
  assert.deepEqual((await Promise.all([first, second])).map(session => session.accessToken), ["new", "new"]);
  assert.equal(f.count(), 1);
  assert.equal(f.session()?.refreshToken, "refresh-new");
});

test("a 401 retries reads once and restores mutations without replaying them", async () => {
  for (const action of ["summary", "redeem"]) {
    const f = fixture();
    const { bridge } = f.tab();
    f.api(async ({ token }) => token === "Bearer old" ? unauthorized() : Response.json({ ok: true }));
    if (action === "summary") {
      assert.equal((await bridge.paidSiteRequest<{ ok: boolean }>(action)).ok, true);
      assert.deepEqual(f.apiCalls.map(call => call.token), ["Bearer old", "Bearer new"]);
    } else {
      await assert.rejects(bridge.paidSiteRequest(action, { code: "fixture" }), { code: "AUTH_RESTORED", status: 409 });
      assert.deepEqual(f.apiCalls, [{ method: "POST", token: "Bearer old" }]);
    }
    assert.equal(f.count(), 1);
    assert.equal(f.session()?.accessToken, "new");
  }
});

test("a repeated API rejection stops after one retry and preserves a successfully renewed session", async () => {
  const f = fixture();
  const { bridge } = f.tab();
  f.api(async () => unauthorized());
  await assert.rejects(bridge.paidSiteRequest("summary"), { code: "AUTH_UNAVAILABLE", status: 503 });
  assert.equal(f.apiCalls.length, 2);
  assert.equal(f.count(), 1);
  assert.equal(f.session()?.accessToken, "new");
});
