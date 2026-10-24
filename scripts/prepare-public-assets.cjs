const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('./typescript-register.cjs');
const {staticApplicationPaths,staticLegalPaths}=require('../lib/public-routes.ts');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function preparePublicAssets(root=process.cwd()){
 const output=path.join(root,'.open-next/assets');if(!fs.existsSync(output))throw Error('Build assets missing');
 const manifest=[];
 function write(route,html){if(!html.startsWith('<!DOCTYPE html>')&&!html.toLowerCase().startsWith('<!doctype html>'))throw Error('Expected complete HTML for '+route);const name=route==='/'?'index.html':route.slice(1)+'.html',bytes=Buffer.from(html);fs.writeFileSync(path.join(output,name),bytes);manifest.push({route,file:name,bytes:bytes.length,sha256:sha(bytes)});}
 for(const route of staticApplicationPaths){const name=route==='/'?'index':route.slice(1);const file=path.join(root,'.next/server/app',name+'.html');if(!fs.existsSync(file))throw Error('Public prerender missing: '+route);write(route,fs.readFileSync(file,'utf8'));}
 const {renderPage}=await import(require('node:url').pathToFileURL(path.join(root,'workers/domain-info/content.mjs')).href);
 for(const route of staticLegalPaths){const html=renderPage(route);if(!html)throw Error('Legal page missing: '+route);write(route,html);}
 const headers=['/*','  X-Content-Type-Options: nosniff','  Referrer-Policy: strict-origin-when-cross-origin','  X-Frame-Options: DENY',''];
 for(const route of [...staticApplicationPaths,...staticLegalPaths])headers.push(route,'  Cache-Control: public, max-age=0, must-revalidate','  X-Flora-Static: 1','');
 fs.writeFileSync(path.join(output,'_headers'),headers.join('\n'));
 // Host/scheme redirects run in a separate route before this asset-enabled
 // Worker. Static-assets _redirects only supports relative source paths.
 const redirects=path.join(output,'_redirects');if(fs.existsSync(redirects))fs.unlinkSync(redirects);
 fs.mkdirSync(path.join(root,'.local-paid'),{recursive:true});fs.writeFileSync(path.join(root,'.local-paid/public-assets-manifest.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({publicStaticPages:manifest.length,routes:manifest.map(item=>item.route),privatePagesExported:false}));return manifest;
}
module.exports={preparePublicAssets};
if(require.main===module)preparePublicAssets().catch(error=>{console.error(error.message);process.exitCode=1;});
