import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paidConfig } from "./config";
import { assertLocalEnvironment, LocalPaidError } from "./guard";
import { LocalPayments } from "./payment-store";
import { LocalXianyuPayments } from "./xianyu-store";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

import { PaidLedger } from "./ledger";

export class PaidLocalStore extends PaidLedger {
  readonly payments: LocalPayments;
  readonly xianyu: LocalXianyuPayments;
  constructor(filename = assertLocalEnvironment(), clock: () => number = Date.now) {
    if (path.resolve(filename) !== assertLocalEnvironment({ ...process.env, PAID_LOCAL_DB: filename })) throw new Error("Invalid database");
    mkdirSync(path.dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename);
    const transaction = <T>(work: () => T): T => { db.exec("BEGIN IMMEDIATE"); try { const result=work(); db.exec("COMMIT"); return result; } catch(error) { db.exec("ROLLBACK"); throw error; } };
    super(db, transaction, clock);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
    this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/001_v1.sql"), "utf8"));
    this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/002_original_projects.sql"), "utf8"));
    if (!this.one("SELECT version FROM local_schema_versions WHERE version=3")) {
      try { this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/003_interactive_spreads.sql"), "utf8")); }
      catch (error) { try { this.db.exec("ROLLBACK"); } catch {} throw error; }
      finally { this.db.exec("PRAGMA foreign_keys=ON"); }
    }
    this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/004_daily_check_ins.sql"), "utf8"));
    this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/005_consecutive_check_ins.sql"), "utf8"));
    if (!this.one("SELECT version FROM local_schema_versions WHERE version=6")) this.tx(() => {
      if (!this.one("SELECT version FROM local_schema_versions WHERE version=6")) this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/006_payments.sql"), "utf8"));
    });
    this.payments = new LocalPayments({ one: (sql,...params) => this.one(sql,...params), all: (sql,...params) => this.all(sql,...params), run: (sql,...params) => this.run(sql,...params), tx: (action) => this.tx(action), clock: () => this.clock(), grant: (...args) => this.grant(...args), ledger: (...args) => this.ledger(...args) });
    if (!this.one("SELECT version FROM local_schema_versions WHERE version=7")) this.tx(() => {
      if (!this.one("SELECT version FROM local_schema_versions WHERE version=7")) this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/007_xianyu.sql"), "utf8"));
    });
    if (!this.one("SELECT version FROM local_schema_versions WHERE version=8")) this.tx(() => {
      if (!this.one("SELECT version FROM local_schema_versions WHERE version=8")) this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/008_xianyu_checkout_refunds.sql"), "utf8"));
    });
    this.xianyu = new LocalXianyuPayments({ one: (sql,...params) => this.one(sql,...params), all: (sql,...params) => this.all(sql,...params), run: (sql,...params) => this.run(sql,...params), tx: action => this.tx(action), clock: () => this.clock(), grant: (...args) => this.grant(...args), ledger: (...args) => this.ledger(...args) });
    if (!this.one("SELECT version FROM local_schema_versions WHERE version=9")) this.tx(() => {
      if (!this.one("SELECT version FROM local_schema_versions WHERE version=9")) this.db.exec(readFileSync(path.join(process.cwd(), "lib/paid-local/migrations/009_redemption_codes.sql"), "utf8"));
    });
    this.tx(() => { for (const user of this.all("SELECT id FROM local_users")) this.adjustTrialCredits(String(user.id)); });
  }
  close() { this.db.close(); }
  grantTestCredits(userId: string, requestKey: string) {
    assertLocalEnvironment(); this.validateKey(requestKey);
    this.tx(() => {
      if (!this.one("SELECT id FROM local_users WHERE id=?", userId)) throw new LocalPaidError("UNAUTHORIZED", "请先登录本地体验账号。", 401);
      const balance = this.one("SELECT coalesce(sum(quantity-consumed-revoked),0) AS remaining FROM credit_batches WHERE user_id=?", userId);
      if (Number(balance?.remaining) === 0) this.grant(userId, 5, "local_test", `test:${userId}:${requestKey}`);
    });
    return this.overview(userId);
  }
  login(kind: string, previousToken?: string) {
    if (!["new", "legacy", "other"].includes(kind)) throw new LocalPaidError("INVALID_ACCOUNT", "请选择本地测试账号。");
    return this.tx(() => {
      const id = `local-${kind}`;
      const label = kind === "legacy" ? "老用户体验账号" : kind === "other" ? "独立测试账号" : "新用户体验账号";
      this.run("INSERT OR IGNORE INTO local_users VALUES (?,?,?,?)", id, label, kind, kind === "legacy" ? "2026-01-01T00:00:00Z" : this.now());
      this.grant(id, paidConfig.welcomeCredits, kind === "legacy" ? "legacy_launch" : "welcome", `${paidConfig.grantVersion}:onboarding:${id}`);
      this.adjustTrialCredits(id);
      if (previousToken) this.run("DELETE FROM local_sessions WHERE token_hash=?", hash(previousToken));
      this.run("DELETE FROM local_sessions WHERE expires_at <= ?", this.clock());
      const token = randomBytes(32).toString("hex");
      this.run("INSERT INTO local_sessions VALUES (?,?,?)", hash(token), id, this.clock() + 7 * 86400000);
      return { token, userId: id };
    });
  }
  authenticate(token: string | undefined) {
    const session = token && this.one("SELECT user_id FROM local_sessions WHERE token_hash=? AND expires_at>?", hash(token), this.clock());
    if (!session) throw new LocalPaidError("UNAUTHORIZED", "请先选择本地测试账号。", 401);
    return String(session.user_id);
  }
  logout(token: string) { this.run("DELETE FROM local_sessions WHERE token_hash=?", hash(token)); }

}

const stores = globalThis as typeof globalThis & { paidLocalStore?: { filename: string; store: PaidLocalStore } };
export function getPaidLocalStore() {
  const filename = assertLocalEnvironment();
  if (!stores.paidLocalStore || stores.paidLocalStore.filename !== filename) stores.paidLocalStore = { filename, store: new PaidLocalStore(filename) };
  return stores.paidLocalStore.store;
}
