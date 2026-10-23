// New-domain app only. Legacy redirects use dedicated deployment configs.
// @ts-ignore OpenNext creates this module during the production build.
import nextWorker from "../../.open-next/worker.js";
import legalWorker from "../domain-info/worker.mjs";
import {guardApi,isApplicationPage,isPrivatePage,type TrafficEnvironment} from "./traffic";
import {socialPreview} from "./social";
type Env=TrafficEnvironment & {FLORA_API:{fetch(request:Request):Promise<Response>};ASSETS:{fetch(request:Request):Promise<Response>};[key:string]:unknown};
export default {
  async fetch(request:Request,env:Env,ctx:unknown){
    const url=new URL(request.url),path=url.pathname;
    // Incident switch: telemetry must not consume ledger capacity during recovery.
    if(path==="/api/flora/analytics" || path==="/api/analytics/event")return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
    if((path==="/api/flora" || path.startsWith("/api/flora/")) && Date.now()<Date.UTC(2026,9,24))return Response.json({code:"DATABASE_QUOTA_RESET",message:"今日数据库免费额度已用完，预计北京时间10月24日08:00重置。请届时刷新重试，账号、历史和花瓣仍然保留。"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"300"}});
    if((path==="/deep" || path.startsWith("/deep/project/")) && Date.now()<Date.UTC(2026,9,24))return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flora · 服务恢复中</title><body style="margin:0;background:#FBF8F0;color:#423835;font-family:serif"><main style="max-width:480px;margin:15vh auto;padding:30px;line-height:1.9"><p>FLORA LENORMAND</p><h1 style="font-size:26px">深度占卜暂时休息一下</h1><p>今日数据库免费额度已用完，预计北京时间10月24日08:00重置。账号、历史和花瓣均已保留。</p><p>我们已暂停重复请求，页面不会继续来回跳转。请在额度重置后刷新。</p><a style="color:#6E2638" href="/">返回首页</a>　<a style="color:#6E2638" href="/login">登录</a>　<a style="color:#6E2638" href="/yes-no">是与否</a></main></body></html>`,{headers:{"Content-Type":"text/html;charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY"}});
    if(url.protocol==="http:" && !["localhost","127.0.0.1"].includes(url.hostname)){url.protocol="https:";return Response.redirect(url.href,308);}
    if(url.hostname==="www.floralenormand.site" && ["GET","HEAD"].includes(request.method) && !path.startsWith("/api/")){url.hostname="floralenormand.site";return Response.redirect(url.href,308);}
    if(path.startsWith("/_next/static/") || path.startsWith("/cards/") || /\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?|txt|xml)$/.test(path))return env.ASSETS.fetch(request);
    if(["/terms","/privacy","/refunds","/contact","/pricing"].includes(path.replace(/\/$/,"")))return legalWorker.fetch(request);
    if(path==="/api/flora" || path.startsWith("/api/flora/") || path==="/api/auth/reset-password"){
      const rejection=await guardApi(request,env);if(rejection)return rejection;
      return env.FLORA_API.fetch(request);
    }
    // The app uses explicit JSON APIs; no Next Server Actions or HTML POSTs.
    if(!["GET","HEAD"].includes(request.method) || request.headers.has("Next-Action"))return new Response("Method not allowed",{status:405,headers:{Allow:"GET, HEAD","Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
    if(!isApplicationPage(path))return new Response("页面不存在。",{status:404,headers:{"Cache-Control":"public, max-age=60","X-Robots-Tag":"noindex, nofollow"}});
    const preview=socialPreview(request);if(preview)return preview;
    const response=await nextWorker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);
    // HTML must not keep references to chunks from a previous deployment.
    headers.set("Cache-Control","no-store");
    headers.set("X-Content-Type-Options","nosniff");
    headers.set("Referrer-Policy","strict-origin-when-cross-origin");
    headers.set("X-Frame-Options","DENY");
    if(isPrivatePage(path))headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
