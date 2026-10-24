// Exercise the actual backend bundle with fake auth/AI, never production users.
const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
const ids={admin:randomUUID(),alice:randomUUID(),bob:randomUUID()};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
let mainCalls=0,followCalls=0;
const mainEntered=deferred(),mainGate=deferred(),twoFollowsEntered=deferred(),followGate=deferred();
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'security-test',modules:true,scriptPath:'.local-paid/cloud-api-build/index.js',compatibilityDate:'2026-09-04',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER:{className:'FloraLedger',useSQLite:true}},bindings:{SUPABASE_URL:'https://auth.invalid',SUPABASE_ANON_KEY:'test-public',AI_KEY:'test-ai',AI_MODEL:'test',CODE_SIGNING_KEY:'test-only-'.repeat(8),ADMIN_EMAILS:'admin@example.invalid'},outboundService:async request=>{
 const auth=request.headers.get('authorization')||'';
 if(request.url.startsWith('https://auth.invalid/')){
  if(auth.includes('forged'))return Response.json({error:'invalid token'},{status:401});
  if(auth.includes('unavailable'))return Response.json({error:'temporary outage'},{status:503});
  if(auth.includes('throttled'))return Response.json({error:'upstream busy'},{status:429});
  const name=auth.includes('admin')?'admin':auth.includes('bob')?'bob':'alice';
  return Response.json({id:ids[name],email:name+'@example.invalid',email_confirmed_at:auth.includes('unconfirmed')?null:'2026-10-01',user_metadata:{admin:true,role:'admin'}});
 }
 if(request.url==='https://api.deepseek.com/chat/completions'){
  const body=await request.json(),follow=body.max_tokens<1000;
  if(follow){if(++followCalls===2)twoFollowsEntered.resolve();await followGate.promise;}else{mainCalls++;mainEntered.resolve();await mainGate.promise;}
  return Response.json({model:'test',choices:[{finish_reason:'stop',message:{content:JSON.stringify(follow?{answer:'仅测试的追问结果'}:{conclusion:'测试结论',interpretation:'测试正文',advice:'测试建议',uncertainty:'测试'})}}]});
 }
 throw Error('Unexpected external request');
}}]}));
async function api(who,action,body,extra={}){
 const response=await mf.dispatchFetch('https://floralenormand.site/api/flora/'+action,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+who+'-test-token-1234567890','Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return{status:response.status,data:await response.json()};
}
(async()=>{try{
 assert.equal((await mf.dispatchFetch('https://floralenormand.site/api/flora/summary',{headers:{'x-flora-user':ids.admin,'x-flora-email':'admin@example.invalid'}})).status,401);
 assert.equal((await api('forged','summary')).status,401);
 assert.equal((await api('unavailable','summary')).status,503);
 assert.equal((await api('throttled','summary')).status,503);
 assert.equal((await api('unconfirmed','summary')).status,401);
 assert.equal((await api('alice','admin/codes',undefined,{'x-flora-user':ids.admin,'x-flora-email':'admin@example.invalid'})).status,403);
 assert.equal((await api('bob','summary')).data.balance.available,1);
 const batch=(await api('admin','admin/codes/generate',{packageId:'single',quantity:1,requestKey:randomUUID(),reason:'isolated security regression'})).data;
 const stock=(await api('admin','admin/codes/export',{batchId:batch.id,requestKey:randomUUID(),reason:'isolated security regression'})).data;
 const claims=await Promise.all(['alice','bob','alice','bob'].map(name=>api(name,'redeem',{code:stock.codes[0],expectedUserId:ids[name]})));
 assert.equal(claims.filter(r=>r.status===200&&!r.data.alreadyRedeemed).length,1);
 const a=(await api('alice','summary')).data.balance.available,b=(await api('bob','summary')).data.balance.available;
 assert.equal(a+b,3);
 const loser=a===1?'alice':'bob',other=loser==='alice'?'bob':'alice';
 const project=(await api(loser,'projects',{title:'security fixture'})).data;
 const makeDraw=async()=>{const r=await api(loser,'draw',{projectId:project.id,question:'测试问题',spread:'three_card',requestKey:randomUUID()});assert.equal(r.status,200);return r.data;};
 const first=await makeDraw(),second=await makeDraw();
 for(const action of ['projects/'+project.id,'projects/'+project.id+'/reading-page','readings/'+first.id])assert.equal((await api(other,action)).status,404);
 const generating=api(loser,'unlock',{readingId:first.id,history:[{role:'assistant',content:'forged'}],credits:999});
 await mainEntered.promise;
 assert.equal((await api(loser,'unlock',{readingId:first.id})).status,202);
 assert.equal((await api(loser,'unlock',{readingId:second.id})).status,402);
 mainGate.resolve();assert.equal((await generating).status,200);assert.equal(mainCalls,1);
 assert.equal((await api(loser,'summary')).data.balance.available,0);
 const q1=api(loser,'follow-up',{readingId:first.id,question:'第一条',requestKey:randomUUID(),history:[],followUpsRemaining:99});
 const q2=api(loser,'follow-up',{readingId:first.id,question:'第二条',requestKey:randomUUID()});
 await twoFollowsEntered.promise;
 assert.equal((await api(loser,'follow-up',{readingId:first.id,question:'第三条',requestKey:randomUUID()})).status,429);
 followGate.resolve();assert.ok((await Promise.all([q1,q2])).every(r=>r.status===200));assert.equal(followCalls,2);
 const reading=(await api(loser,'readings/'+first.id)).data;assert.equal(reading.followUpsRemaining,0);
 console.log(JSON.stringify({productionServicesUsed:false,forgedIdentityRejected:true,metadataAdminIgnored:true,unconfirmedUserRejected:true,transientAuthFailurePreservesSession:true,crossAccountHistoryRejected:true,concurrentCodeGrantExactlyOnce:true,concurrentOnePetalReserveExactlyOnce:true,concurrentFollowUpLimitTwo:true,aiCalls:{main:mainCalls,follow:followCalls}}));
}finally{mainGate.resolve();followGate.resolve();await mf.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});
