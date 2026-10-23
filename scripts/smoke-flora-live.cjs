const fs=require('node:fs');
const base='https://floralenormand.site';
(async()=>{
  const report=[];
  const response=await fetch(base+'/login',{signal:AbortSignal.timeout(20000)}),html=await response.text();
  const paths=[...new Set([...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(x=>x[1]).filter(x=>x.startsWith('/')))];
  for(const path of paths){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});const record={path,status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength};report.push(record);console.log(JSON.stringify(record));}
  fs.writeFileSync('.local-paid/live-asset-smoke.json',JSON.stringify(report,null,2));
  if(report.some(x=>x.status!==200 || !/javascript|text\/css/.test(x.type)))process.exitCode=1;
})().catch(error=>{console.error(error.name,error.cause?.code||'network failure');process.exitCode=1;});
