import { paidConfig, packagePrice } from "../paid-local/config";
import type { LocalXianyuPayments, XianyuProduct } from "../paid-local/xianyu-store";
import { GoofishError, GoofishOrderClient, verifyVirtualRequest, type VirtualCredentials } from "./goofish";
import { receiveXianyuRecharge } from "./xianyu-recharge";

export type XianyuGatewayConfig = {
  credentials: VirtualCredentials;
  products: XianyuProduct[];
  // Handshake and catalogue can be tested without permitting any real grants.
  allowRecharge: boolean;
};
export class XianyuGateway {
  constructor(private readonly config: XianyuGatewayConfig, private readonly store: LocalXianyuPayments, private readonly client = new GoofishOrderClient(config.credentials), private readonly clock = Date.now) {}
  async handle(request: Request) {
    const json = (value: unknown) => Response.json(value,{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
    const ok = (data: unknown) => json({code:0,msg:"OK",data});
    if (request.method !== "POST") return new Response(null,{status:405,headers:{Allow:"POST"}});
    const url = new URL(request.url), route = url.pathname;
    // This dedicated server exposes neither the website nor its sessions/admin.
    if (!["/goofish/open/info","/goofish/user/info","/goofish/goods/list","/goofish/goods/detail","/goofish/order/recharge/create","/goofish/order/detail"].includes(route)) return new Response(null,{status:404});
    try {
      if (route === "/goofish/open/info") {
        const appId = Number(this.config.credentials.appId);
        if (!Number.isSafeInteger(appId) || appId <= 0) throw new GoofishError("INVALID_CONFIGURATION");
        return ok({app_id:appId});
      }
      // Read incrementally: content-length is not trustworthy on chunked bodies.
      const reader = request.body?.getReader(); let raw = "", size = 0;
      if (reader) {
        const decoder = new TextDecoder("utf-8",{fatal:true});
        try {
          while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 65536) { await reader.cancel(); throw new GoofishError("REQUEST_TOO_LARGE"); } raw += decoder.decode(part.value,{stream:true}); }
          raw += decoder.decode();
        } finally { reader.releaseLock(); }
      }
      const body = verifyVirtualRequest(raw,url.searchParams,this.config.credentials,this.clock());
      if (route === "/goofish/user/info") {
        // The self-operated supplier has no wholesale deposit. Official docs
        // require a positive integer here for a self-developed single merchant.
        return ok({balance:1000000});
      }
      const goods = paidConfig.packages.flatMap(item => (paidConfig.promotion.enabled ? [false,true] : [false]).map(first => {
        const price=packagePrice(item.id,new Date(this.clock()),paidConfig,first);
        return {goods_no:`flora-${item.id}-${first ? "first" : "regular"}`,goods_type:1,goods_name:`Flora 雷诺曼 AI 数字解读 · ${item.credits} 次${first ? "（首次充值专享）" : ""}`,price:price.amountCents,stock:99999,status:1,update_time:Math.floor(this.clock()/1000),template:[{code:"account",name:"网站充值码",desc:"请先在 floralenormand.site 登录并创建充值单，再复制该单充值码；请勿填写手机号或昵称。",check:0}]};
      }));
      if (route === "/goofish/goods/list") {
        if (!Number.isInteger(body.page_no) || Number(body.page_no) < 1 || !Number.isInteger(body.page_size) || Number(body.page_size)<1 || Number(body.page_size)>100 || (body.keyword !== undefined && typeof body.keyword !== "string")) throw new GoofishError("INVALID_BODY");
        const filtered=goods.filter(x => (body.goods_type === undefined || body.goods_type === x.goods_type) && (!body.keyword || x.goods_no === body.keyword || x.goods_name.includes(String(body.keyword))));
        const start=(Number(body.page_no)-1)*Number(body.page_size);
        return ok({list:filtered.slice(start,start+Number(body.page_size)),count:filtered.length});
      }
      if (route === "/goofish/goods/detail") {
        const item=goods.find(x=>body.goods_type === 1 && x.goods_no === body.goods_no);
        if (!item) return json({code:1100,msg:"商品不存在"});
        return ok(item);
      }
      if (route === "/goofish/order/detail") {
        if (body.order_type !== 1 || typeof body.order_no !== "string" || (body.out_order_no !== undefined && typeof body.out_order_no !== "string")) throw new GoofishError("INVALID_BODY");
        const external=this.store.externalOrderNo(body.order_no);
        this.store.syncRefund(await this.client.order(external));
        const item=this.store.delivery(body.order_no,body.out_order_no as string|undefined);
        return ok({...item,goods_name:goods.find(x=>x.goods_no === item.goods_no)?.goods_name || item.goods_no});
      }
      if (!this.config.allowRecharge) return json({code:1,msg:"当前仅开放接口联调，真实充值尚未启用"});
      const outcome=await receiveXianyuRecharge({rawBody:raw,query:url.searchParams,credentials:this.config.credentials,client:this.client,settle:(data,order)=>this.store.settle(data,order,this.config.products),now:this.clock()});
      const item=this.store.delivery(String(body.order_no));
      return ok({...item,goods_name:goods.find(x=>x.goods_no === item.goods_no)?.goods_name || item.goods_no,...(outcome.state === "review" ? {remark:"付款已记录，需核对充值单"} : {})});
    } catch (error) {
      const code=error instanceof GoofishError ? error.code : "GATEWAY_UNAVAILABLE";
      if (["INVALID_SIGNATURE","EXPIRED_SIGNATURE"].includes(code)) return json({code:code === "EXPIRED_SIGNATURE" ? 408 : 401,msg:"请求认证失败"});
      if (code === "NOT_FOUND") return json({code:1200,msg:"订单不存在"});
      if (code === "ORDER_QUERY_UNAVAILABLE" || code === "GATEWAY_UNAVAILABLE") return json({code:1209,msg:"暂未核实充值结果，请稍后查单"});
      return json({code:1,msg:"请求未通过充值校验，请核对商品和充值单"});
    }
  }
}
