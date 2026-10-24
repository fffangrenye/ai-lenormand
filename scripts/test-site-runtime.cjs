// Render the exact production bundle locally, with a fake API binding only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
const config=JSON.parse(fs.readFileSync('wrangler.flora-v3-site.jsonc','utf8'));
const output='.local-paid/site-runtime-build',bin=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const built=spawnSync(process.execPath,[bin,'deploy','--config','wrangler.flora-v3-site.jsonc','--dry-run','--outdir',output],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
if(built.status!==0){console.error(built.stdout,built.stderr);throw Error('Site runtime bundle failed');}
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'site-runtime-test',modules:true,scriptPath:path.join(output,'entry.js'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,bindings:config.vars,assets:{directory:path.resolve(config.assets.directory),binding:'ASSETS',routerConfig:{has_user_worker:true},assetConfig:{html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling},run_worker_first:false},serviceBindings:{FLORA_API:async()=>Response.json({code:'UNAUTHORIZED'},{status:401})}}]}));
(async()=>{try{
 const pages=[];for(const route of ['/','/daily','/yes-no','/login','/profile','/deep','/recharge','/redeem']){const r=await mf.dispatchFetch('https://floralenormand.site'+route);const html=await r.text();assert.equal(r.status,200,route+': '+html.slice(0,200));assert.match(html,/Flora Lenormand/);assert.equal(html.includes('本地模拟预览'),false);pages.push({path:route,status:r.status,static:r.headers.get('x-flora-static')==='1'});}
 assert.equal((await mf.dispatchFetch('https://floralenormand.site/api/flora/summary')).status,401);
 assert.equal((await mf.dispatchFetch('https://floralenormand.site/internal/maintenance')).status,404);
 console.log(JSON.stringify({productionBundleLocalRuntime:'passed',pages,anonymousSummary:401,maintenancePublic:404,productionServicesUsed:false}));
}finally{await mf.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});
