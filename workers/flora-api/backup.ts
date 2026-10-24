import { createHash } from "node:crypto";
import { LocalPaidError } from "../../lib/paid-local/guard";

type Row = Record<string, unknown>;
export type BackupSql = { readonly databaseSize?: number; exec(query: string, ...args: unknown[]): Iterable<Row> & { toArray(): Row[] } };
type Storage = { sql: BackupSql; transactionSync<T>(work: () => T): T };
export type BackupTable = { name: string; columns: string[]; count: number; fence: number };
export type BackupManifest = { format: "flora-sqlite-backup-v1"; id: string; createdAt: string; expiresAt: number; databaseBytes: number | null; schema: { type: string; name: string; sql: string }[]; tables: BackupTable[]; manifestHash: string };
const state = "_flora_backup_state", shadow = "_flora_backup_shadow";
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const fail = (code: string, message: string) => { throw new LocalPaidError(code, message, 409); };
const rowJson = (columns: string[], prefix: string) => `json_array(${columns.map(c => `CASE WHEN typeof(${prefix}.${quote(c)})='blob' THEN json_object('__floraBlobHex',hex(${prefix}.${quote(c)})) ELSE ${prefix}.${quote(c)} END`).join(",")})`;

// Copy-on-write records only the FIRST before-image of rows that change while
// export is running. Readers merge those images with unchanged live rows, so
// all tables describe the same start point without pausing customer requests.
export class SnapshotBackup {
  private cached: BackupManifest | null = null;
  constructor(private storage: Storage, private clock = Date.now) {}
  private rows(query: string, ...args: unknown[]) { return this.storage.sql.exec(query, ...args).toArray(); }
  private exists() { return this.rows("SELECT name FROM sqlite_master WHERE type='table' AND name=?", state).length > 0; }
  private schemaObjects() {
    return this.rows("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name NOT GLOB '_flora_backup_*' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END,name").map(r => ({type: String(r.type), name: String(r.name), sql: String(r.sql)}));
  }
  inspect() {
    return { databaseBytes: this.storage.sql.databaseSize ?? null, schemaVersions: this.rows("SELECT version FROM local_schema_versions ORDER BY version"), tables: this.schemaObjects().filter(o => o.type === "table").map(o => ({name: o.name})), activeBackup: this.exists() ? this.rows(`SELECT id,expires_at FROM ${state}`)[0] || null : null };
  }
  begin(id: string): BackupManifest {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return fail("INVALID_BACKUP", "备份标识无效。");
    return this.storage.transactionSync(() => {
      if (this.exists()) {
        const old = this.rows(`SELECT id,expires_at,manifest_json FROM ${state}`)[0];
        if (old?.id === id && Number(old.expires_at) > this.clock()) return this.cached = JSON.parse(String(old.manifest_json));
        return fail("BACKUP_IN_PROGRESS", "已有备份或过期备份，请先核对并结束原备份。");
      }
      const schema = this.schemaObjects();
      const tables = schema.filter(o => o.type === "table").map(o => {
        if (/WITHOUT\s+ROWID/i.test(o.sql)) return fail("UNSUPPORTED_TABLE", "备份发现不支持的无 rowid 表，未开始导出。");
        const columns = this.rows(`PRAGMA table_info(${quote(o.name)})`).map(r => String(r.name));
        if (!columns.length || columns.length > 45 || columns.some(c => ["rowid", "_rowid_", "oid"].includes(c.toLowerCase()))) return fail("UNSUPPORTED_TABLE", "表结构需要单独备份支持。");
        const stats = this.rows(`SELECT count(*) n,coalesce(max(rowid),0) fence FROM ${quote(o.name)}`)[0];
        return { name: o.name, columns, count: Number(stats.n), fence: Number(stats.fence) };
      });
      const now = this.clock();
      const data = {format: "flora-sqlite-backup-v1" as const, id, createdAt: new Date(now).toISOString(), expiresAt: now + 45 * 60_000, databaseBytes: this.storage.sql.databaseSize ?? null, schema, tables};
      const manifest = {...data, manifestHash: createHash("sha256").update(JSON.stringify(data)).digest("hex")};
      this.rows(`CREATE TABLE ${state}(id TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,manifest_json TEXT NOT NULL)`);
      this.rows(`CREATE TABLE ${shadow}(table_name TEXT NOT NULL,row_id INTEGER NOT NULL,row_json TEXT,PRIMARY KEY(table_name,row_id)) WITHOUT ROWID`);
      this.rows(`INSERT INTO ${state} VALUES(?,?,?)`, id, manifest.expiresAt, JSON.stringify(manifest));
      for (let index=0;index<tables.length;index++) {
        const table=tables[index];
        const live = `(SELECT expires_at FROM ${state} LIMIT 1)>CAST(strftime('%s','now') AS INTEGER)*1000`;
        const missing = (prefix: string) => `NOT EXISTS(SELECT 1 FROM ${shadow} WHERE table_name=${literal(table.name)} AND row_id=${prefix}.rowid)`;
        for (const event of ["UPDATE", "DELETE"] as const) this.rows(`CREATE TRIGGER ${quote(`_flora_backup_${index}_${event}`)} BEFORE ${event} ON ${quote(table.name)} WHEN OLD.rowid<=${table.fence} AND ${live} AND ${missing("OLD")} BEGIN INSERT OR IGNORE INTO ${shadow} VALUES(${literal(table.name)},OLD.rowid,${rowJson(table.columns,"OLD")}); END`);
        // A table that deletes its last rows can reuse a low rowid on INSERT.
        // Such newly inserted rows must not appear in the earlier snapshot.
        this.rows(`CREATE TRIGGER ${quote(`_flora_backup_${index}_INSERT`)} AFTER INSERT ON ${quote(table.name)} WHEN NEW.rowid<=${table.fence} AND ${live} AND ${missing("NEW")} BEGIN INSERT OR IGNORE INTO ${shadow} VALUES(${literal(table.name)},NEW.rowid,NULL); END`);
      }
      return this.cached = manifest;
    });
  }
  private manifest(id: string) {
    if (!this.cached) {
      if (!this.exists()) return fail("BACKUP_NOT_FOUND", "备份不存在或已经结束。");
      const row = this.rows(`SELECT manifest_json FROM ${state} WHERE id=?`, id)[0];
      if (!row) return fail("BACKUP_NOT_FOUND", "备份标识不匹配。");
      this.cached = JSON.parse(String(row.manifest_json));
    }
    if (this.cached!.id !== id) return fail("BACKUP_NOT_FOUND", "备份标识不匹配。");
    if (this.cached!.expiresAt <= this.clock()) return fail("BACKUP_EXPIRED", "备份已过期，请结束后重新开始。");
    return this.cached!;
  }
  page(id: string, name: string, after: number) {
    const manifest = this.manifest(id), table = manifest.tables.find(t => t.name === name);
    if (!table || !Number.isSafeInteger(after) || after < 0 || after > table.fence) return fail("INVALID_BACKUP_PAGE", "备份页参数无效。");
    const cursor = this.storage.sql.exec(`SELECT t.rowid rid,${rowJson(table.columns,"t")} row_json FROM ${quote(table.name)} t WHERE t.rowid>? AND t.rowid<=? AND NOT EXISTS(SELECT 1 FROM ${shadow} b WHERE b.table_name=? AND b.row_id=t.rowid) UNION ALL SELECT b.row_id rid,b.row_json FROM ${shadow} b WHERE b.table_name=? AND b.row_id>? AND b.row_id<=? AND b.row_json IS NOT NULL ORDER BY rid LIMIT 128`, after, table.fence, name, name, after, table.fence);
    const rows: {rowid: number; values: unknown[]}[] = []; let bytes = 0, truncated = false;
    const iterator=cursor[Symbol.iterator]();
    for (let entry=iterator.next();!entry.done;entry=iterator.next()) {
      const row=entry.value;
      const raw = String(row.row_json), size = new TextEncoder().encode(raw).byteLength;
      if (rows.length && bytes + size > 750_000) { truncated = true; iterator.return?.(); break; }
      if (size > 4_000_000) return fail("BACKUP_ROW_TOO_LARGE", "单条记录超过备份传输限制。");
      rows.push({rowid: Number(row.rid), values: JSON.parse(raw)}); bytes += size;
    }
    const nextCursor = rows.at(-1)?.rowid ?? after;
    return {backupId: id, manifestHash: manifest.manifestHash, table: name, after, rows, nextCursor, done: !truncated && (rows.length < 128 || nextCursor === table.fence)};
  }
  end(id: string) {
    let phase = "begin";
    try { return this.storage.transactionSync(() => {
      if (!this.exists()) { this.cached = null; return {finished: true, alreadyFinished: true}; }
      const row = this.rows(`SELECT id FROM ${state}`)[0];
      if (row?.id !== id) return fail("BACKUP_NOT_FOUND", "备份标识不匹配，未清理其他备份。");
      phase = "triggers";
      for (const trigger of this.rows("SELECT name FROM sqlite_master WHERE type='trigger' AND name GLOB '_flora_backup_*'")) this.rows(`DROP TRIGGER ${quote(String(trigger.name))}`);
      phase = "count";
      const changes = this.rows(`SELECT count(*) n FROM ${shadow}`)[0];
      phase = "drop-shadow"; this.rows(`DROP TABLE ${shadow}`);
      phase = "drop-state"; this.rows(`DROP TABLE ${state}`); this.cached = null;
      return {finished: true, capturedChanges: Number(changes.n)};
    }); } catch(error) {
      if (error instanceof LocalPaidError) throw error;
      // Only fixed diagnostic labels, never SQL text or customer values.
      const message = error instanceof Error ? error.message : "";
      const reason = /database (?:table )?is locked/i.test(message) ? "locked" : /CPU|time limit/i.test(message) ? "cpu-limit" : /authoriz|permission/i.test(message) ? "permission" : /SQLITE_([A-Z_]+)/.exec(message)?.[1] || "unknown";
      throw new LocalPaidError("BACKUP_CLEANUP_FAILED", `Backup cleanup ${phase}: ${reason}`, 503);
    }
  }
}
