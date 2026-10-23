import {createHmac,timingSafeEqual} from "node:crypto";
import {LocalPaidError} from "../../lib/paid-local/guard";
import type {LegacySnapshot} from "../../lib/paid-local/legacy-restore";
export type RestoreJob={purpose:"flora-legacy-restore-v1";jobId:string;expiresAt:number;mode:"inspect"|"apply";expectedUserId:string;expectedEmail:string;snapshot:LegacySnapshot};
export async function verifyRestoreJob(request:Pick<Request,"method"|"headers"|"text">,key:string):Promise<RestoreJob> {
  const denied=()=>{throw new LocalPaidError("FORBIDDEN","维护请求无效或已过期。",403);};
  if(request.method!=="POST" || Number(request.headers.get("content-length")||0)>2_000_000)denied();
  const body=await request.text(),signature=request.headers.get("x-flora-restore-signature")||"";
  if(body.length>2_000_000 || !/^[a-f0-9]{64}$/.test(signature))denied();
  const expected=createHmac("sha256",key).update("flora-legacy-maintenance:v1\n"+body).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))denied();
  let job:RestoreJob;try{job=JSON.parse(body);}catch{return denied();}
  if(job.purpose!=="flora-legacy-restore-v1" || !["inspect","apply"].includes(job.mode) || !Number.isSafeInteger(job.expiresAt) || job.expiresAt<Date.now() || job.expiresAt>Date.now()+30*60_000 || job.expectedUserId!==job.snapshot?.user?.id || job.expectedEmail?.toLowerCase()!==job.snapshot?.user?.email?.toLowerCase())denied();
  return job;
}
