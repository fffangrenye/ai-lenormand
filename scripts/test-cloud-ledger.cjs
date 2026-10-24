// Execute the actual Cloudflare bundle in workerd, with a fake auth/AI upstream.
// No production accounts, keys, money or database are touched.
const assert=require('node:assert/strict');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
const user=randomUUID(),other=randomUUID();let calls=0;
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'flora-test',modules:true,scriptPath:'.local-paid/cloud-api-build/index.js',compatibilityDate:'2026-09-04',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER:{className:'FloraLedger',useSQLite:true}},bindings:{SUPABASE_URL:'https://test-auth.invalid',SUPABASE_ANON_KEY:'fake-anon',AI_KEY:'fake-ai',AI_MODEL:'test-model',CODE_SIGNING_KEY:'test-only-'.repeat(8),ADMIN_EMAILS:'owner@example.invalid',SALES_ENABLED:'0'},outboundService:async request=>{
  if(request.url.startsWith('https://test-auth.invalid/'))return Response.json({id:request.headers.get('authorization').includes('other')?other:user,email:request.headers.get('authorization').includes('other')?'other@example.invalid':'owner@example.invalid',email_confirmed_at:'2026-10-01'});
  if(request.url==='https://api.deepseek.com/chat/completions'){calls++;const body=await request.json();return Response.json({model:'test-model',choices:[{finish_reason:'stop',message:{content:JSON.stringify(body.max_tokens<1000?{answer:'原牌追问答复'}:{conclusion:'完整结论',interpretation:'完整解读',advice:'自然建议',uncertainty:'仅供参考'})}}]});}
  throw new Error('Unexpected upstream');
}}]}));
async function req(action='',body,token='valid-owner-token-1234567890'){
  const response=await mf.dispatchFetch(`https://floralenormand.site/api/flora${action?'/'+action:''}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
}
(async()=>{try{
  assert.equal((await mf.dispatchFetch('https://example.invalid/api/flora')).status,401);
  assert.equal((await req()).data.balance.available,1);assert.equal((await req()).data.balance.available,1);
  assert.equal((await req('card-catalog')).data.packages.some(x=>x.ready),false);
  assert.equal((await req('test-credits',{requestKey:randomUUID()})).status,404);
  assert.equal((await req('payment-simulate',{mode:'success'})).status,404);
  const day=(await req('daily-check-in',{})).data;assert.equal(day.totalDays,1);assert.deepEqual((await req('daily-check-in',{})).data.entry,day.entry);
  const project=(await req('projects',{title:'云端测试'})).data;
  const draw=(await req('draw-session',{projectId:project.id,question:'未来发展如何？',spread:'h_seven',requestKey:randomUUID()})).data;
  assert.ok(draw.id);assert.equal(draw.selected.length,0);assert.equal(JSON.stringify(draw.deck).includes('nameZh'),false);
  const batchInput={sessionId:draw.id,tokens:draw.deck.slice(0,7).map(card=>card.token),expectedCount:0};
  const batchPick=await req('draw-picks',batchInput);assert.equal(batchPick.status,200,JSON.stringify(batchPick.data));const selected=batchPick.data;
  assert.deepEqual((await req('draw-picks',batchInput)).data,selected);
  assert.equal(selected.state,'completed');assert.equal((await req()).data.balance.available,1);
  assert.equal((await req('readings/'+selected.readingId,undefined,'valid-other-token-1234567890')).status,404);
  const read=await req('unlock',{readingId:selected.readingId});assert.equal(read.status,200,JSON.stringify(read.data));assert.equal(read.data.state,'completed');
  assert.equal((await req('unlock',{readingId:selected.readingId})).status,200);assert.equal(calls,1);assert.equal((await req()).data.balance.available,0);
  const profile=(await req('profile?section=usage&days=all')).data;assert.equal(profile.readings.length,1);assert.equal(profile.ledger.length,0);
  const ledgerPage=(await req('ledger')).data;assert.ok(ledgerPage.items.length>0);assert.ok(ledgerPage.items.length<=20);
  for(let i=0;i<2;i++)assert.equal((await req('follow-up',{readingId:selected.readingId,question:'下一步呢？',requestKey:randomUUID()})).status,200);
  assert.equal((await req('follow-up',{readingId:selected.readingId,question:'第三次呢？',requestKey:randomUUID()})).status,429);
  const batch=(await req('admin/codes/generate',{packageId:'five',quantity:1,requestKey:randomUUID(),reason:'workerd测试'})).data;
  const exported=(await req('admin/codes/export',{batchId:batch.id,requestKey:randomUUID(),reason:'workerd测试'})).data;assert.match(exported.codes[0],/^FLORA-/);assert.equal(exported.localOnly,false);
  const redeem=await req('redeem',{code:exported.codes[0],expectedUserId:user});assert.equal(redeem.status,200,JSON.stringify(redeem.data));assert.equal(redeem.data.balance.available,5);
  assert.equal((await req('redeem',{code:exported.codes[0],expectedUserId:user})).data.balance.available,5);
  assert.equal((await req('redeem',{code:'FLLOCAL-'+ 'A'.repeat(32),expectedUserId:user})).status,409);
  assert.equal((await req('admin/codes',undefined,'valid-other-token-1234567890')).status,403);
  console.log('Cloudflare runtime verified: welcome 1, account isolation, daily persistence, H spread, real provider adapter, debit once, 2 follow-ups, formal vouchers, retry, no mock endpoints.');
}finally{await mf.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});

