import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {guardApi,isApplicationPage,isPrivatePage} from "../../workers/flora-site/traffic";
import {socialPreview} from "../../workers/flora-site/social";

test("API rejects cross-site writes and oversized payloads before touching auth or rate counters",async()=>{
  let calls=0;const env={API_TRAFFIC:{limit:async()=>{calls++;return {success:true};}}};
  const request=(headers:Record<string,string>)=>new Request("https://floralenormand.site/api/flora/redeem",{method:"POST",headers});
  assert.equal((await guardApi(request({Origin:"https://elsewhere.invalid","Content-Type":"application/json"}),env))?.status,403);
  assert.equal((await guardApi(request({Origin:"https://floralenormand.site","Content-Type":"application/json","Content-Length":"9000"}),env))?.status,413);
  assert.equal(calls,0);
  assert.equal(await guardApi(request({Origin:"https://floralenormand.site","Content-Type":"application/json","CF-Connecting-IP":"192.0.2.1"}),env),null);
  assert.equal(calls,1);
});
test("burst-limited requests return retry instructions; recovery has its own stricter counter",async()=>{
  let normal=0,recovery=0;
  const env={API_TRAFFIC:{limit:async()=>{normal++;return {success:false};}},RECOVERY_TRAFFIC:{limit:async()=>{recovery++;return {success:false};}}};
  for(const route of ["/api/flora/projects","/api/auth/reset-password"]){
    const r=await guardApi(new Request("https://floralenormand.site"+route,{headers:{"CF-Connecting-IP":"192.0.2.1"}}),env);
    assert.equal(r?.status,429);assert.equal(r?.headers.get("Retry-After"),"60");assert.equal(r?.headers.get("Cache-Control"),"no-store");
  }
  assert.equal(normal,1);assert.equal(recovery,1);
});
test("probe and preview routes never reach Next rendering and account pages are not indexed",()=>{
  for(const route of ["/.env","/wp-admin","/dev/rule-engine","/local-paid","/admin/paid-local","/recharge/mock","/api/deep-reading"]){assert.equal(isApplicationPage(route),false);}
  assert.equal(isApplicationPage("/deep/project/825c1277-2ae7-40fd-9d7f-54b59338458c"),true);
  for(const route of ["/profile","/admin/codes","/deep/project/825c1277-2ae7-40fd-9d7f-54b59338458c"]){assert.equal(isPrivatePage(route),true);}
  const config=JSON.parse(fs.readFileSync(path.join(process.cwd(),"wrangler.flora-v3-site.jsonc"),"utf8"));
  assert.equal(config.assets.run_worker_first,false);
});
test("social crawlers see the final domain and current image while real visitors retain the app",async()=>{
  for(const ua of ["facebookexternalhit/1.1","Twitterbot/1.0","TelegramBot"]){
    const r=socialPreview(new Request("https://floralenormand.site/?og_refresh=old",{headers:{"User-Agent":ua}}));assert.equal(r?.status,200);
    const html=await r!.text();assert.ok(html.includes('content="https://floralenormand.site/og-flora-v3-20261022.jpg"'));assert.ok(html.includes('rel="canonical" href="https://floralenormand.site/"'));assert.ok(!html.includes('og_refresh='));
  }
  assert.equal(socialPreview(new Request("https://floralenormand.site/",{headers:{"User-Agent":"Mozilla/5.0 MicroMessenger"}})),null);
  assert.equal(socialPreview(new Request("https://floralenormand.site/profile",{headers:{"User-Agent":"Twitterbot"}})),null);
});
