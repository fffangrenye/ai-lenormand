import type { DatabaseSync } from "node:sqlite";
import { PaidLedger } from "../../lib/paid-local/ledger";
import { createCloudProvider } from "../../lib/paid-local/cloud-provider";
import { LocalPaidError, isLocalPaidError } from "../../lib/paid-local/guard";
import { cardCatalog } from "../../lib/paid-local/card-catalog";
import type { PaidSpread } from "../../lib/paid-local/types";
import { schema } from "./schema";
import { recoverPassword } from "./password-recovery";
import { ensureTelemetrySchema, readDailyReport, recordSiteEvent, SITE_HOST, type SiteEvent } from "./telemetry";
import {verifyRestoreJob} from "./legacy-maintenance";

type Environment = {
  LEDGER: {idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}};
  SUPABASE_URL:string; SUPABASE_ANON_KEY:string; AI_KEY:string; AI_MODEL:string;
  CODE_SIGNING_KEY:string; ADMIN_EMAILS:string; SALES_ENABLED?:string;
};
type Storage = {sql:{exec(query:string,...args:unknown[]):{toArray():Record<string,unknown>[]}};transactionSync<T>(work:()=>T):T};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function failure(error:unknown) {
  if(isLocalPaidError(error))return json({code:error.code,message:error.message},error.status);
  // Do not log request bodies, account details, vouchers or provider responses.
  console.error("Flora service failure",error instanceof Error ? error.name : "UnknownError");
  return json({code:"SERVICE_ERROR",message:"暂时无法完成操作，请稍后刷新原记录重试。"},503);
}
export default {
  async fetch(request:Request,env:Environment) {
    try {
      const path=new URL(request.url).pathname;
      // Private service-binding maintenance only. The public front Worker never
      // routes this path; signed, short-lived jobs also protect the private API.
      if(path==="/internal/legacy-restore"){
        await verifyRestoreJob(request.clone(),env.CODE_SIGNING_KEY);
        return env.LEDGER.get(env.LEDGER.idFromName("flora-v3-ledger-v1")).fetch(request);
      }
      if(new URL(request.url).pathname==="/api/auth/reset-password"){
        if(request.method!=="POST")return json({code:"METHOD_NOT_ALLOWED"},405);
        return recoverPassword(request,env);
      }
      if(path!=="/api/flora" && !path.startsWith("/api/flora/"))return json({code:"NOT_FOUND"},404);
      if(path==="/api/flora/analytics"){
        if(request.method!=="POST" || new URL(request.url).hostname!==SITE_HOST || request.headers.get("origin")!==`https://${SITE_HOST}`)return json({code:"FORBIDDEN"},403);
        const input=await request.json() as Partial<SiteEvent>;
        const allowed=new Set(["page_view","signup_clicked","signup_succeeded","signin_clicked","signin_succeeded","signin_failed","daily_draw","yes_no_submit","deep_start","deep_submit","save_cards","copy_prompt","share_clicked","follow_up_submit"]);
        if(!input || !allowed.has(String(input.name)) || !/^[a-f0-9-]{36}$/i.test(String(input.id||"")) || typeof input.visitorId!=="string" || input.visitorId.length>80)return json({code:"INVALID_EVENT"},400);
        let userId:string|null=null;
        const bearer=request.headers.get("authorization");
        if(bearer && /^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(bearer)){
          const checked=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:bearer},signal:AbortSignal.timeout(10000)});
          if(checked.ok){const user=await checked.json() as {id?:string};if(user.id && /^[a-f0-9-]{36}$/i.test(user.id))userId=user.id;}
        }
        const pathValue=typeof input.path==="string" && input.path.startsWith("/") ? input.path.split("?")[0].slice(0,120).replace(/\/deep\/project\/[a-f0-9-]{36}/ig,"/deep/project/:id") : "/";
        const event:SiteEvent={id:String(input.id),name:String(input.name),userId,visitorId:input.visitorId,sessionId:typeof input.sessionId==="string" ? input.sessionId.slice(0,80):null,path:pathValue,channel:typeof input.channel==="string" ? input.channel.slice(0,80):"unknown",host:SITE_HOST};
        return env.LEDGER.get(env.LEDGER.idFromName("flora-v3-ledger-v1")).fetch(new Request(request.url,{method:"POST",headers:{"x-flora-telemetry":"1","content-type":"application/json"},body:JSON.stringify(event)}));
      }
      const authorization=request.headers.get("authorization")||"";
      if(!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization))throw new LocalPaidError("UNAUTHORIZED","请先登录。",401);
      let response:Response;
      try { response=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:authorization},signal:AbortSignal.timeout(10000)}); }
      catch { throw new LocalPaidError("AUTH_UNAVAILABLE","登录服务暂时无法连接，请稍后再试。",503); }
      if(!response.ok)throw new LocalPaidError("UNAUTHORIZED","登录状态已过期，请重新登录。",401);
      const user=await response.json() as {id?:string;email?:string;email_confirmed_at?:string};
      if(!user.id || !/^[a-f0-9-]{36}$/i.test(user.id) || !user.email || !user.email_confirmed_at)throw new LocalPaidError("UNAUTHORIZED","请先完成邮箱验证并登录。",401);
      const headers=new Headers(request.headers);
      headers.set("x-flora-user",user.id);headers.set("x-flora-email",encodeURIComponent(user.email.toLowerCase()));
      // The ledger is only reachable through this authenticated service binding.
      return env.LEDGER.get(env.LEDGER.idFromName("flora-v3-ledger-v1")).fetch(new Request(request,{headers}));
    }catch(error){return failure(error);}
  }
};

export class FloraLedger {
  private store:PaidLedger;
  private rates=new Map<string,{at:number;n:number}>();
  constructor(private ctx:{storage:Storage},private env:Environment){
    const sql=ctx.storage.sql;
    if(!sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='local_schema_versions'").toArray().length)ctx.storage.transactionSync(()=>sql.exec(schema));
    ensureTelemetrySchema(sql);
    const db={prepare:(query:string)=>({all:(...args:unknown[])=>sql.exec(query,...args).toArray(),get:(...args:unknown[])=>sql.exec(query,...args).toArray()[0],run:(...args:unknown[])=>{sql.exec(query,...args).toArray();return{};}}),exec:(query:string)=>sql.exec(query).toArray(),close:()=>{}};
    if(!env.CODE_SIGNING_KEY || env.CODE_SIGNING_KEY.length<48)throw new Error("Missing voucher configuration");
    this.store=new PaidLedger(db as unknown as DatabaseSync,work=>ctx.storage.transactionSync(work),Date.now,{key:()=>env.CODE_SIGNING_KEY,prefix:"FLORA"});
  }
  async fetch(request:Request){
    try{
      if(new URL(request.url).pathname==="/api/flora/analytics" && request.headers.get("x-flora-telemetry")==="1"){
        recordSiteEvent(this.ctx.storage.sql,await request.json() as SiteEvent);
        return new Response(null,{status:204});
      }
      if(new URL(request.url).pathname==="/internal/legacy-restore"){
        const job=await verifyRestoreJob(request,this.env.CODE_SIGNING_KEY);
        return json(this.store.restoreLegacy(job.snapshot,job.jobId,job.mode==="inspect"));
      }
      const user=request.headers.get("x-flora-user")||"",email=decodeURIComponent(request.headers.get("x-flora-email")||"");
      if(!user || !email)throw new LocalPaidError("UNAUTHORIZED","请先登录。",401);
      const now=Date.now();
      this.rates.forEach((entry,id)=>{if(now-entry.at>=60000)this.rates.delete(id);});
      const rate=this.rates.get(user)||{at:now,n:0};rate.n++;this.rates.set(user,rate);
      if(rate.n>180)throw new LocalPaidError("RATE_LIMIT","操作太频繁，请稍后重试。",429);
      const url=new URL(request.url),parts=url.pathname.replace(/^\/api\/flora\/?/,"").split("/").filter(Boolean),action=parts.join("/"),store=this.store;
      const admin=action.startsWith("admin/");
      if(admin && !this.env.ADMIN_EMAILS?.split(",").map(x=>x.trim().toLowerCase()).includes(email))throw new LocalPaidError("FORBIDDEN","此页面仅限管理员访问。",403);
      if(admin && action==="admin/report" && request.method==="GET"){
        const date=url.searchParams.get("date")||new Date(Date.now()-8*3600_000).toISOString().slice(0,10);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new LocalPaidError("INVALID_DATE","日期格式不正确。",400);
        return json(readDailyReport(this.ctx.storage.sql,date));
      }
      store.ensureUser(user,email);
      if(request.method==="GET"){
        if(!action)return json(store.overview(user));
        if(action==="card-catalog")return json(cardCatalog(false,this.env.SALES_ENABLED==="1"));
        if(action==="redemptions")return json(store.redemptions.history(user));
        if(action==="orders")return json([]);
        if(action==="daily")return json(store.dailyCalendar(user,url.searchParams.get("month")||undefined));
        if(action==="admin/codes")return json(store.redemptions.adminOverview());
        if(parts[0]==="projects"){
          if(parts.length===1)return json(store.projects(user));
          if(parts.length===2)return json(store.project(user,parts[1]));
          if(parts[2]==="readings")return json(store.projectReadings(user,parts[1]));
          if(parts[2]==="draw-session")return json(store.pendingDrawSession(user,parts[1]));
        }
        if(parts[0]==="readings" && parts.length===2)return json(store.reading(user,parts[1]));
        if(parts[0]==="draw-sessions" && parts.length===2)return json(store.drawSession(user,parts[1]));
      }else if(request.method==="POST"){
        if(Number(request.headers.get("content-length")||0)>8000)throw new LocalPaidError("TOO_LARGE","请求过长。",413);
        const raw=await request.text();if(raw.length>8000)throw new LocalPaidError("TOO_LARGE","请求过长。",413);
        let input:Record<string,unknown>;try{input=JSON.parse(raw);}catch{throw new LocalPaidError("INVALID_JSON","请求格式不正确。");}
        if(!input || typeof input!=="object" || Array.isArray(input))throw new LocalPaidError("INVALID_JSON","请求格式不正确。");
        const field=(key:string)=>typeof input[key]==="string" ? input[key] as string : "";
        if(admin){
          if(action==="admin/codes/generate")return json(store.redemptions.createBatch(email,field("packageId"),Number(input.quantity),field("requestKey"),field("reason")));
          if(action==="admin/codes/export")return json(store.redemptions.exportBatch(email,field("batchId"),field("requestKey"),field("reason")));
          if(action==="admin/codes/disable")return json(store.redemptions.disable(email,field("codeId"),field("requestKey"),field("reason")));
          if(action==="admin/codes/refund")return json(store.redemptions.recordRefund(email,field("codeId"),field("requestKey"),field("reason")));
        }
        if(action==="redeem"){
          if(field("expectedUserId")!==user)throw new LocalPaidError("ACCOUNT_CHANGED","登录账号已变更，请刷新确认。",409);
          return json(store.redemptions.redeem(user,field("code"),field("readingId")||undefined));
        }
        if(action==="daily-check-in")return json(store.checkIn(user));
        if(action==="projects")return json(store.saveProject(user,{title:field("title"),background:field("background")}));
        if(action==="project-default")return json(store.ensureDefaultProject(user));
        if(action==="project-update")return json(store.saveProject(user,Object.fromEntries(["title","background","memorySummary"].filter(key=>typeof input[key]==="string").map(key=>[key,input[key]])),field("projectId")));
        if(action==="project-touch"){store.touchProject(user,field("projectId"));return json({ok:true});}
        if(action==="project-remove"){store.archiveProject(user,field("projectId"));return json({ok:true});}
        const choices=Array.isArray(input.choices) ? input.choices.filter((x):x is string=>typeof x==="string") : undefined;
        const drawInput={projectId:field("projectId"),question:field("question"),spread:field("spread") as PaidSpread,requestKey:field("requestKey"),choices};
        if(action==="draw-session")return json(store.startDrawSession(user,drawInput));
        if(action==="draw")return json(store.draw(user,drawInput));
        if(action==="draw-pick")return json(store.pickDrawCard(user,field("sessionId"),field("token"),Number(input.expectedCount)));
        if(action==="draw-abandon"){store.abandonDrawSession(user,field("sessionId"));return json({ok:true});}
        const provider=createCloudProvider({key:this.env.AI_KEY,model:this.env.AI_MODEL});
        if(action==="unlock"){
          const id=field("readingId"),reserved=store.reserveReading(user,id);
          if(!reserved.runId)return json(reserved.reading,reserved.reading.state==="generating"?202:200);
          try{const project=reserved.reading.projectId ? store.project(user,reserved.reading.projectId) : undefined;return json(store.completeReading(user,id,reserved.runId,await provider.generatePaidMain(reserved.reading,false,project)));}
          catch(error){store.releaseReading(user,id,reserved.runId);throw error;}
        }
        if(action==="follow-up"){
          const id=field("readingId"),reserved=store.reserveFollowUp(user,id,field("question"),field("requestKey"));
          if(!reserved.attempt)return json(reserved.reading);
          try{const project=reserved.reading.projectId ? store.project(user,reserved.reading.projectId) : undefined;return json(store.completeFollowUp(user,id,reserved.id,reserved.attempt,await provider.generatePaidFollowUp(reserved.reading,field("question"),false,project)));}
          catch(error){store.releaseFollowUp(user,id,reserved.id,reserved.attempt);throw error;}
        }
      }
      throw new LocalPaidError("NOT_FOUND","接口不存在。",404);
    }catch(error){return failure(error);}
  }
}
