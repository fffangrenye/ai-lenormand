const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('workers/redirect-final/worker.js','utf8');
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const host of ['flora','ai-lenormand','ai-lenormand-cloudflare-preview']){
   const root=await worker.fetch(new Request(`https://${host}.soul-ai-frontend.workers.dev/`));assert.equal(root.status,301);assert.equal(root.headers.get('Location'),'https://floralenormand.site/');
   const project=await worker.fetch(new Request(`https://${host}.soul-ai-frontend.workers.dev/deep/project/old-id?reading=private&token=private`));assert.equal(project.headers.get('Location'),'https://floralenormand.site/deep');
 }
 const reset=await worker.fetch(new Request('https://old.invalid/reset-password?token_hash=proof&type=recovery'));assert.equal(reset.status,307);assert.equal(reset.headers.get('Cache-Control'),'no-store');assert.equal(new URL(reset.headers.get('Location')).searchParams.get('token_hash'),'proof');
 const post=await worker.fetch(new Request('https://old.invalid/api/deep-reading',{method:'POST',body:'private'}));assert.equal(post.status,410);assert.equal(post.headers.get('Location'),null);
 const unknown=await worker.fetch(new Request('https://old.invalid/any?redirect=https://evil.invalid'));assert.equal(unknown.headers.get('Location'),'https://floralenormand.site/');
 console.log('Legacy redirects verified: three origins, canonical root, obsolete projects, recovery proof, no POST forwarding or open redirects.');
})().catch(e=>{console.error(e);process.exitCode=1});
