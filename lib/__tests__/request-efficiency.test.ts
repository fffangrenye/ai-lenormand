import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {randomUUID} from "node:crypto";
import {readFileSync,mkdirSync,writeFileSync,copyFileSync,existsSync,rmSync} from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import {PaidLedger} from "../paid-local/ledger";
import {schema} from "../../workers/flora-api/schema";
import {costIndexes} from "../../workers/flora-api/cost-indexes";
import {readDrawDraft,saveDrawDraft,recoverDrawTokens,clearDrawDraft} from "../paid-local/draw-draft";
import {staticApplicationPaths,staticLegalPaths,isStaticPublicHref,safeSitePath} from "../public-routes";

function fixture(){
 const db=new DatabaseSync(":memory:");db.exec(schema);db.exec(costIndexes);const queries:string[]=[];let fail=false;
 const proxy={prepare(sql:string){queries.push(sql);const statement=db.prepare(sql);if(fail&&sql.startsWith("INSERT INTO paid_readings"))return {run(){throw Error("fixture disk failure");}};return statement;}} as DatabaseSync;
 const tx=<T>(fn:()=>T)=>{db.exec("BEGIN");try{const result=fn();db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}};
 const store=new PaidLedger(proxy,tx,()=>Date.parse("2026-10-24T07:00:00Z"));const uid=randomUUID(),other=randomUUID();store.ensureUser(uid,"one@example.invalid");store.ensureUser(other,"two@example.invalid");const project=store.saveProject(uid,{title:"请求优化测试"});
 return {db,store,uid,other,project,queries,fail:(value:boolean)=>fail=value};
}
test("nine selected cards commit once, preserve server-only identities, replay safely and reject conflicting batches",()=>{
 const f=fixture();try{
  const start=f.store.startDrawSession(f.uid,{projectId:f.project.id,question:"如何安排下一步？",spread:"nine_grid",requestKey:randomUUID()});
  assert.equal(JSON.stringify(start.deck).includes('"card"'),false);assert.equal(JSON.stringify(start.deck).includes('"number"'),false);
  const tokens=start.deck.slice(0,9).map(card=>card.token);const before=f.store.summary(f.uid).balance;
  for(const input of [[tokens[0],tokens[0]], [tokens[0],randomUUID()],[],tokens.concat(start.deck[9].token)])assert.throws(()=>f.store.pickDrawCards(f.uid,start.id,input,0));
  assert.throws(()=>f.store.pickDrawCards(f.other,start.id,tokens,0),{code:"NOT_FOUND"});
  assert.equal(f.store.drawSession(f.uid,start.id).selected.length,0);
  f.fail(true);assert.throws(()=>f.store.pickDrawCards(f.uid,start.id,tokens,0),/fixture disk failure/);f.fail(false);
  assert.equal(f.store.drawSession(f.uid,start.id).selected.length,0,"final reading failure must roll back all selected tokens");
  const selected=f.store.pickDrawCards(f.uid,start.id,tokens,0);assert.equal(selected.state,"completed");assert.equal(selected.selected.length,9);
  assert.deepEqual(selected.selectedTokens,tokens);assert.deepEqual(f.store.pickDrawCards(f.uid,start.id,tokens,0),selected);
  assert.equal(f.db.prepare("SELECT count(*) n FROM paid_readings").get()!.n,1);
  assert.deepEqual(f.store.summary(f.uid).balance,before,"selection must not debit a petal");
  const raw=JSON.parse(String(f.db.prepare("SELECT deck_json FROM paid_draw_sessions WHERE id=?").get(start.id)!.deck_json));
  assert.deepEqual(selected.selected.map(card=>card.number),tokens.map(token=>raw.find((entry:{token:string})=>entry.token===token).card.number));
  assert.throws(()=>f.store.pickDrawCards(f.uid,start.id,[tokens[1],tokens[0],...tokens.slice(2)],0),{code:"DRAW_CLOSED"});
  const second=f.store.startDrawSession(f.uid,{projectId:f.project.id,question:"另一个问题？",spread:"three_card",requestKey:randomUUID()});
  const first=f.store.pickDrawCards(f.uid,second.id,[second.deck[0].token],0);
  assert.deepEqual(f.store.pickDrawCards(f.uid,second.id,[second.deck[0].token],0),first);
  assert.throws(()=>f.store.pickDrawCards(f.uid,second.id,[second.deck[1].token],0),{code:"DRAW_CHANGED"});
  const end=f.store.pickDrawCards(f.uid,second.id,second.deck.slice(1,3).map(card=>card.token),1);
  assert.equal(end.state,"completed");assert.equal(f.store.pickDrawCard(f.uid,second.id,second.deck[0].token,0).readingId,end.readingId,"old per-card retries remain compatible");
 }finally{f.db.close();}
});
test("local draw journal resumes ordered selections, acknowledges lost responses, and isolates accounts and sessions",()=>{
 const f=fixture(),original=Object.getOwnPropertyDescriptor(globalThis,"window"),values=new Map<string,string>();
 Object.defineProperty(globalThis,"window",{configurable:true,value:{localStorage:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}}});
 try{
  const start=f.store.startDrawSession(f.uid,{projectId:f.project.id,question:"继续抽牌？",spread:"nine_grid",requestKey:randomUUID()});const tokens=start.deck.slice(0,9).map(card=>card.token);
  assert.equal(saveDrawDraft(f.uid,start,tokens),true);const journal=readDrawDraft(f.uid,f.project.id);
  assert.deepEqual(recoverDrawTokens(start,journal),tokens);assert.equal(readDrawDraft(f.other,f.project.id),null);
  const partial=f.store.pickDrawCards(f.uid,start.id,tokens.slice(0,3),0);assert.deepEqual(recoverDrawTokens(partial,journal),tokens.slice(3));
  const done=f.store.pickDrawCards(f.uid,start.id,tokens.slice(3),3);assert.deepEqual(recoverDrawTokens(done,journal),[]);
  const wrong={...journal!,sessionId:randomUUID()};assert.deepEqual(recoverDrawTokens(start,wrong),[]);
  const conflict={...journal!,tokens:[tokens[1],tokens[0],...tokens.slice(2)]};assert.deepEqual(recoverDrawTokens(partial,conflict),[]);
  clearDrawDraft(f.uid,f.project.id,start.id);assert.equal(readDrawDraft(f.uid,f.project.id),null);
  Object.defineProperty(window.localStorage,"setItem",{value:()=>{throw Error("quota");}});assert.equal(saveDrawDraft(f.uid,start,tokens),false);
 }finally{f.db.close();if(original)Object.defineProperty(globalThis,"window",original);else Reflect.deleteProperty(globalThis,"window");}
});
test("profile loads only the active section and ledger cursor pages use owner indexes without duplicates",()=>{
 const f=fixture();try{
  const batch=String(f.db.prepare("SELECT id FROM credit_batches WHERE user_id=?").get(f.uid)!.id),date="2026-10-24T06:00:00Z";
  const insert=f.db.prepare("INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?,?,?,?)");for(let i=0;i<55;i++)insert.run(randomUUID(),f.uid,batch,randomUUID(),"fixture",0,0,0,"测试流水",date);
  f.queries.length=0;const usage=f.store.profileSection(f.uid,"usage");assert.deepEqual(usage.ledger,[]);assert.equal(f.queries.some(sql=>/SELECT .*FROM credit_ledger/.test(sql)),false);
  f.queries.length=0;const ledger=f.store.profileSection(f.uid,"ledger");assert.equal(ledger.ledger.length,20);assert.equal(ledger.readings.length,0);assert.equal(f.queries.some(sql=>sql.includes("FROM paid_readings p")),false);
  const ids=ledger.ledger.map(item=>item.id);let cursor=ledger.ledgerCursor;
  while(cursor){const page=f.store.ledgerPage(f.uid,cursor);assert.ok(page.items.length<=20);ids.push(...page.items.map(item=>item.id));cursor=page.nextCursor;}
  assert.equal(ids.length,56);assert.equal(new Set(ids).size,ids.length);assert.equal(f.store.ledgerPage(f.other).items.length,1);
  const plan=f.db.prepare("EXPLAIN QUERY PLAN SELECT rowid,* FROM credit_ledger WHERE user_id=? AND (created_at,rowid)<(?,?) ORDER BY created_at DESC,rowid DESC LIMIT 21").all(f.uid,date,9999);
  assert.match(JSON.stringify(plan),/SEARCH credit_ledger USING INDEX ledger_owner_created/);assert.doesNotMatch(JSON.stringify(plan),/SCAN credit_ledger/);
  for(const value of ["bad","2026-10-24T00:00:00Z|NaN",date+"|1|2"])assert.throws(()=>f.store.ledgerPage(f.uid,value));
  assert.throws(()=>f.store.profileSection(f.uid,"all"));assert.throws(()=>f.store.ledgerPage(f.uid,"","365"));
 }finally{f.db.close();}
});
function bridgeFixture(){
 let now=Date.parse("2026-10-24T07:00:00Z"),calls=0;const values=new Map<string,string>(),key="ai-lenormand:auth-session";values.set(key,JSON.stringify({userId:"one",accessToken:"test"}));
 const win=Object.assign(new EventTarget(),{location:{hostname:"floralenormand.site"},localStorage:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}}),doc=Object.assign(new EventTarget(),{visibilityState:"visible"});
 class ClockDate extends Date{static now(){return now;}}
 const source=ts.transpileModule(readFileSync("lib/paid-local/site-bridge.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 function load(){const module={exports:{} as Record<string,Function>};vm.runInNewContext(source,{module,exports:module.exports,Date:ClockDate,setTimeout,clearTimeout,process:{env:{NEXT_PUBLIC_PAID_ONLINE_MODE:"1"}},window:win,document:doc,fetch:async()=>{calls++;return Response.json({today:new Date(now+8*3600_000).toISOString().slice(0,10),signed:true,balance:{available:1}});},require:()=>({getValidSession:async()=>{const session=JSON.parse(values.get(key)||"null");if(!session)throw Error("signed out");return session;}})});return module.exports;}
 return {load,win,doc,values,key,calls:()=>calls,advance:(ms:number)=>now+=ms,setNow:(value:number)=>now=value};
}
test("signed daily status survives public-page navigation but expires at Beijing midnight and never crosses accounts",async()=>{
 const f=bridgeFixture();let api=f.load();await api.paidSiteRequest("daily-status");assert.equal(f.calls(),1);
 f.advance(120000);api=f.load();await api.paidSiteRequest("daily-status");assert.equal(f.calls(),1);
 f.values.set(f.key,JSON.stringify({userId:"two",accessToken:"test"}));await api.paidSiteRequest("daily-status");assert.equal(f.calls(),2);
 f.setNow(Date.parse("2026-10-24T16:00:01Z"));await api.paidSiteRequest("daily-status");assert.equal(f.calls(),3);
 f.values.delete(f.key);await assert.rejects(api.paidSiteRequest("daily-status"));assert.equal(f.calls(),3);
});
test("focus and visibility share one refresh event and cross-tab mutations invalidate cached balances",async()=>{
 const f=bridgeFixture(),api=f.load();const reasons:string[]=[];
 const off=api.subscribePaidSiteRefresh((reason:string)=>{reasons.push(reason);void api.paidSiteRequest("summary");});
 try{
  f.win.dispatchEvent(new Event("focus"));f.doc.dispatchEvent(new Event("visibilitychange"));await new Promise(resolve=>setTimeout(resolve,150));
  assert.deepEqual(reasons,["resume"]);assert.equal(f.calls(),1);
  f.advance(1001);f.win.dispatchEvent(new Event("focus"));await new Promise(resolve=>setTimeout(resolve,150));assert.equal(f.calls(),1);
  const event=Object.assign(new Event("storage"),{key:"flora-paid-site:revision:v1",newValue:JSON.stringify({owner:"one",at:1})});f.win.dispatchEvent(event);await new Promise(resolve=>setImmediate(resolve));assert.equal(reasons.at(-1),"mutation");assert.equal(f.calls(),2);
 }finally{off();}
});
test("public export includes only allowlisted HTML and native public navigation rejects external redirects",async()=>{
 const root=path.resolve('.local-paid',`public-assets-test-${randomUUID()}`);mkdirSync(path.join(root,'.open-next/assets'),{recursive:true});mkdirSync(path.join(root,'.next/server/app'),{recursive:true});mkdirSync(path.join(root,'workers/domain-info'),{recursive:true});
 try{
  for(const route of staticApplicationPaths)writeFileSync(path.join(root,'.next/server/app',route==='/'?'index.html':route.slice(1)+'.html'),'<!DOCTYPE html><html><head><title>fixture</title></head><body>public shell</body></html>');
  copyFileSync('workers/domain-info/content.mjs',path.join(root,'workers/domain-info/content.mjs'));
  copyFileSync('workers/domain-info/live-pages.mjs',path.join(root,'workers/domain-info/live-pages.mjs'));
  const manifest=await require('../../scripts/prepare-public-assets.cjs').preparePublicAssets(root);assert.equal(manifest.length,staticApplicationPaths.length+staticLegalPaths.length);
  for(const route of ['/profile','/login','/deep','/recharge','/redeem','/admin/codes']){assert.equal(isStaticPublicHref(route),false);assert.equal(existsSync(path.join(root,'.open-next/assets',route.slice(1)+'.html')),false);}
  assert.equal(isStaticPublicHref('/daily?checkin=1#daily-calendar'),true);assert.equal(isStaticPublicHref('//example.invalid'),false);
  for(const value of ['//evil.invalid','/\\evil.invalid','https://evil.invalid','/\nevil'])assert.equal(safeSitePath(value),'/deep');
  assert.equal(safeSitePath('/daily?checkin=1'),'/daily?checkin=1');
 }finally{if(!root.startsWith(path.resolve('.local-paid')+path.sep))throw Error('Unsafe fixture cleanup');rmSync(root,{recursive:true,force:true});}
});
