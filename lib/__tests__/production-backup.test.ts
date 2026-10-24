import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import { SnapshotBackup, type BackupSql } from "../../workers/flora-api/backup";
import { verifyMaintenance } from "../../workers/flora-api/maintenance";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE local_schema_versions(version INTEGER PRIMARY KEY); INSERT INTO local_schema_versions VALUES(10); CREATE TABLE users(id TEXT PRIMARY KEY,label TEXT NOT NULL); CREATE TABLE ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL); CREATE INDEX ledger_owner ON ledger(user_id); CREATE TABLE notes(id TEXT PRIMARY KEY,body TEXT,payload BLOB); INSERT INTO users VALUES('one','原名字'),('two','旧名字'); INSERT INTO ledger VALUES('a','one',10),('b','two',5); INSERT INTO notes VALUES('note','原文',X'001122FF');");
  const sql: BackupSql = {exec(query, ...args) {const rows = db.prepare(query).all(...args as never[]) as Record<string,unknown>[];return Object.assign(rows,{toArray:()=>rows});}};
  const tx = <T>(work:()=>T) => {db.exec("BEGIN");try{const result=work();db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}};
  const backup = new SnapshotBackup({sql,transactionSync:tx});
  const dump=(table:string)=>db.prepare(`SELECT rowid,* FROM "${table}" ORDER BY rowid`).all();
  return {db,sql,tx,backup,dump};
}
function allPages(backup:SnapshotBackup,id:string,table:string) {
  let cursor=0;const rows: {rowid:number;values:unknown[]}[]=[];
  for(let i=0;i<100;i++){const page=backup.page(id,table,cursor);rows.push(...page.rows);if(page.done)return rows;assert.ok(page.nextCursor>cursor);cursor=page.nextCursor;}
  throw Error("pagination did not terminate");
}

test("online copy-on-write snapshot stays consistent across updates, deletes, inserts and rowid reuse",()=>{
  const f=fixture();try{
    const manifest=f.backup.begin("test-backup-one");
    assert.equal(manifest.tables.find(t=>t.name==="users")!.count,2);
    assert.deepEqual(f.backup.begin("test-backup-one"),manifest);
    assert.throws(()=>f.backup.begin("different-backup"),{code:"BACKUP_IN_PROGRESS"});
    f.db.exec("UPDATE users SET label='新名字' WHERE id='one'; UPDATE users SET label='再次修改' WHERE id='one'; DELETE FROM ledger WHERE id='b'; DELETE FROM users WHERE id='two'; INSERT INTO users VALUES('three','新用户'); UPDATE ledger SET amount=9 WHERE id='a'; INSERT INTO ledger VALUES('c','three',2); DELETE FROM notes; INSERT INTO notes VALUES('replacement','替换',NULL);");
    const restarted=new SnapshotBackup({sql:f.sql,transactionSync:f.tx});
    assert.deepEqual(allPages(restarted,manifest.id,"users").map(r=>r.values),[["one","原名字"],["two","旧名字"]]);
    assert.deepEqual(allPages(restarted,manifest.id,"ledger").map(r=>r.values),[["a","one",10],["b","two",5]]);
    assert.deepEqual(allPages(restarted,manifest.id,"notes")[0].values,["note","原文",{__floraBlobHex:"001122FF"}]);
    assert.throws(()=>restarted.page(manifest.id,"users; DROP TABLE users",0),{code:"INVALID_BACKUP_PAGE"});
    assert.throws(()=>restarted.page(manifest.id,"users",-1),{code:"INVALID_BACKUP_PAGE"});
    const actual=f.dump("users");const ended=restarted.end(manifest.id);assert.ok(Number(ended.capturedChanges)>=5);
    assert.deepEqual(f.dump("users"),actual);
    assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name GLOB '_flora_backup_*'").get()!.n,0);
    assert.equal(restarted.end(manifest.id).alreadyFinished,true);
  }finally{f.db.close();}
});

test("backup pagination is bounded and a complete SQLite restoration preserves schema, blobs, indexes and rows",()=>{
  const f=fixture(),restore=new DatabaseSync(":memory:");try{
    restore.exec("PRAGMA foreign_keys=OFF");
    const insert=f.db.prepare("INSERT INTO notes VALUES(?,?,NULL)");for(let i=0;i<320;i++)insert.run(`extra-${i}`,"中文内容".repeat(1000));
    const manifest=f.backup.begin("test-backup-two");let pages=0;
    for(const object of manifest.schema.filter(o=>o.type==="table"))restore.exec(object.sql);
    for(const table of manifest.tables){let cursor=0,count=0;do{
      const page=f.backup.page(manifest.id,table.name,cursor);assert.ok(page.rows.length<=128);pages++;
      for(const row of page.rows){const values=row.values.map(v=>v && typeof v==="object" && "__floraBlobHex" in v ? Buffer.from(String(v.__floraBlobHex),"hex"):v);restore.prepare(`INSERT INTO "${table.name}"(rowid,${table.columns.map(c=>`"${c}"`).join(",")}) VALUES(${[row.rowid,...values].map(()=>"?").join(",")})`).run(row.rowid,...values as never[]);count++;}
      if(page.done)break;assert.ok(page.nextCursor>cursor);cursor=page.nextCursor;
    }while(true);assert.equal(count,table.count);}
    for(const object of manifest.schema.filter(o=>o.type!=="table"))restore.exec(object.sql);
    restore.exec("PRAGMA foreign_keys=ON");
    assert.ok(pages>5);assert.equal(restore.prepare("PRAGMA integrity_check").get()!.integrity_check,"ok");assert.equal(restore.prepare("PRAGMA foreign_key_check").all().length,0);
    for(const name of ["users","ledger","notes"])assert.deepEqual(restore.prepare(`SELECT rowid,* FROM "${name}" ORDER BY rowid`).all(),f.dump(name));
    assert.equal(restore.prepare("SELECT name FROM sqlite_master WHERE name='ledger_owner'").get()!.name,"ledger_owner");
    f.backup.end(manifest.id);
  }finally{f.db.close();restore.close();}
});

test("failed business transactions do not contaminate the snapshot and unsupported schema changes roll back setup",()=>{
  const f=fixture();try{
    const manifest=f.backup.begin("test-backup-three");
    assert.throws(()=>f.tx(()=>{f.db.exec("UPDATE users SET label='撤回' WHERE id='one'");throw Error("rollback");}));
    assert.equal(f.db.prepare("SELECT count(*) n FROM _flora_backup_shadow").get()!.n,0);
    assert.equal(allPages(f.backup,manifest.id,"users")[0].values[1],"原名字");
    f.backup.end(manifest.id);f.db.exec("CREATE TABLE unsupported(id TEXT PRIMARY KEY) WITHOUT ROWID");
    assert.throws(()=>f.backup.begin("test-unsupported"),{code:"UNSUPPORTED_TABLE"});
    assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name GLOB '_flora_backup_*'").get()!.n,0);
  }finally{f.db.close();}
});

test("private maintenance rejects forged, expired, wrong-purpose and unauthorized-actor requests",async()=>{
  const key="test-only-key-".repeat(8),actor="owner@example.invalid";
  const job={purpose:"flora-private-maintenance-v1",expiresAt:Date.now()+60_000,action:"inspect",actor};
  const request=(value:unknown,signature?:string)=>{const body=JSON.stringify(value);return new Request("https://private/internal/maintenance",{method:"POST",headers:{"x-flora-maintenance-signature":signature||createHmac("sha256",key).update("flora-private-maintenance:v1\n"+body).digest("hex")},body});};
  assert.equal((await verifyMaintenance(request(job),key,actor)).action,"inspect");
  for(const req of [request(job,"0".repeat(64)),request({...job,actor:"not-admin@example.invalid"}),request({...job,expiresAt:Date.now()-1}),request({...job,action:"execute-sql"}),request({...job,purpose:"other"})])await assert.rejects(verifyMaintenance(req,key,actor),{code:"FORBIDDEN"});
});
