type RateLimiter={limit(input:{key:string}):Promise<{success:boolean}>};
export type TrafficEnvironment={API_TRAFFIC?:RateLimiter;RECOVERY_TRAFFIC?:RateLimiter};
export async function guardApi(request:Request,env:TrafficEnvironment) {
  const url=new URL(request.url);
  const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"};
  const error=(code:string,message:string,status:number,extra?:Record<string,string>)=>Response.json({code,message},{status,headers:{...headers,...extra}});
  if(!["GET","POST"].includes(request.method))return error("METHOD_NOT_ALLOWED","请求方式不支持。",405,{Allow:"GET, POST"});
  if(request.method==="POST"){
    if(request.headers.get("origin")!==url.origin || !request.headers.get("content-type")?.startsWith("application/json"))return error("INVALID_ORIGIN","请从本站页面操作。",403);
    if(Number(request.headers.get("content-length")||0)>8000)return error("TOO_LARGE","请求内容过长。",413);
  }
  // Generous IP burst ceiling, in addition to the ledger's account limits.
  // Edge throttling is approximate and does not cap total billable requests.
  const limiter=url.pathname==="/api/auth/reset-password" ? env.RECOVERY_TRAFFIC : env.API_TRAFFIC;
  const ip=request.headers.get("cf-connecting-ip");
  if(limiter && ip && !(await limiter.limit({key:`flora-v3:${ip}`})).success)return error("RATE_LIMIT","请求过于频繁，请稍后再试。",429,{"Retry-After":"60"});
  return null;
}
const pages=new Set(["/","/daily","/yes-no","/deep","/login","/forgot-password","/reset-password","/profile","/recharge","/redeem","/knowledge","/oracle","/space","/admin/codes"]);
export function isApplicationPage(path:string) {
  return pages.has(path.replace(/\/$/,"")||"/") || /^\/deep\/project\/[a-f0-9-]{36}\/?$/i.test(path);
}
export function isPrivatePage(path:string) {
  return /^\/(?:api|admin|profile|login|forgot-password|reset-password|recharge|redeem|deep\/project)(?:\/|$)/.test(path);
}
