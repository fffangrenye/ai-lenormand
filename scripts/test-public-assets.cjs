// Real asset router in local workerd. No production data or bindings.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
require('./typescript-register.cjs');const canonical=require('../workers/flora-site/canonical.ts').default;
const config=JSON.parse(fs.readFileSync('wrangler.flora-v3-site.jsonc','utf8')),manifest=JSON.parse(fs.readFileSync('.local-paid/public-assets-manifest.json','utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'static-asset-test',modules:true,compatibilityDate:config.compatibility_date,script:`let calls=0;export default{fetch(request){if(new URL(request.url).pathname==='/__probe')return Response.json({calls});calls++;return new Response('user worker',{headers:{'x-test-worker':'1'}})}}`,assets:{directory:path.resolve(config.assets.directory),binding:'ASSETS',routerConfig:{has_user_worker:true},assetConfig:{html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling},run_worker_first:config.assets.run_worker_first}}]}));
const fetch=(route,options)=>mf.dispatchFetch('https://floralenormand.site'+route,options);
(async()=>{try{
 for(const item of manifest){const r=await fetch(item.route);assert.equal(r.status,200,item.route);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('x-flora-static'),'1');assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),item.sha256);const head=await fetch(item.route,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.text()).length,0);}
 const daily=await fetch('/daily?checkin=1#daily-calendar');assert.equal(daily.status,200);assert.equal(daily.headers.get('x-flora-static'),'1');
 const oldClient=await fetch('/daily?_rsc=fixture',{headers:{RSC:'1'}});assert.equal(oldClient.status,200);assert.match(oldClient.headers.get('content-type'),/text\/html/,'older Next clients must receive an HTML response that triggers their native-navigation fallback');
 const www=canonical.fetch(new Request('https://www.floralenormand.site/daily?checkin=1'));assert.equal(www.status,308);assert.equal(www.headers.get('location'),'https://floralenormand.site/daily?checkin=1');
 const http=canonical.fetch(new Request('http://floralenormand.site/'));assert.equal(http.status,308);assert.equal(http.headers.get('location'),'https://floralenormand.site/');
 assert.equal((await(await fetch('/__probe')).json()).calls,0,'all public HTML requests must bypass the user Worker');
 for(const route of ['/profile','/login','/deep','/recharge','/redeem','/api/flora/summary'])assert.equal((await fetch(route)).headers.get('x-test-worker'),'1');
 assert.equal((await(await fetch('/__probe')).json()).calls,6);
 console.log(JSON.stringify({publicPages:manifest.length,publicHtmlAndHeadRequestsEnterWorker:false,wwwAndHttpsRedirectsPreserved:true,legacyRscFallback:true,privatePagesRemainWorkerRouted:true}));
}finally{await mf.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});
