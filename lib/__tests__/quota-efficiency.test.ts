import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PaidLedger } from "../paid-local/ledger";
import { schema } from "../../workers/flora-api/schema";
import { costIndexes } from "../../workers/flora-api/cost-indexes";
import { FloraLedger } from "../../workers/flora-api/index";

function fixture() {
  const db = new DatabaseSync(":memory:"); db.exec(schema); db.exec(costIndexes);
  const statements: string[] = [];
  const proxy = {prepare(query: string) { statements.push(query); return db.prepare(query); }} as DatabaseSync;
  const tx = <T>(work: () => T) => { db.exec("BEGIN"); try {const value=work();db.exec("COMMIT");return value;}catch(error){db.exec("ROLLBACK");throw error;} };
  let now=Date.parse("2026-10-23T04:00:00Z");
  const store=new PaidLedger(proxy,tx,()=>now,{key:()=>"test-only-key".repeat(8),prefix:"FLORA"});
  const uid=randomUUID(), other=randomUUID(); store.ensureUser(uid,"one@example.invalid");store.ensureUser(other,"two@example.invalid");
  const project=store.saveProject(uid,{title:"分页测试"});
  const stmt=db.prepare("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,state,result_json,created_at) VALUES(?,?,?,?,?,'[]','completed',?,?)");
  tx(()=>{for(let i=0;i<1050;i++){
    const id=randomUUID();stmt.run(id,uid,randomUUID(),`test-${i}`,"three_card",JSON.stringify({conclusion:"test",interpretation:"x".repeat(5000),advice:"",uncertainty:"",model:"test",promptVersion:"test"}),new Date(now-Math.floor(i/3)*60_000).toISOString());
    db.prepare("INSERT INTO local_reading_projects VALUES(?,?)").run(id,project.id);
  }});
  statements.length=0;
  return {db,store,uid,other,project,statements,tx,advance:(ms:number)=>now+=ms};
}

test("large-account balance and status reads do not load historical bodies or write rows",()=>{
  const f=fixture();try{
    const before=Number(f.db.prepare("SELECT total_changes() n").get()!.n);
    f.store.ensureUser(f.uid,"one@example.invalid");
    const summary=f.store.summary(f.uid),status=f.store.dailyStatus(f.uid);
    assert.equal(summary.balance.available,1);assert.equal(status.signed,false);
    assert.equal("readings" in summary,false);
    assert.equal(f.statements.some(q=>/result_json|SELECT \* FROM paid_readings|SELECT p\.\*/.test(q)),false);
    assert.equal(Number(f.db.prepare("SELECT total_changes() n").get()!.n),before);
    const page=f.store.profileOverview(f.uid);
    assert.equal(page.readings.length,20);assert.ok(page.historyCursor);
    assert.ok(JSON.stringify(page).length<20_000,"profile must not ship interpretation bodies");
  }finally{f.db.close();}
});

test("keyset history pagination preserves every record including tied timestamps and enforces ownership",()=>{
  const f=fixture();try{
    const seen=new Set<string>();let cursor="";let calls=0;
    do {
      const page=f.store.projectReadingPage(f.uid,f.project.id,cursor);assert.ok(page.items.length<=20);
      for(const row of page.items){assert.equal(seen.has(row.id),false);seen.add(row.id);}
      cursor=page.nextCursor||"";calls++;
    }while(cursor);
    assert.equal(seen.size,1050);assert.equal(calls,53);
    assert.throws(()=>f.store.projectReadingPage(f.other,f.project.id),{code:"NOT_FOUND"});
    assert.throws(()=>f.store.projectReadingPage(f.uid,f.project.id,"garbage"),{code:"INVALID_CURSOR"});
    assert.throws(()=>f.store.usagePage(f.uid,"","999"),{code:"INVALID_PERIOD"});
    const usage=f.store.usagePage(f.uid);assert.equal(usage.items.length,20);assert.ok(usage.nextCursor);
    assert.equal(f.store.usagePage(f.other).items.length,0);
  }finally{f.db.close();}
});

test("existing users do not receive duplicate gifts or writes, but changed emails and expired reservations still recover",()=>{
  const f=fixture();try{
    const n=()=>Number(f.db.prepare("SELECT total_changes() n").get()!.n);
    const before=n();f.store.ensureUser(f.uid,"one@example.invalid");assert.equal(n(),before);
    // Also survive a process restart without updating an unchanged account.
    const restarted=new PaidLedger(f.db,f.tx,Date.now);restarted.ensureUser(f.uid,"one@example.invalid");assert.equal(n(),before);
    f.store.ensureUser(f.uid,"changed@example.invalid");assert.equal(f.store.summary(f.uid).user.label,"changed@example.invalid");
    assert.equal(f.store.summary(f.uid).balance.available,1);
    const reading=f.store.draw(f.uid,{question:"超时测试",spread:"three_card",projectId:f.project.id,requestKey:randomUUID()});
    f.store.reserveReading(f.uid,reading.id);assert.equal(f.store.summary(f.uid).balance.reserved,1);
    f.advance(300_000);const restored=f.store.summary(f.uid);assert.equal(restored.balance.reserved,0);assert.equal(restored.balance.available,1);
    const stable=n();f.store.summary(f.uid);assert.equal(n(),stable);
  }finally{f.db.close();}
});

test("daily report date filters use indexes rather than full business table scans",()=>{
  const f=fixture();try{
    for(const table of ["paid_readings","credit_ledger","daily_check_ins","paid_draw_sessions","reading_runs","paid_follow_ups","local_orders","local_payment_receipts"]){
      const plan=f.db.prepare(`EXPLAIN QUERY PLAN SELECT count(*) FROM ${table} WHERE created_at>=? AND created_at<?`).all("2026-10-23","2026-10-24");
      assert.ok(plan.some(row=>String(row.detail).includes("SEARCH")),table);
      assert.equal(plan.some(row=>String(row.detail).startsWith(`SCAN ${table}`)),false,table);
    }
  }finally{f.db.close();}
});

test("production ledger routes return bounded data, cache admin reports and keep telemetry disabled",async()=>{
  const db=new DatabaseSync(":memory:");let queries=0;
  const sql={exec(query:string,...args:unknown[]){queries++;const stmt=db.prepare(query);return{toArray(){return stmt.all(...args as []) as Record<string,unknown>[];}};}};
  // Durable Object exec accepts several schema statements, unlike prepare.
  const adapter={exec(query:string,...args:unknown[]){if(query.includes("CREATE TABLE")||query.includes("CREATE INDEX")){queries++;db.exec(query);return{toArray:()=>[]};}return sql.exec(query,...args);}};
  const storage={sql:adapter,transactionSync:<T>(work:()=>T)=>{db.exec("BEGIN");try{const v=work();db.exec("COMMIT");return v;}catch(e){db.exec("ROLLBACK");throw e;}}};
  const env={CODE_SIGNING_KEY:"test-key".repeat(10),ADMIN_EMAILS:"admin@example.invalid"};
  const ledger=new FloraLedger({storage} as never,env as never);
  const uid=randomUUID();
  const req=(path:string,email="user@example.invalid")=>ledger.fetch(new Request(`https://floralenormand.site/api/flora${path}`,{headers:{"x-flora-user":uid,"x-flora-email":email}}));
  try{
    const summary=await req("/summary");assert.equal(summary.status,200);assert.equal("readings" in (await summary.json() as object),false);
    assert.equal((await req("/daily-status")).status,200);
    assert.equal((await req("/admin/report?date=2026-10-23")).status,403);
    assert.equal((await req("/admin/report?date=2026-10-23","admin@example.invalid")).status,200);
    const before=queries;assert.equal((await req("/admin/report?date=2026-10-23","admin@example.invalid")).status,200);assert.equal(queries,before);
    const beforeEvent=queries;assert.equal((await ledger.fetch(new Request("https://floralenormand.site/api/flora/analytics",{method:"POST",headers:{"x-flora-telemetry":"1"},body:"invalid"}))).status,204);assert.equal(queries,beforeEvent);
  }finally{db.close();}
});

test("client coalesces reads, invalidates after mutations, isolates accounts and rejects stale cache refill",async()=>{
  const source=ts.transpileModule(readFileSync("lib/paid-local/site-bridge.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{} as Record<string,Function>};const sessions=new Map<string,string>();
  const key="ai-lenormand:auth-session";const session={userId:"account-one",email:"one@example.invalid",accessToken:"test-token"};sessions.set(key,JSON.stringify(session));
  let calls=0,now=Date.now();let response=async()=>Response.json({balance:{available:1,reserved:0,consumed:0}});
  class ClockDate extends Date {static now(){return now;}}
  const context={module,exports:module.exports,Date:ClockDate,process:{env:{NEXT_PUBLIC_PAID_ONLINE_MODE:"1"}},window:{location:{hostname:"floralenormand.site"},localStorage:{getItem:(k:string)=>sessions.get(k)||null,removeItem:(k:string)=>sessions.delete(k)}},fetch:async()=>{calls++;return response();},require:(name:string)=>{assert.equal(name,"../project-store");return {getValidSession:async()=>JSON.parse(sessions.get(key)||"null")};}};
  vm.runInNewContext(source,context);const api=module.exports;
  assert.equal((await api.restorePaidSiteSession()).userId,session.userId);assert.equal(calls,0);
  await Promise.all([api.paidSiteRequest("summary"),api.paidSiteRequest("summary")]);assert.equal(calls,1);
  await api.paidSiteQuota();assert.equal(calls,1);
  await api.paidSiteRequest("redeem",{code:"test"});await api.paidSiteRequest("summary");assert.equal(calls,3);
  sessions.set(key,JSON.stringify({...session,userId:"account-two"}));await api.paidSiteRequest("summary");assert.equal(calls,4);
  now+=16_000;await api.paidSiteRequest("summary");assert.equal(calls,5);
  let resolve!: (r:Response)=>void;response=()=>new Promise(r=>resolve=r);
  const old=api.paidSiteRequest("projects");await new Promise(r=>setImmediate(r));
  response=async()=>Response.json({ok:true});await api.paidSiteRequest("project-update",{});
  resolve(Response.json([{id:"stale"}]));await old;const before=calls;await api.paidSiteRequest("projects");assert.equal(calls,before+1);
  response=async()=>Response.json({code:"DATABASE_QUOTA_RESET"},{status:503});await assert.rejects(api.paidSiteRequest("daily"));assert.ok(sessions.has(key));
  response=async()=>Response.json({code:"UNAUTHORIZED"},{status:401});await assert.rejects(api.paidSiteRequest("daily"));assert.equal(sessions.has(key),false);
});
