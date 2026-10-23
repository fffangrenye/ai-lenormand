import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { GoofishError, GoofishOrderClient, signGoofish, signVirtualSource, verifyVirtualRequest, verifyRechargeDelivery, type VerifiedOrder } from "../payments/goofish";
import { receiveXianyuRecharge } from "../payments/xianyu-recharge";
import { XianyuGateway } from "../payments/xianyu-gateway";
import { PaidLocalStore } from "../paid-local/store";

const config = { appId:"677859093659717", appSecret:"wK63PxlOBaY9NoqMksLeZySzGIW25ifA", merchantId:"100", merchantSecret:"o9wl81dncmvby3ijpq7eur456zhgtaxs" };
const now = 1792638000000;
const code = (name: string) => (e: unknown) => e instanceof GoofishError && e.code === name;
function query(body: string, timestamp = Math.floor(now/1000)) { return new URLSearchParams({mch_id:config.merchantId,timestamp:String(timestamp),sign:signVirtualSource(body,timestamp,config)}); }
const order: VerifiedOrder = { orderNo:"2226688164543566229",orderType:8,state:12,paidCents:1499,paidAt:Math.floor(now/1000),refundState:0,refundedCents:0,sellerIdentity:"seller-immutable",productId:"123456789",itemId:"659437081448",quantity:1,updatedAt:Math.floor(now/1000) };
const recharge = (account = "FL" + "A".repeat(32), provider = "1929063817978999932", external = order.orderNo) => ({order_no:provider,biz_order_no:external,goods_no:"flora-five-regular",buy_quantity:1,biz_content:{account},max_amount:1499,product_id:123456789,item_id:659437081448});

test("Xianyu signatures match official vectors and reject tampering, stale requests and duplicate query parameters", () => {
  assert.equal(signGoofish('{"product_id":"219530767978565"}',1636087298,{appId:"203413189371893",appSecret:"o9wl81dncmvby3ijpq7eur456zhgtaxs"}),"c26c8a48809141f3dd80bd9b9ddb41ea");
  assert.equal(signVirtualSource('{"goods_type":1,"goods_no":"12344532"}',1724414553,config),"f8677927fd8421a75718e8cfaaf92221");
  const raw = JSON.stringify(recharge());
  assert.deepEqual(verifyVirtualRequest(raw,query(raw),config,now),recharge());
  assert.throws(() => verifyVirtualRequest(raw+" ",query(raw),config,now),code("INVALID_SIGNATURE"));
  assert.throws(() => verifyVirtualRequest(raw,query(raw),config,now+301000),code("EXPIRED_SIGNATURE"));
  const duplicate = query(raw); duplicate.append("mch_id","attacker");
  assert.throws(() => verifyVirtualRequest(raw,duplicate,config,now),code("INVALID_SIGNATURE"));
  const invalid = query(raw); invalid.set("sign","not-hex");
  assert.throws(() => verifyVirtualRequest(raw,invalid,config,now),code("INVALID_SIGNATURE"));
  const array = "[]";
  assert.throws(() => verifyVirtualRequest(array,query(array),config,now),code("INVALID_BODY"));
});

test("Xianyu real query uses only official HTTPS host, signed raw body, no redirects and strips buyer data", async () => {
  const fetcher: typeof fetch = async (input,init) => {
    const url = new URL(String(input));
    assert.equal(url.origin,"https://open.goofish.pro"); assert.equal(url.pathname,"/api/open/order/detail");
    assert.equal(url.searchParams.get("appid"),config.appId); assert.equal(init?.redirect,"error");
    assert.equal(url.searchParams.get("sign"),signGoofish(String(init?.body),Math.floor(now/1000),config));
    assert.equal(init?.body,JSON.stringify({order_no:order.orderNo}));
    return Response.json({code:0,data:{order_no:order.orderNo,order_type:8,order_status:12,pay_amount:1499,pay_time:order.paidAt,refund_status:0,refund_amount:0,seller_eid:order.sellerIdentity,update_time:order.updatedAt,receiver_mobile:"private-phone",goods:{quantity:1,product_id:123456789,item_id:659437081448}}});
  };
  assert.deepEqual(await new GoofishOrderClient(config,fetcher,()=>now).order(order.orderNo),order);
  await assert.rejects(new GoofishOrderClient(config,fetcher).order("https://attacker.invalid"),code("INVALID_ORDER_NUMBER"));
  await assert.rejects(new GoofishOrderClient(config,async()=>{throw new Error("secret query URL");}).order(order.orderNo),e => e instanceof GoofishError && e.message === "ORDER_QUERY_UNAVAILABLE");
  await assert.rejects(new GoofishOrderClient(config,async()=>Response.json({code:401,msg:"private detail"})).order(order.orderNo),code("ORDER_QUERY_REJECTED"));
  await assert.rejects(new GoofishOrderClient(config,async()=>Response.json({code:0,data:{}})).order(order.orderNo),code("INVALID_ORDER_RESPONSE"));
});

test("Xianyu payment verification refuses unpaid, refunds, wrong products, quantities and merchant cost as proof", () => {
  const expected = {orderNo:order.orderNo,accountCode:"FL"+"A".repeat(32),goodsNo:"flora-five-regular",sellerIdentity:order.sellerIdentity,productId:order.productId,itemId:order.itemId,amountCents:1499};
  assert.equal(verifyRechargeDelivery(recharge(),order,expected).xianyuOrderNo,order.orderNo);
  for (const patch of [{state:11},{state:24},{state:23},{paidAt:0},{refundState:1},{refundState:5},{refundedCents:1},{paidCents:1},{quantity:2},{sellerIdentity:"other"},{productId:"111"},{orderType:1}]) {
    assert.throws(()=>verifyRechargeDelivery(recharge(),{...order,...patch},expected));
  }
  assert.throws(()=>verifyRechargeDelivery({...recharge(),max_amount:1499},{...order,paidCents:1},expected),code("PAYMENT_AMOUNT_MISMATCH"));
  assert.throws(()=>verifyRechargeDelivery(recharge("FL"+"B".repeat(32)),order,expected),code("RECHARGE_BINDING_MISMATCH"));
});

test("Xianyu gateway never queries or grants on forged events; query failures remain retryable", async () => {
  const raw = JSON.stringify(recharge()); let granted = 0, queried = 0;
  const client = new GoofishOrderClient(config,async()=>{queried++;throw new Error("unavailable");});
  const settle = () => { granted++;return {state:"granted",duplicate:false}; };
  await assert.rejects(receiveXianyuRecharge({rawBody:raw,query:new URLSearchParams(),credentials:config,client,settle,now}),code("INVALID_SIGNATURE"));
  assert.equal(queried,0);
  await assert.rejects(receiveXianyuRecharge({rawBody:raw,query:query(raw),credentials:config,client,settle,now}),code("ORDER_QUERY_UNAVAILABLE"));
  assert.equal(granted,0);
});

test("Xianyu fixed-price settlement grants once across restart and works after another purchase", async () => {
  const saved = {...process.env}, file = path.join(process.cwd(),".local-paid",`xianyu-${randomUUID()}.sqlite`);
  Object.assign(process.env,{NODE_ENV:"test",PAID_LOCAL_MODE:"1",PAID_LOCAL_MODEL:"mock",PAID_LOCAL_DB:file,NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:9",SUPABASE_SERVICE_ROLE_KEY:"",DEEPSEEK_API_KEY:""});
  let time=now, store = new PaidLocalStore(file,()=>time);
  const product = {packageId:"five",firstPurchase:false,goodsNo:"flora-five-regular",sellerIdentity:order.sellerIdentity,productId:order.productId,itemId:order.itemId};
  try {
    const user = store.login("new").userId, other=store.login("other").userId;
    const pending=store.xianyu.prepare(user,"five",randomUUID(),[product]); const raw=recharge(pending.accountCode);
    assert.equal(pending.amountCents,1499); assert.equal(store.overview(user).balance.available,1);
    assert.throws(()=>store.xianyu.order(other,pending.id),code("NOT_FOUND"));
    assert.throws(()=>store.xianyu.settle(raw,{...order,paidCents:1},[product]),code("PAYMENT_AMOUNT_MISMATCH"));
    assert.equal(store.xianyu.settle(raw,order,[product]).state,"granted");
    assert.equal(store.overview(user).balance.available,6);
    assert.equal(store.payments.catalog(user).firstPurchaseEligible,false);
    store.close(); store=new PaidLocalStore(file,()=>time);
    assert.equal(store.xianyu.settle(raw,order,[product]).duplicate,true);
    assert.equal(store.overview(user).balance.available,6);
    const conflict={...raw,order_no:"1929063817978999933"};
    assert.throws(()=>store.xianyu.settle(conflict,order,[product]),code("RECHARGE_ALREADY_CLAIMED"));
    const db=new DatabaseSync(file);
    assert.equal(db.prepare("SELECT count(*) n FROM local_xianyu_deliveries").get()?.n,1);
    assert.equal(JSON.stringify(db.prepare("SELECT * FROM local_xianyu_intents").all()).includes(pending.accountCode),false); db.close();
    const quote=store.xianyu.prepare(other,"five",randomUUID(),[product]);
    const mock=store.payments.create(other,{packageId:"single",channel:"waffo",requestKey:randomUUID()});
    store.payments.simulate(other,mock.id,"success");
    assert.equal(store.xianyu.settle(recharge(quote.accountCode,"1929063817978999934","2226688164543566230"),{...order,orderNo:"2226688164543566230"},[product]).state,"granted");
    assert.equal(store.overview(other).balance.available,7);
    const late=store.login("legacy").userId, lateQuote=store.xianyu.prepare(late,"five",randomUUID(),[product]);
    time+=31*60000;
    assert.equal(store.xianyu.settle(recharge(lateQuote.accountCode,"1929063817978999935","2226688164543566231"),{...order,orderNo:"2226688164543566231"},[product]).state,"review");
    assert.equal(store.overview(late).balance.available,1);
    const gateway=new XianyuGateway({credentials:config,products:[product],allowRecharge:false},store.xianyu,new GoofishOrderClient(config,async()=>{throw new Error("must not call in handshake-only mode");}),()=>time);
    assert.equal((await gateway.handle(new Request("http://127.0.0.1:3102/admin",{method:"POST"}))).status,404);
    assert.equal((await gateway.handle(new Request("http://127.0.0.1:3102/goofish/user/info"))).status,405);
    const unsigned=await gateway.handle(new Request("http://127.0.0.1:3102/goofish/user/info",{method:"POST",body:"{}"}));
    assert.equal(((await unsigned.json()) as {code:number}).code,401);
    const request = (endpoint:string,body:unknown) => {
      const text=JSON.stringify(body), params=query(text,Math.floor(time/1000));
      return new Request(`http://127.0.0.1:3102/goofish/${endpoint}?${params}`,{method:"POST",body:text});
    };
    const platform=await (await gateway.handle(request("open/info",{}))).json() as {data:{app_id:number}};
    assert.equal(platform.data.app_id,Number(config.appId));
    const catalogue=await (await gateway.handle(request("goods/list",{page_no:1,page_size:100}))).json() as {data:{count:number;list:{price:number}[]}};
    assert.equal(catalogue.data.count,3);
    assert.deepEqual(catalogue.data.list.map((x:{price:number})=>x.price),[499,1499,2499]);
    const disabled=await (await gateway.handle(request("order/recharge/create",raw))).json() as {code:number};
    assert.equal(disabled.code,1);
    assert.equal(store.overview(user).balance.available,6);
    assert.equal(JSON.stringify(platform).includes(config.appSecret),false);
  } finally {
    store.close(); for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key]; Object.assign(process.env,saved);
    for(const suffix of ["","-wal","-shm"]) rmSync(file+suffix,{force:true});
  }
});

test("Xianyu complete signed delivery and refund flow protects other credits, active readings and stale state", async()=>{
  const saved={...process.env},file=path.join(process.cwd(),".local-paid",`xianyu-refund-${randomUUID()}.sqlite`);
  Object.assign(process.env,{NODE_ENV:"test",PAID_LOCAL_MODE:"1",PAID_LOCAL_MODEL:"mock",PAID_LOCAL_DB:file,NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:9",SUPABASE_SERVICE_ROLE_KEY:"",DEEPSEEK_API_KEY:""});
  const store=new PaidLocalStore(file,()=>now),db=new DatabaseSync(file);
  const product={packageId:"five",firstPurchase:false,goodsNo:"flora-five-regular",sellerIdentity:order.sellerIdentity,productId:order.productId,itemId:order.itemId};
  try{
    const user=store.login("new").userId,other=store.login("other").userId,key=randomUUID();
    const checkout=store.xianyu.prepare(user,"five",key,[product]);
    assert.equal(store.xianyu.prepare(user,"five",key,[product]).accountCode,checkout.accountCode);
    assert.throws(()=>store.xianyu.prepare(user,"ten",key,[product]),code("REQUEST_CONFLICT"));
    assert.throws(()=>store.xianyu.order(other,checkout.id),code("NOT_FOUND"));
    const client=new GoofishOrderClient(config,async()=>Response.json({code:0,data:{order_no:order.orderNo,order_type:8,order_status:12,pay_amount:1499,pay_time:order.paidAt,refund_status:0,refund_amount:0,seller_eid:order.sellerIdentity,update_time:order.updatedAt,goods:{quantity:1,product_id:123456789,item_id:659437081448}}}),()=>now);
    const gateway=new XianyuGateway({credentials:config,products:[product],allowRecharge:true},store.xianyu,client,()=>now);
    const raw=JSON.stringify(recharge(checkout.accountCode));
    const request=()=>new Request(`http://127.0.0.1:3102/goofish/order/recharge/create?${query(raw)}`,{method:"POST",body:raw});
    const success=await (await gateway.handle(request())).json() as {code:number;data:{order_status:number}};
    assert.equal(success.code,0);assert.equal(success.data.order_status,20);
    assert.equal(store.overview(user).balance.available,6);
    await gateway.handle(request());assert.equal(store.overview(user).balance.available,6);
    const batch=db.prepare("SELECT batch_id FROM local_xianyu_deliveries").get()!.batch_id;
    db.prepare("UPDATE credit_batches SET consumed=2,reserved=1 WHERE id=?").run(batch!);
    const pending={...order,refundState:1,updatedAt:order.updatedAt+1};
    let result=store.xianyu.syncRefund(pending);
    assert.equal(result.heldCredits,2);assert.equal(result.refundReview,true);assert.equal(store.overview(user).balance.available,1);
    const count=db.prepare("SELECT count(*) n FROM credit_ledger").get()!.n;
    store.xianyu.syncRefund(pending);assert.equal(db.prepare("SELECT count(*) n FROM credit_ledger").get()!.n,count);
    db.prepare("UPDATE credit_batches SET reserved=0 WHERE id=?").run(batch!);
    result=store.xianyu.syncRefund({...pending,updatedAt:order.updatedAt+2});
    assert.equal(result.heldCredits,3);assert.equal(store.overview(user).balance.available,1);
    result=store.xianyu.syncRefund({...order,refundState:4,updatedAt:order.updatedAt+3});
    assert.equal(result.heldCredits,0);assert.equal(store.overview(user).balance.available,4);
    result=store.xianyu.syncRefund({...order,refundState:5,refundedCents:150,updatedAt:order.updatedAt+4});
    assert.equal(result.refundedCredits,1);assert.equal(store.overview(user).balance.available,3);
    assert.throws(()=>store.xianyu.syncRefund({...order,refundState:1,updatedAt:order.updatedAt+2}),code("STALE_REFUND_RESPONSE"));
    assert.throws(()=>store.xianyu.syncRefund({...order,sellerIdentity:"other"}),code("REFUND_ORDER_MISMATCH"));
    result=store.xianyu.syncRefund({...order,refundState:5,refundedCents:1499,state:23,updatedAt:order.updatedAt+5});
    assert.equal(result.refundedCredits,3);assert.equal(result.refundReview,true);assert.equal(store.overview(user).balance.available,1);
    store.xianyu.syncRefund({...order,refundState:5,refundedCents:1499,state:23,updatedAt:order.updatedAt+5});
    assert.equal(store.overview(user).balance.available,1);assert.equal(store.payments.catalog(user).firstPurchaseEligible,false);
    assert.equal(store.overview(other).balance.available,1);
    const cancelled=store.xianyu.prepare(other,"five",randomUUID(),[product]);
    assert.throws(()=>store.xianyu.cancel(user,cancelled.id),code("NOT_FOUND"));
    assert.equal(store.xianyu.cancel(other,cancelled.id).state,"expired");
    assert.equal(store.xianyu.settle(recharge(cancelled.accountCode,"1929063817978999940","2226688164543566240"),{...order,orderNo:"2226688164543566240"},[product]).state,"review");
    assert.equal(store.overview(other).balance.available,1);
    // The real gateway remains disabled; the enabled gateway above exists only
    // in this in-process fixture and never uses real credentials or a network.
  }finally{db.close();store.close();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);for(const suffix of ["","-wal","-shm"])rmSync(file+suffix,{force:true});}
});
