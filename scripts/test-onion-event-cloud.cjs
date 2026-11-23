// Executes the built Worker with fake auth/AI and an isolated SQLite DO.
// Only this in-memory test bundle shifts event dates; production has no clock override.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {Miniflare,convertV4MiniflareOptions} = require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
const owner = randomUUID(), other = randomUUID();
const bulkOwners = new Map();
let aiCalls = 0, authCalls = 0;
const original = fs.readFileSync('.local-paid/onion-event-api-build/index.js','utf8');
assert(original.includes('2026-11-23T22:00:00+08:00') && original.includes('2026-11-24T00:00:00+08:00'), 'Rebuild the API Worker before this test.');
const script = original.replaceAll('2026-11-23T22:00:00+08:00',new Date(Date.now()-60_000).toISOString())
  .replaceAll('2026-11-24T00:00:00+08:00',new Date(Date.now()+3600_000).toISOString());
assert.notEqual(script, original);
const mf = new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'onion-event-test',modules:true,script,compatibilityDate:'2026-09-04',compatibilityFlags:['nodejs_compat'],
  durableObjects:{LEDGER:{className:'FloraLedger',useSQLite:true}},
  bindings:{SUPABASE_URL:'https://test-auth.invalid',SUPABASE_ANON_KEY:'fake',AI_KEY:'fake',AI_MODEL:'test',CODE_SIGNING_KEY:'test-only-'.repeat(8),GUIDED_ENABLED:'1'},
  outboundService:async request=>{
    if(request.url.startsWith('https://test-auth.invalid/')){
      authCalls++;
      const authorization=request.headers.get('authorization');
      const bulk=authorization.match(/valid-bulk-(\d+)-token/);
      const id=bulk?bulkOwners.get(bulk[1]):authorization.includes('other')?other:owner;
      return Response.json({id,email:id+'@example.invalid',email_confirmed_at:'2026-01-01'});
    }
    if(request.url==='https://api.deepseek.com/chat/completions'){
      aiCalls++; const body=await request.json();
      const value=body.max_tokens===96?{decision:'allow',category:'none'}
        :body.max_tokens===720?{interpretation:'可以把目前的情况说清楚，再观察双方的回应。'}
        :body.max_tokens===1900?{summary:'把九个小问题放回主问题，综合这些线索。'}:{};
      return Response.json({model:'test',choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
    }
    throw Error('Unexpected upstream');
  }
}]}));
async function req(action,body,token='owner'){
  const r=await mf.dispatchFetch('https://floralenormand.site/api/flora/'+action,{
    method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer valid-'+token+'-token-1234567890'}:{}),'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  return {status:r.status,data:await r.json()};
}
(async()=>{try{
  assert.equal((await req('onion-event',undefined,null)).data.active,true);
  assert.equal(authCalls,0); assert.equal(aiCalls,0);
  assert.equal((await req('onion-coupon/claim',{expectedUserId:owner},null)).status,401);
  assert.equal((await req('onion-coupon/claim',{expectedUserId:other})).status,409);
  const gift=await req('onion-coupon/claim',{expectedUserId:owner});
  assert.equal(gift.status,200,JSON.stringify(gift.data));
  assert.equal(gift.data.newlyClaimed,true);
  assert.equal(gift.data.claimLimit,500);
  assert.equal(gift.data.displayClaimLimit,1000);
  assert.equal((await req('onion-coupon/claim',{expectedUserId:owner})).data.newlyClaimed,false);
  assert.equal((await req('onion-coupon',undefined,'other')).data.coupon,null);
  assert.equal(aiCalls,0);
  let session=(await req('guided/start',{question:'未来三个月怎样更自然地相处？',focus:'最近联系少了',requestId:randomUUID()})).data;
  assert.ok(session.couponId); assert.equal(session.petalPrice,0);
  session=(await req('guided/advance',{id:session.id})).data;
  for(let step=0;step<9;step++){
    const fields={id:session.id,step,planId:session.plan.id,question:session.plan.groups[0][0],custom:false};
    const draw=await req('guided/draw',fields); assert.equal(draw.status,200,JSON.stringify(draw.data));
    if(step===0){
      assert.deepEqual((await req('guided/draw',fields)).data.cards,draw.data.cards);
      assert.equal((await req('onion-coupon')).data.coupon.sessionId,session.id);
    }
    assert.equal((await req('guided/advance',{id:session.id})).status,200);
    session=(await req('guided/advance',{id:session.id})).data;
  }
  assert.ok(session.final); assert.equal(session.cards.length,9);
  assert.equal((await req('summary')).data.balance.available,1);
  assert.equal((await req('guided/'+session.id,undefined,'other')).status,404);
  // 499 issued, then two distinct accounts race for the final slot.
  for(let offset=0;offset<498;offset+=50){
    const result=await Promise.all(Array.from({length:Math.min(50,498-offset)},(_,j)=>{
      const key=String(offset+j),id=randomUUID(); bulkOwners.set(key,id);
      return req('onion-coupon/claim',{expectedUserId:id},'bulk-'+key);
    }));
    result.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));
  }
  assert.equal((await req('onion-coupon')).data.remaining,1);
  const last=await Promise.all(['498','499'].map(key=>{
    const id=randomUUID();bulkOwners.set(key,id);
    return req('onion-coupon/claim',{expectedUserId:id},'bulk-'+key);
  }));
  assert.deepEqual(last.map(r=>r.status).sort(),[200,409]);
  assert.equal(last.find(r=>r.status===409).data.code,'EVENT_SOLD_OUT');
  assert.equal((await req('onion-coupon')).data.remaining,0);
  assert.equal((await req('onion-coupon')).data.soldOut,true);
  assert.equal((await req('onion-coupon/claim',{expectedUserId:owner})).data.newlyClaimed,false);
  assert.ok((await req('guided/'+session.id)).data.final);
  console.log(JSON.stringify({verified:'public clock, authenticated claim, idempotency, account isolation, 9 rounds + summary, no petal debit; concurrent last-slot claims capped at 500, display stays 1000',aiCalls}));
}finally{await mf.dispose();}})().catch(e=>{console.error(e);process.exitCode=1;});
