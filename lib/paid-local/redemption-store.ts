import { createHash, createHmac, randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import { localAdminKey } from "./admin-auth";
import { paidConfig, packagePrice } from "./config";
import { LocalPaidError } from "./guard";

type Row = Record<string, string | number | null>;
type Port = {
  one: (sql: string, ...params: SQLInputValue[]) => Row | undefined;
  all: (sql: string, ...params: SQLInputValue[]) => Row[];
  run: (sql: string, ...params: SQLInputValue[]) => unknown;
  tx: <T>(work: () => T) => T; clock: () => number;
  grant: (user: string, count: number, source: string, event: string, reason?: string) => string;
  ledger: (user: string, batch: string, event: string, kind: string, available: number, reserved: number, consumed: number, reason: string) => void;
};
const digest = (code: string) => createHash("sha256").update(code).digest("hex");
const invalid = () => new LocalPaidError("INVALID_RECHARGE_CODE", "充值码无效、已停用或已被使用，请核对后重试。", 409);
// LOCAL is part of the code: these isolated preview vouchers cannot be confused
// with future production stock. Plaintext codes never enter the database or logs.
export class LocalRedemptions {
  constructor(private readonly db: Port, private readonly config = { key: localAdminKey, prefix: "FLLOCAL" }) {}
  private now() { return new Date(this.db.clock()).toISOString(); }
  private raw(id: string) { return `${this.config.prefix}-${createHmac("sha256",this.config.key()).update(`flora-voucher:v1:${id}`).digest("hex").slice(0,32).toUpperCase()}`; }
  private key(value: string) { if (!/^[a-zA-Z0-9_-]{8,100}$/.test(value)) throw new LocalPaidError("INVALID_REQUEST_KEY","请求标识无效，请刷新后重试。"); }
  private reason(value: string) { if (!value.trim() || value.trim().length>300) throw new LocalPaidError("REASON_REQUIRED","请填写不超过 300 字的操作原因。"); return value.trim(); }
  private balance(user: string) {
    const r=this.db.one("SELECT coalesce(sum(quantity-reserved-consumed-revoked),0) available,coalesce(sum(reserved),0) reserved,coalesce(sum(consumed),0) consumed FROM credit_batches WHERE user_id=?",user)!;
    return {available:Number(r.available),reserved:Number(r.reserved),consumed:Number(r.consumed)};
  }
  private receipt(row: Row) {
    return {id:String(row.id),codeSuffix:String(row.suffix),credits:Number(row.credits),priceCents:Number(row.price_cents),redeemedAt:String(row.redeemed_at),state:String(row.state),refundedCredits:Number(row.refunded_credits),refundReview:Boolean(row.refund_review),returnPath:String(row.return_path),readingId:row.reading_id as string|null};
  }
  createBatch(actor: string, packageId: string, quantity: number, requestKey: string, note: string) {
    this.key(requestKey); const reason=this.reason(note);
    if (!Number.isInteger(quantity) || quantity<1 || quantity>500) throw new LocalPaidError("INVALID_QUANTITY","每批可生成 1～500 个充值码。");
    if (!paidConfig.packages.some(x=>x.id===packageId)) throw new LocalPaidError("INVALID_PACKAGE","套餐不存在。");
    return this.db.tx(()=>{
      const old=this.db.one("SELECT * FROM local_code_batches WHERE request_key=?",requestKey);
      if (old) {
        if(old.package_id!==packageId || Number(old.quantity)!==quantity || old.reason!==reason || old.actor!==actor) throw new LocalPaidError("REQUEST_CONFLICT","同一次生成请求不能修改套餐、数量或原因。",409);
        return {id:String(old.id),quantity:Number(old.quantity)};
      }
      const price=packagePrice(packageId),id=randomUUID();
      this.db.run("INSERT INTO local_code_batches VALUES(?,?,?,?,?,?,?,?,?)",id,requestKey,packageId,price.credits,price.amountCents,quantity,actor,reason,this.now());
      for(let n=0;n<quantity;n++) {const codeId=randomUUID(),code=this.raw(codeId);this.db.run("INSERT INTO local_recharge_codes(id,code_batch_id,code_hash,suffix,state) VALUES(?,?,?,?,'active')",codeId,id,digest(code),code.slice(-6));}
      this.audit(actor,"generate",id,requestKey,reason);
      return {id,quantity};
    });
  }
  exportBatch(actor: string, id: string, requestKey: string, note: string) {
    this.key(requestKey);const reason=this.reason(note);
    return this.db.tx(()=>{
      const batch=this.db.one("SELECT * FROM local_code_batches WHERE id=?",id);
      if(!batch)throw new LocalPaidError("NOT_FOUND","充值码批次不存在。",404);
      const prior=this.db.one("SELECT * FROM local_code_audit WHERE request_key=?",requestKey);
      const earlierExport=this.db.one("SELECT created_at FROM local_code_audit WHERE action='export' AND target=? ORDER BY created_at LIMIT 1",id);
      if(prior && (prior.action!=="export" || prior.target!==id || prior.actor!==actor || prior.reason!==reason))throw new LocalPaidError("REQUEST_CONFLICT","请求已用于其他操作。",409);
      const codes=this.db.all("SELECT id,code_hash FROM local_recharge_codes WHERE code_batch_id=? AND state='active' ORDER BY rowid",id).map(row=>{
        const code=this.raw(String(row.id));if(digest(code)!==row.code_hash)throw new LocalPaidError("CODE_KEY_CHANGED","本地密钥与生成时不同，无法导出此批充值码。",409);return code;
      });
      if(!prior)this.audit(actor,"export",id,requestKey,reason);
      return {batchId:id,credits:Number(batch.credits),filename:`${this.config.prefix}-${batch.credits}petals-${id}.txt`,codes,localOnly:this.config.prefix==="FLLOCAL",previouslyExported:Boolean(earlierExport)};
    });
  }
  redeem(user: string, input: string, readingId?: string) {
    if(!this.db.one("SELECT id FROM local_users WHERE id=?",user))throw new LocalPaidError("UNAUTHORIZED","请先登录再兑换。",401);
    const normalized=input.trim().toUpperCase();
    // Commit attempts separately so a failed redeem cannot roll its throttle back.
    this.db.tx(()=>{
      this.db.run("DELETE FROM local_code_attempts WHERE created_at<=?",this.db.clock()-60000);
      if(Number(this.db.one("SELECT count(*) n FROM local_code_attempts WHERE user_id=?",user)?.n)>=10)throw new LocalPaidError("REDEEM_RATE_LIMIT","兑换尝试过于频繁，请一分钟后重试。",429);
      this.db.run("INSERT INTO local_code_attempts VALUES(?,?)",user,this.db.clock());
    });
    if(!new RegExp(`^${this.config.prefix}-[A-F0-9]{32}$`).test(normalized))throw invalid();
    return this.db.tx(()=>{
      const row=this.db.one("SELECT c.*,b.credits,b.price_cents FROM local_recharge_codes c JOIN local_code_batches b ON b.id=c.code_batch_id WHERE code_hash=?",digest(normalized));
      if(!row || row.state==='disabled' || row.state==='refunded')throw invalid();
      if(row.state==='redeemed') {
        if(row.redeemed_by!==user)throw invalid();
        return {receipt:this.receipt(row),balance:this.balance(user),alreadyRedeemed:true};
      }
      let returnPath="/profile";
      if(readingId) {
        const reading=this.db.one("SELECT r.id,p.project_id FROM paid_readings r LEFT JOIN local_reading_projects p ON p.reading_id=r.id WHERE r.user_id=? AND r.id=?",user,readingId);
        if(!reading)throw new LocalPaidError("NOT_FOUND","原解读不存在或不属于当前账号。",404);
        returnPath=reading.project_id ? `/deep/project/${encodeURIComponent(String(reading.project_id))}?view=history&reading=${encodeURIComponent(readingId)}#reading-${encodeURIComponent(readingId)}` : "/deep";
      }
      const batch=this.db.grant(user,Number(row.credits),"purchase",`redeem:card:${row.id}`,`闲鱼充值码兑换 ${row.credits} 花瓣 · 尾号 ${row.suffix}`);
      this.db.run("UPDATE local_recharge_codes SET state='redeemed',redeemed_by=?,credit_batch_id=?,redeemed_at=?,reading_id=?,return_path=? WHERE id=? AND state='active'",user,batch,this.now(),readingId||null,returnPath,row.id);
      const saved=this.db.one("SELECT c.*,b.credits,b.price_cents FROM local_recharge_codes c JOIN local_code_batches b ON b.id=c.code_batch_id WHERE c.id=?",row.id)!;
      return {receipt:this.receipt(saved),balance:this.balance(user),alreadyRedeemed:false};
    });
  }
  history(user: string) {
    return this.db.all("SELECT c.*,b.credits,b.price_cents FROM local_recharge_codes c JOIN local_code_batches b ON b.id=c.code_batch_id WHERE c.redeemed_by=? ORDER BY c.redeemed_at DESC,c.rowid DESC LIMIT 200",user).map(row=>this.receipt(row));
  }
  private audit(actor:string,action:string,target:string,key:string,reason:string) {this.db.run("INSERT INTO local_code_audit VALUES(?,?,?,?,?,?,?)",randomUUID(),actor,action,target,key,reason,this.now());}
  disable(actor:string,id:string,key:string,note:string) {
    this.key(key);const reason=this.reason(note);
    return this.db.tx(()=>{
      const old=this.db.one("SELECT * FROM local_code_audit WHERE request_key=?",key);
      if(old){if(old.action!=="disable"||old.target!==id||old.actor!==actor||old.reason!==reason)throw new LocalPaidError("REQUEST_CONFLICT","请求已用于其他操作。",409);return {ok:true};}
      const row=this.db.one("SELECT * FROM local_recharge_codes WHERE id=?",id);
      if(!row)throw new LocalPaidError("NOT_FOUND","充值码不存在。",404);
      if(row.state!=="active" && row.state!=="disabled")throw new LocalPaidError("CODE_ALREADY_REDEEMED","充值码已兑换，请用退款核对处理对应权益。",409);
      this.db.run("UPDATE local_recharge_codes SET state='disabled' WHERE id=?",id);this.audit(actor,"disable",id,key,reason);return {ok:true};
    });
  }
  recordRefund(actor:string,id:string,key:string,note:string) {
    this.key(key);const reason=this.reason(note);
    return this.db.tx(()=>{
      const old=this.db.one("SELECT * FROM local_code_audit WHERE request_key=?",key);
      if(old && (old.action!=="refund"||old.target!==id||old.actor!==actor||old.reason!==reason))throw new LocalPaidError("REQUEST_CONFLICT","请求已用于其他操作。",409);
      if(old)return {ok:true};
      const row=this.db.one("SELECT * FROM local_recharge_codes WHERE id=?",id);
      if(!row)throw new LocalPaidError("NOT_FOUND","充值码不存在。",404);
      // This records an operator-confirmed channel refund; never moves money.
      let revoked=Number(row.refunded_credits),review=false;
      if(row.credit_batch_id) {
        const batch=this.db.one("SELECT * FROM credit_batches WHERE id=?",row.credit_batch_id)!;
        const available=Number(batch.quantity)-Number(batch.reserved)-Number(batch.consumed)-Number(batch.revoked);
        if(available>0){this.db.run("UPDATE credit_batches SET revoked=revoked+? WHERE id=?",available,batch.id);this.db.ledger(String(row.redeemed_by),String(batch.id),`card-refund:${key}`,"card_refund",-available,0,0,`闲鱼卡密退款核对 · ${reason}`);revoked+=available;}
        review=Number(batch.quantity)>revoked;
      }
      this.db.run("UPDATE local_recharge_codes SET state='refunded',refunded_credits=?,refund_review=? WHERE id=?",revoked,Number(review),id);this.audit(actor,"refund",id,key,reason);return {ok:true};
    });
  }
  adminOverview() {
    return {
      batches:this.db.all("SELECT b.*,sum(c.state='active') available,sum(c.state='redeemed') redeemed,sum(c.state='disabled') disabled,sum(c.state='refunded') refunded,(SELECT min(a.created_at) FROM local_code_audit a WHERE a.action='export' AND a.target=b.id) exported_at FROM local_code_batches b JOIN local_recharge_codes c ON c.code_batch_id=b.id GROUP BY b.id ORDER BY b.created_at DESC,b.rowid DESC LIMIT 200").map(r=>({id:String(r.id),packageId:String(r.package_id),credits:Number(r.credits),priceCents:Number(r.price_cents),quantity:Number(r.quantity),available:Number(r.available),redeemed:Number(r.redeemed),disabled:Number(r.disabled),refunded:Number(r.refunded),reason:String(r.reason),createdAt:String(r.created_at),exportedAt:r.exported_at as string|null})),
      codes:this.db.all("SELECT c.*,b.credits FROM local_recharge_codes c JOIN local_code_batches b ON b.id=c.code_batch_id ORDER BY c.rowid DESC LIMIT 500").map(r=>({id:String(r.id),batchId:String(r.code_batch_id),suffix:String(r.suffix),credits:Number(r.credits),state:String(r.state),userId:r.redeemed_by as string|null,redeemedAt:r.redeemed_at as string|null,refundedCredits:Number(r.refunded_credits),refundReview:Boolean(r.refund_review)})),
      audit:this.db.all("SELECT * FROM local_code_audit ORDER BY created_at DESC,rowid DESC LIMIT 200").map(r=>({id:String(r.id),actor:String(r.actor),action:String(r.action),target:String(r.target),reason:String(r.reason),createdAt:String(r.created_at)}))
    };
  }
}
