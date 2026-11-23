// Offline only: aggregate existing token logs and inspect current prompt sizes.
// Does not call a model, print questions, or expose account/session identifiers.
const fs = require('node:fs');
require('./typescript-register.cjs');
const {planNextCard,interpretGuidedRound,summarizeGuidedReading} = require('../lib/guided-reading/model.ts');

async function estimate() {
  const filename = '.local-paid/ai-usage.jsonl';
  const groups = new Map();
  if(fs.existsSync(filename)) for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/).filter(Boolean)) {
    let row; try { row=JSON.parse(line); } catch { continue; }
    if(!row.kind?.startsWith('guided') || !/^deepseek-(flash|v4-flash)/.test(row.model || '')) continue;
    const item=groups.get(row.readingId)||{input:0,cached:0,output:0,final:false};
    item.input+=row.promptTokens; item.cached+=row.cachedInputTokens; item.output+=row.completionTokens;
    item.final ||= row.kind==='guided-final'; groups.set(row.readingId,item);
  }
  const completed=[...groups.values()].filter(x=>x.final);
  const costs=completed.map(x=>(x.input-x.cached+x.cached*.02+x.output*4)/1e6);
  const calls=[];
  const request=async(system,user,maxTokens,_id,kind)=>{
    calls.push({kind,inputChars:[...system+user].length,maxTokens});
    if(kind==='guided-step')return {interpretation:'从目前的相处看，双方都在试探合适的距离。可以先观察一次具体的回应，把已经发生的事与自己的期待分开。'.repeat(2)};
    if(kind==='guided-final')return {summary:'先把各轮线索放回最初的问题，结合你明确说过的现实情况继续观察。'.repeat(20)};
    return {};
  };
  const session={id:'offline-cost-fixture',question:'未来三个月我和他的关系怎样发展？',focus:'我们认识一段时间了，最近联系变少，我想了解接下来怎么自然地推进关系。',petalPrice:0,cards:[],messages:[],rounds:[],plan:null,final:null,updatedAt:new Date().toISOString()};
  let previous=[];
  for(let i=0;i<9;i++){
    const plan=await planNextCard(session,request,previous);
    session.cards.push(i+1);session.rounds.push({question:plan.groups[0][0],interpretation:null});
    session.rounds.at(-1).interpretation=await interpretGuidedRound(session,request);
    previous=[...previous,...plan.groups.flat()].slice(-18);
  }
  await summarizeGuidedReading(session,request);
  return {
    priceCheckedAt:'2026-11-23',priceSource:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    flashCnyPerMillion:{offPeak:{uncachedInput:1,cachedInput:.02,output:4},peak:{uncachedInput:2,cachedInput:.04,output:8}},
    historicalLocalSamples:costs.length?{completedSessions:costs.length,minOffPeakCny:Math.min(...costs),maxOffPeakCny:Math.max(...costs),averageOffPeakCny:costs.reduce((a,b)=>a+b,0)/costs.length}:null,
    currentOfflineFixture:{generationCalls:calls.length,baseReviewCalls:1,additionalCustomReviewCalls:'0–9',inputCharacters:calls.reduce((n,x)=>n+x.inputChars,0),maxOutputTokens:calls.reduce((n,x)=>n+x.maxTokens,0),note:'Characters are not measured tokens. Synthetic responses only; no paid requests.'},
    planningAllowance:{cnyPerCompletedSession:[.05,.15],note:'Planning range, not a cap or a live bill; covers longer current prompts, daytime use, and some retry allowance.',scenarios:[100,500,1000,3000].map(n=>({completedSessions:n,minCny:n*.05,maxCny:n*.15}))},
  };
}
if(require.main===module)estimate().then(value=>console.log(JSON.stringify(value,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={estimate};
