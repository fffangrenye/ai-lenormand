const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID,createHmac}=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
const uid=randomUUID(),other=randomUUID(),pid=randomUUID(),rid=randomUUID(),at='2026-09-22T10:00:00.000Z',key='test-only-'.repeat(8);let aiCalls=0;
const snapshot={format:'flora-legacy-v1',sourceProject:'pgivpvywizvtxjgqkvya',user:{id:uid,email:'restore@example.invalid',email_confirmed_at:at},projects:[{id:pid,user_id:uid,title:'历史项目',background:'背景',memory_summary:'记忆',created_at:at,updated_at:at,last_opened_at:at}],readings:[{id:rid,user_id:uid,project_id:pid,question:'历史问题',spread_type:'three_card',status:'completed',core_conclusion:'原结论',interpretation:'原解读',created_at:at,completed_at:at}],cards:['rider','clover','ship'].map((slug,i)=>({id:randomUUID(),reading_id:rid,card_number:i+1,card_slug:slug,position:String(i),name_en:slug,name_zh:'牌'+i})),messages:[{id:randomUUID(),user_id:uid,project_id:pid,reading_id:rid,role:'assistant',content:'原消息',created_at:at}]};
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'legacy-test',modules:true,scriptPath:'.local-paid/cloud-api-build/index.js',compatibilityDate:'2026-09-04',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER:{className:'FloraLedger',useSQLite:true}},bindings:{SUPABASE_URL:'https://auth.invalid',SUPABASE_ANON_KEY:'fake',AI_KEY:'fake',AI_MODEL:'test',CODE_SIGNING_KEY:key,ADMIN_EMAILS:'owner@example.invalid'},outboundService:async request=>{if(request.url.startsWith('https://auth.invalid/'))return Response.json({id:request.headers.get('authorization').includes('other')?other:uid,email:request.headers.get('authorization').includes('other')?'other@example.invalid':'restore@example.invalid',email_confirmed_at:at});aiCalls++;throw Error('History import must not call AI');}}]}));
async function api(route='',body,token='valid-owner-token-1234567890'){const r=await mf.dispatchFetch('https://site/api/flora'+(route?'/'+route:''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
async function maintenance(mode,signed=true){const job={purpose:'flora-legacy-restore-v1',jobId:'cloud-legacy-test-v1',expiresAt:Date.now()+60000,mode,expectedUserId:uid,expectedEmail:snapshot.user.email,snapshot};const body=JSON.stringify(job);const r=await mf.dispatchFetch('https://private/internal/legacy-restore',{method:'POST',headers:{'x-flora-restore-signature':signed?createHmac('sha256',key).update('flora-legacy-maintenance:v1\n'+body).digest('hex'):''},body});return {status:r.status,data:await r.json()};}
(async()=>{try{
 const before=(await api()).data.balance;assert.equal(before.available,1);
 assert.equal((await maintenance('inspect',false)).status,403);
 assert.equal((await maintenance('inspect')).data.missing.readings,1);
 const applied=await maintenance('apply');assert.equal(applied.status,200,JSON.stringify(applied.data));assert.equal(applied.data.verifiedReadings,1);
 assert.deepEqual((await api()).data.balance,before);assert.equal((await api('projects')).data.length,1);
 const reading=await api('readings/'+rid);assert.equal(reading.data.legacyRestored,true);assert.equal(reading.data.legacyMessages[0].content,'原消息');assert.equal(reading.data.completedAt,at);
 assert.equal((await api('unlock',{readingId:rid})).status,200);assert.equal(aiCalls,0);
 assert.equal((await api('follow-up',{readingId:rid,question:'额外追问',requestKey:randomUUID()})).status,409);
 assert.equal((await api('readings/'+rid,undefined,'valid-other-token-1234567890')).status,404);
 assert.equal((await maintenance('apply')).data.alreadyRestored,true);
 assert.equal((await api('internal/legacy-restore',{})).status,404);
 console.log('Cloudflare history restore verified: signed private path, dry-run, exact history/messages, unchanged wallet, no AI, cross-account isolation, idempotency.');
}finally{await mf.dispose();}})().catch(e=>{console.error(e);process.exitCode=1});
