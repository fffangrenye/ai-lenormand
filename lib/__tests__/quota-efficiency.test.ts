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
import floraApi, { FloraLedger } from "../../workers/flora-api/index";
import { measuredSql } from "../../workers/flora-api/sql-cost";

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

test("scan diagnostics read engine counters without extra SQL, data values or repeated logs",()=>{
  let calls=0,now=0;const logs:string[]=[];
  const execute=measuredSql({exec(_query,...args){calls++;assert.equal(args[0],"private-account-value");return{toArray:()=>[{id:"private-result-value"}],rowsRead:2000,rowsWritten:0};}},()=>now,value=>logs.push(value));
  for(let i=0;i<3;i++)assert.equal(execute("SELECT * FROM paid_readings WHERE user_id=?","private-account-value").length,1);
  assert.equal(calls,3);assert.equal(logs.length,1);assert.equal(logs[0].includes("private-"),false);
  assert.equal(JSON.parse(logs[0]).rowsRead,2000);
  now+=60_000;execute("SELECT * FROM paid_readings WHERE user_id=?","private-account-value");assert.equal(logs.length,2);
});

test("public package catalog and cached-client alias do not invoke authentication or the ledger",async()=>{
  const env={SALES_ENABLED:"1",LEDGER:{idFromName(){throw Error("catalog must not open ledger");}}};
  const results=[];
  for(const path of ["card-catalog","catalog"]){const response=await floraApi.fetch(new Request(`https://floralenormand.site/api/flora/${path}`),env as never);assert.equal(response.status,200);results.push(await response.json());}
  assert.deepEqual(results[0],results[1]);assert.deepEqual(Object.keys(results[0] as object).sort(),["localOnly","packages"]);
});

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

test("twenty full histories hydrate in at most seven queries with owner-bounded task lookups and seek pagination",()=>{
  const f=fixture();try{
    const page=f.store.projectReadingPage(f.uid,f.project.id);
    assert.equal(page.items.length,20);
    assert.ok(f.statements.length<=7,`page SQL count: ${f.statements.length}`);
    assert.equal(f.statements.some(q=>q.includes("FROM reading_runs r JOIN credit_ledger")),false);
    const completion=f.statements.find(q=>q.includes("substr(l.event_key,9)"))!;
    const plan=f.db.prepare("EXPLAIN QUERY PLAN "+completion).all(f.uid,...page.items.map(r=>r.id));
    assert.ok(plan.some(row=>String(row.detail).includes("ledger_owner_created")));
    assert.ok(plan.some(row=>String(row.detail).includes("SEARCH r")&&String(row.detail).includes("(id=?)")));
    assert.equal(plan.some(row=>String(row.detail).startsWith("SCAN")),false);
    const expected=page.items.map(row=>f.store.reading(f.uid,row.id));
    assert.deepEqual(page.items,expected);
    f.statements.length=0;
    f.store.projectReadingPage(f.uid,f.project.id,page.nextCursor!);
    const seek=f.statements.find(q=>q.startsWith("SELECT p.*"))!;
    const [time,id]=page.nextCursor!.split("|");
    const seekPlan=f.db.prepare("EXPLAIN QUERY PLAN "+seek).all(f.uid,f.project.id,time,id);
    assert.ok(seekPlan.some(row=>String(row.detail).includes("paid_reading_owner (user_id=? AND created_at<?)")));
  }finally{f.db.close();}
});

test("legacy archives without completion timestamps never query new tasks, and project repair is not repeated",()=>{
  const f=fixture();try{
    f.db.prepare("UPDATE paid_readings SET result_json=? WHERE user_id=?").run(JSON.stringify({conclusion:"",interpretation:"原文",legacy:{sourceRecord:{completed_at:null,status:"drawing"},sourceCards:[],messages:[]}}),f.uid);
    f.statements.length=0;
    const page=f.store.projectReadingPage(f.uid,f.project.id);
    assert.ok(page.items.every(r=>r.completedAt===r.createdAt&&r.legacyRestored&&r.followUpsRemaining===0));
    assert.equal(f.statements.some(q=>q.includes("substr(l.event_key")||q.includes("FROM reading_runs r JOIN")),false);
    assert.deepEqual(page.items,page.items.map(r=>f.store.reading(f.uid,r.id)));
    f.store.projects(f.uid);f.statements.length=0;
    f.store.projects(f.uid);
    assert.equal(f.statements.some(q=>q.includes("NOT IN")||q.includes("paid_readings")),false);
    // A prototype orphan is still linked when checked for the first time.
    assert.equal(f.store.projects(f.other).length,0);
    const orphan=f.store.draw(f.other,{question:"旧体验",spread:"three_card",requestKey:randomUUID()});
    const project=f.store.projects(f.other)[0];
    assert.equal(f.store.reading(f.other,orphan.id).projectId,project.id);
  }finally{f.db.close();}
});

test("batched completion dates and follow-ups equal individual details without changing balances",()=>{
  const f=fixture();try{
    const row=f.store.draw(f.uid,{question:"完整解读",spread:"three_card",projectId:f.project.id,requestKey:randomUUID()});
    const reserved=f.store.reserveReading(f.uid,row.id);f.advance(5000);
    f.store.completeReading(f.uid,row.id,reserved.runId!,{conclusion:"结论",interpretation:"正文",advice:"建议",uncertainty:"参考",model:"test",promptVersion:"test"});
    const follow=f.store.reserveFollowUp(f.uid,row.id,"追问",randomUUID());
    f.store.completeFollowUp(f.uid,row.id,follow.id,follow.attempt!,"回答");
    const before=f.store.summary(f.uid).balance;
    const detail=f.store.reading(f.uid,row.id);
    const page=f.store.projectReadingPage(f.uid,f.project.id);
    assert.deepEqual(page.items.find(r=>r.id===row.id),detail);
    assert.notEqual(detail.completedAt,detail.createdAt);
    assert.equal(detail.followUps[0].answer,"回答");
    assert.deepEqual(f.store.summary(f.uid).balance,before);
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
  now+=31_000;await api.paidSiteRequest("summary");assert.equal(calls,5);
  response=async()=>Response.json({items:[{id:"history-one",state:"completed",legacyRestored:true,followUps:[]}]});
  await api.paidSiteRequest("projects/project-one/reading-page");
  response=async()=>Response.json({ok:true});
  const beforeTouch=calls;
  await Promise.all([api.paidSiteRequest("project-touch",{projectId:"project-one"}),api.paidSiteRequest("project-touch",{projectId:"project-one"})]);
  await api.paidSiteRequest("project-touch",{projectId:"project-one"});
  await api.paidSiteRequest("readings/history-one");
  assert.equal(calls,beforeTouch+1,"project recency must coalesce and preserve seeded history details");
  let resolve!: (r:Response)=>void;response=()=>new Promise(r=>resolve=r);
  const old=api.paidSiteRequest("projects");await new Promise(r=>setImmediate(r));
  response=async()=>Response.json({ok:true});await api.paidSiteRequest("project-update",{});
  resolve(Response.json([{id:"stale"}]));await old;const before=calls;await api.paidSiteRequest("projects");assert.equal(calls,before+1);
  response=async()=>Response.json({code:"DATABASE_QUOTA_RESET"},{status:503});await assert.rejects(api.paidSiteRequest("daily"));assert.ok(sessions.has(key));
  response=async()=>Response.json({code:"UNAUTHORIZED"},{status:401});await assert.rejects(api.paidSiteRequest("daily"));assert.equal(sessions.has(key),false);
});
