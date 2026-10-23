import {createHash} from "node:crypto";
import type {SQLInputValue} from "node:sqlite";
import {lenormandCards} from "../lenormand-cards";
import {LocalPaidError} from "./guard";

type Row=Record<string,string|number|null>;
type SourceRow=Record<string,unknown>;
export type LegacySnapshot={format:string;sourceProject:string;user:{id:string;email:string;email_confirmed_at:string};projects:SourceRow[];readings:SourceRow[];cards:SourceRow[];messages:SourceRow[]};
type Port={one:(sql:string,...args:SQLInputValue[])=>Row|undefined;all:(sql:string,...args:SQLInputValue[])=>Row[];run:(sql:string,...args:SQLInputValue[])=>unknown;tx:<T>(work:()=>T)=>T;clock:()=>number};
const fail=(message:string)=>{throw new LocalPaidError("LEGACY_RESTORE_CONFLICT",message,409);};
const text=(value:unknown)=>typeof value==="string" ? value : "";
const date=(value:unknown)=>{const d=new Date(text(value));if(!Number.isFinite(d.getTime()))fail("历史记录时间无效。");return d.toISOString();};
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function restoreLegacyHistory(db:Port,s:LegacySnapshot,jobId:string,dryRun:boolean) {
  if(s?.format!=="flora-legacy-v1" || s.sourceProject!=="pgivpvywizvtxjgqkvya" || !/^[a-f0-9-]{36}$/i.test(s.user?.id||"") || !s.user?.email_confirmed_at || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.user?.email||""))fail("历史来源或账号身份无效。");
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(jobId))fail("恢复批次标识无效。");
  for(const key of ["projects","readings","cards","messages"] as const)if(!Array.isArray(s[key]) || s[key].length>5000)fail("历史数据格式或数量无效。");
  const uid=s.user.id,email=s.user.email.toLowerCase(),sourceHash=hash(s);
  const projects=new Map(s.projects.map(r=>[text(r.id),r])),readings=new Map(s.readings.map(r=>[text(r.id),r]));
  for(const items of [s.projects,s.readings,s.cards,s.messages])if(new Set(items.map(r=>r.id)).size!==items.length)fail("历史数据有重复标识。");
  for(const p of s.projects){if(p.user_id!==uid || !p.id || !text(p.title))fail("项目不属于目标账号或内容无效。");date(p.created_at);date(p.updated_at);date(p.last_opened_at);}
  for(const r of s.readings){
    if(r.user_id!==uid || !projects.has(text(r.project_id)) || r.status!=="completed" || !text(r.question) || !text(r.interpretation) || !["three_card","five_card_linear"].includes(text(r.spread_type)))fail("解读归属、完成状态或牌阵无效。");
    date(r.created_at);if(r.completed_at)date(r.completed_at);
    const cards=s.cards.filter(c=>c.reading_id===r.id);
    if(cards.length!==(r.spread_type==="three_card"?3:5) || cards.some(c=>!lenormandCards.some(card=>card.slug===c.card_slug)))fail("历史抽牌不完整或牌号无效。");
  }
  for(const c of s.cards)if(!readings.has(text(c.reading_id)))fail("抽牌没有对应的目标账号解读。");
  for(const m of s.messages){if(m.user_id!==uid || !readings.has(text(m.reading_id)) || readings.get(text(m.reading_id))!.project_id!==m.project_id || !["user","assistant"].includes(text(m.role)) || !text(m.content))fail("追问归属或格式无效。");date(m.created_at);}
  const financial=()=>({balance:db.one("SELECT coalesce(sum(quantity-reserved-consumed-revoked),0) available,coalesce(sum(reserved),0) reserved,coalesce(sum(consumed),0) consumed FROM credit_batches WHERE user_id=?",uid),batches:Number(db.one("SELECT count(*) n FROM credit_batches WHERE user_id=?",uid)?.n),ledger:Number(db.one("SELECT count(*) n FROM credit_ledger WHERE user_id=?",uid)?.n),checkIns:Number(db.one("SELECT count(*) n FROM daily_check_ins WHERE user_id=?",uid)?.n),redemptions:Number(db.one("SELECT count(*) n FROM local_recharge_codes WHERE redeemed_by=?",uid)?.n)});
  return db.tx(()=>{
    const account=db.one("SELECT id,label FROM local_users WHERE id=?",uid);
    if(account && String(account.label).toLowerCase()!==email)fail("新站账号与旧账号邮箱不一致。");
    for(const p of s.projects){const existing=db.one("SELECT user_id FROM local_projects WHERE id=?",text(p.id));if(existing && existing.user_id!==uid)fail("项目 ID 已属于其他账号，恢复已停止。");}
    for(const r of s.readings){const existing=db.one("SELECT user_id FROM paid_readings WHERE id=?",text(r.id));if(existing && existing.user_id!==uid)fail("解读 ID 已属于其他账号，恢复已停止。");}
    const sourceCounts={projects:s.projects.length,readings:s.readings.length,cards:s.cards.length,messages:s.messages.length};
    const missing={projects:s.projects.filter(p=>!db.one("SELECT id FROM local_projects WHERE id=?",text(p.id))).length,readings:s.readings.filter(r=>!db.one("SELECT id FROM paid_readings WHERE id=?",text(r.id))).length};
    const before=financial();
    if(dryRun)return {dryRun:true,userId:uid,email,sourceHash,sourceCounts,missing,financial:before};
    db.run("CREATE TABLE IF NOT EXISTS legacy_restore_jobs(job_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,source_hash TEXT NOT NULL,receipt_json TEXT NOT NULL,created_at TEXT NOT NULL)");
    const old=db.one("SELECT user_id,source_hash,receipt_json FROM legacy_restore_jobs WHERE job_id=?",jobId);
    if(old){if(old.user_id!==uid || old.source_hash!==sourceHash)fail("恢复批次已用于不同数据。");return {...JSON.parse(String(old.receipt_json)),alreadyRestored:true};}
    const now=new Date(db.clock()).toISOString();
    db.run("INSERT OR IGNORE INTO local_users(id,label,kind,created_at) VALUES(?,?,'legacy',?)",uid,email,now);
    for(const p of s.projects)db.run("INSERT OR IGNORE INTO local_projects(id,user_id,title,background,memory_summary,created_at,updated_at,last_opened_at) VALUES(?,?,?,?,?,?,?,?)",text(p.id),uid,text(p.title),text(p.background),text(p.memory_summary),date(p.created_at),date(p.updated_at),date(p.last_opened_at));
    for(const r of s.readings){
      if(db.one("SELECT id FROM paid_readings WHERE id=?",text(r.id)))continue;
      const originalCards=s.cards.filter(c=>c.reading_id===r.id).sort((a,b)=>Number(a.card_number)-Number(b.card_number));
      const cards=originalCards.map(c=>{const card=lenormandCards.find(x=>x.slug===c.card_slug)!;return {number:card.number,slug:card.slug,nameEn:text(c.name_en),nameZh:text(c.name_zh),position:text(c.position)};});
      const messages=s.messages.filter(m=>m.reading_id===r.id);
      const result={conclusion:text(r.core_conclusion),interpretation:text(r.interpretation),advice:"",uncertainty:text(r.uncertainty),model:text(r.generation_model)||"legacy_restored",promptVersion:"legacy-restored-v1",legacy:{sourceRecord:r,sourceCards:originalCards,messages}};
      db.run("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,state,result_json,created_at,choices_json) VALUES(?,?,?,?,?,?,'completed',?,?,'[]')",text(r.id),uid,`legacy:supabase:${r.id}`,text(r.question),text(r.spread_type),JSON.stringify(cards),JSON.stringify(result),date(r.created_at));
      db.run("INSERT INTO local_reading_projects(reading_id,project_id) VALUES(?,?)",text(r.id),text(r.project_id));
    }
    if(hash(before)!==hash(financial()))fail("恢复不得变更花瓣、签到或充值，事务已撤回。");
    let verified=0;
    for(const r of s.readings){
      const saved=db.one("SELECT question,result_json FROM paid_readings WHERE id=? AND user_id=?",text(r.id),uid)!;
      const result=JSON.parse(String(saved.result_json||"null"));
      if(result?.legacy && hash(result.legacy.sourceRecord)===hash(r) && hash(result.legacy.sourceCards)===hash(s.cards.filter(c=>c.reading_id===r.id).sort((a,b)=>Number(a.card_number)-Number(b.card_number))) && hash(result.legacy.messages)===hash(s.messages.filter(m=>m.reading_id===r.id)) && saved.question===r.question)verified++;
    }
    const receipt={jobId,userId:uid,email,sourceHash,sourceCounts,inserted:missing,preservedExisting:{projects:s.projects.length-missing.projects,readings:s.readings.length-missing.readings},verifiedReadings:verified,financialUnchanged:true,createdAt:now};
    db.run("INSERT INTO legacy_restore_jobs VALUES(?,?,?,?,?)",jobId,uid,sourceHash,JSON.stringify(receipt),now);
    return receipt;
  });
}
