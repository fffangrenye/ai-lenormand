// No deployment unless explicitly invoked with --deploy site|api.
const fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
function git(...args){return execFileSync('git',args,{encoding:'utf8'}).trim();}
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Required check failed');}
function clean(){if(git('status','--porcelain'))throw Error('Commit all source changes before release.');}
function preflight(){clean();const commit=git('rev-parse','HEAD'),branch=git('branch','--show-current');if(!branch)throw Error('Release requires a named branch.');const remote=git('-c','http.sslBackend=openssl','ls-remote','origin','refs/heads/'+branch).split(/\s/)[0];if(remote!==commit)throw Error('Push this exact commit to origin before release.');run(process.execPath,['scripts/scan-source-secrets.cjs']);return{commit,branch};}
try{
 const args=process.argv.slice(2),target=args[1];
 if(args.length && !(args.length===2&&args[0]==='--deploy'&&['site','api','canonical'].includes(target)))throw Error('Usage: node scripts/release-production.cjs [--deploy site|api|canonical]');
 const release=preflight();
 if(!args.length){console.log(JSON.stringify({preflight:'passed',...release,deployed:false}));process.exit(0);}
 if(target==='site'){run(process.execPath,['scripts/secure-cloudflare-build.cjs','--flora-v3']);run(process.execPath,['scripts/scan-cloudflare-artifacts.cjs']);run(process.execPath,['scripts/test-public-assets.cjs']);run(process.execPath,['scripts/test-site-runtime.cjs']);}
 if(preflight().commit!==release.commit)throw Error('Source changed during build.');
 const config=target==='site'?'wrangler.flora-v3-site.jsonc':target==='canonical'?'wrangler.flora-canonical.jsonc':'wrangler.flora-v3-api.jsonc';
 const worker=target==='site'?'flora-domain-info':target==='canonical'?'flora-domain-canonical':'flora-v3-api';
 const bin=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
 const r=spawnSync(process.execPath,[bin,'deploy','--config',config,'--tag',release.commit.slice(0,12),'--message','git:'+release.commit+' branch:'+release.branch],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)throw Error('Deployment failed; inspect Cloudflare before retrying.');
 const version=(r.stdout||'').match(/Current Version ID:\s*([a-f0-9-]{36})/i)?.[1];
 fs.mkdirSync('.local-paid/releases',{recursive:true});const receipt={...release,worker,config,version:version||null,createdAt:new Date().toISOString()};
 fs.writeFileSync('.local-paid/releases/'+Date.now()+'-'+target+'.json',JSON.stringify(receipt,null,2));
 if(!version)throw Error('Upload succeeded but version could not be parsed; retrieve and record it before further release.');
 console.log(JSON.stringify(receipt));
}catch(e){console.error(e.message);process.exitCode=1;}
