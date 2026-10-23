import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHmac} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {PaidLedger} from "../paid-local/ledger";
import {schema} from "../../workers/flora-api/schema";
import {lenormandCards} from "../lenormand-cards";
import type {LegacySnapshot} from "../paid-local/legacy-restore";
import {verifyRestoreJob} from "../../workers/flora-api/legacy-maintenance";
import {paidReadingForSite,paidFollowUpsForSite} from "../paid-local/site-bridge";

function setup(){
  const db=new DatabaseSync(":memory:");db.exec(schema);db.exec("PRAGMA foreign_keys=ON");
  const tx=<T>(work:()=>T)=>{db.exec("BEGIN IMMEDIATE");try{const r=work();db.exec("COMMIT");return r;}catch(e){db.exec("ROLLBACK");throw e;}};
  const store=new PaidLedger(db,tx,Date.now,{key:()=>"test-key-".repeat(8),prefix:"FLORA"});
  const uid=randomUUID(),pid=randomUUID(),rid=randomUUID(),at="2026-09-22T10:00:00.000Z";
  const s:LegacySnapshot={format:"flora-legacy-v1",sourceProject:"pgivpvywizvtxjgqkvya",user:{id:uid,email:"restore@example.invalid",email_confirmed_at:at},projects:[{id:pid,user_id:uid,title:"旧项目",background:"原背景",memory_summary:"原记忆",created_at:at,updated_at:at,last_opened_at:at}],readings:[{id:rid,user_id:uid,project_id:pid,question:"原问题",spread_type:"three_card",status:"completed",core_conclusion:"原结论",interpretation:"原解读",time_window:"原时间倾向",uncertainty:"原提示",created_at:at,completed_at:"2026-09-22T10:01:00.000Z"}],cards:lenormandCards.slice(12,15).map((c,i)=>({id:randomUUID(),reading_id:rid,card_number:i+1,card_slug:c.slug,name_en:c.nameEn,name_zh:c.nameZh,position:`位置${i+1}`})),messages:[{id:randomUUID(),user_id:uid,project_id:pid,reading_id:rid,role:"assistant",content:"保留孤立的原答复",created_at:at},{id:randomUUID(),user_id:uid,project_id:pid,reading_id:rid,role:"user",content:"原追问",created_at:at}]};
  return {db,store,uid,pid,rid,s};
}
test("historical restore preserves raw data and new records, grants no credits, and is idempotent",()=>{
  const {db,store,uid,pid,rid,s}=setup();try{
    store.ensureUser(uid,s.user.email);const recent=store.saveProject(uid,{title:"新站内容"});
    const before=store.overview(uid),job=randomUUID();
    const dry=store.restoreLegacy(s,job,true);assert.equal(dry.dryRun,true);assert.equal(store.projects(uid).length,1);
    const result=store.restoreLegacy(s,job,false);assert.equal(result.verifiedReadings,1);assert.equal(result.financialUnchanged,true);
    assert.equal(store.projects(uid).length,2);assert.equal(store.project(uid,recent.id).title,"新站内容");assert.equal(store.project(uid,pid).memorySummary,"原记忆");
    assert.deepEqual(store.overview(uid).balance,before.balance);assert.deepEqual(store.overview(uid).ledger,before.ledger);
    const reading=store.reading(uid,rid);assert.equal(reading.completedAt,s.readings[0].completed_at);assert.equal(reading.followUpsRemaining,0);assert.deepEqual(reading.result?.legacy?.sourceRecord,s.readings[0]);assert.deepEqual(reading.result?.legacy?.sourceCards,s.cards);assert.equal(reading.cards[0].number,13);
    const site=paidReadingForSite(reading,s.user.email);assert.equal(site.interpretation,"原解读");assert.equal(site.timeWindow,"原时间倾向");assert.equal(site.legacyRestored,true);
    assert.deepEqual(paidFollowUpsForSite(reading).map(x=>[x.role,x.content]),[["assistant","保留孤立的原答复"],["user","原追问"]]);
    assert.throws(()=>store.reserveFollowUp(uid,rid,"新追问",randomUUID()),{code:"LEGACY_READ_ONLY"});
    assert.equal(store.restoreLegacy(s,job,false).alreadyRestored,true);assert.equal(store.restoreLegacy(s,randomUUID(),false).inserted?.readings,0);
    assert.equal(store.projectReadings(uid,pid).length,1);assert.deepEqual(store.overview(uid).balance,before.balance);
    const changed=structuredClone(s);changed.readings[0].question="修改过的来源";assert.throws(()=>store.restoreLegacy(changed,job,false),{code:"LEGACY_RESTORE_CONFLICT"});
    assert.equal(store.reading(uid,rid).question,"原问题");
  }finally{db.close();}
});
test("wrong-owner snapshots and colliding IDs cannot overwrite any account",()=>{
  const {db,store,uid,s}=setup();try{
    const other=randomUUID();store.ensureUser(other,"other@example.invalid");const p=store.saveProject(other,{title:"其他人的项目"});
    const bad=structuredClone(s);bad.projects[0].id=p.id;bad.readings[0].project_id=p.id;bad.messages.forEach(m=>m.project_id=p.id);
    assert.throws(()=>store.restoreLegacy(bad,randomUUID(),false),{code:"LEGACY_RESTORE_CONFLICT"});
    assert.equal(db.prepare("SELECT count(*) n FROM local_users WHERE id=?").get(uid)?.n,0);
    const badOwner=structuredClone(s);badOwner.messages[0].user_id=other;
    assert.throws(()=>store.restoreLegacy(badOwner,randomUUID(),false),{code:"LEGACY_RESTORE_CONFLICT"});
    assert.equal(store.project(other,p.id).title,"其他人的项目");
  }finally{db.close();}
});
test("a write failure rolls the entire import back without creating accounts or partial projects",()=>{
  const {db,store,uid,rid,s}=setup();try{
    db.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON paid_readings WHEN NEW.id='${rid}' BEGIN SELECT RAISE(ABORT,'test'); END`);
    assert.throws(()=>store.restoreLegacy(s,randomUUID(),false));
    for(const table of ["local_users","local_projects","paid_readings","credit_batches","credit_ledger"]){assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n,0);}
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='legacy_restore_jobs'").get()?.n,0);
  }finally{db.close();}
});
test("private maintenance rejects unsigned, modified, expired and mismatched-target jobs",async()=>{
  const {db,s}=setup(),key="test-key-".repeat(8);db.close();
  const job={purpose:"flora-legacy-restore-v1",jobId:randomUUID(),expiresAt:Date.now()+60000,mode:"inspect",expectedUserId:s.user.id,expectedEmail:s.user.email,snapshot:s};
  const request=(value:unknown,signature?:string)=>{const body=JSON.stringify(value);return new Request("https://private/internal/legacy-restore",{method:"POST",headers:{"x-flora-restore-signature":signature??createHmac("sha256",key).update("flora-legacy-maintenance:v1\n"+body).digest("hex")},body});};
  assert.equal((await verifyRestoreJob(request(job),key)).expectedUserId,s.user.id);
  for(const r of [request(job,"a".repeat(64)),request({...job,expiresAt:Date.now()-1}),request({...job,expectedUserId:randomUUID()})])await assert.rejects(verifyRestoreJob(r,key),{code:"FORBIDDEN"});
});
