// Prepare an ignored, private file for Wrangler's secret upload. Never prints values.
const fs=require('node:fs'),{randomBytes}=require('node:crypto');
const source=fs.readFileSync(fs.existsSync('.env.local')?'.env.local':'.env.local.codex-build-hold','utf8');
const values={};for(const line of source.split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m)values[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
const keyFile='.local-paid/cloud-code-signing-key.txt';
if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(48).toString('hex'),{flag:'wx',mode:0o600});
const secrets={SUPABASE_URL:values.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_ANON_KEY:values.NEXT_PUBLIC_SUPABASE_ANON_KEY,AI_KEY:values.DEEPSEEK_API_KEY,ADMIN_EMAILS:values.ADMIN_EMAILS,CODE_SIGNING_KEY:fs.readFileSync(keyFile,'utf8').trim()};
for(const [key,value] of Object.entries(secrets))if(!value)throw new Error('Missing required configuration: '+key);
fs.writeFileSync('.local-paid/cloud-api-secrets.json',JSON.stringify(secrets),{mode:0o600});
console.log('Private runtime configuration prepared; values withheld.');
