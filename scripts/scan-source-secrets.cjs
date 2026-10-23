// Inspect tracked + non-ignored source. Never print matched values.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const known=[];
for(const file of ['.env.local','.env.production','.local-paid/cloud-code-signing-key.txt']){
 if(!fs.existsSync(file))continue;
 const raw=fs.readFileSync(file,'utf8');
 if(file.endsWith('.txt')){if(raw.trim().length>=24)known.push(raw.trim());continue;}
 for(const line of raw.split(/\r?\n/)){const m=line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);if(!m||m[1].startsWith('NEXT_PUBLIC_')||!/(KEY|TOKEN|SECRET|PASSWORD)/.test(m[1]))continue;const v=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');if(v.length>=16)known.push(v);}
}
let failures=0;
for(const file of files){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
 if(/(^|\/)(\.env(?!\.example$)|\.local-paid|\.wrangler|node_modules|\.next|\.open-next)(\/|\.|$)|\.(sqlite|pem|p12|pfx)$/.test(file)){console.error('Forbidden private path: '+file);failures++;continue;}
 const text=fs.readFileSync(file,'utf8');let reason='';
 if(known.some(v=>text.includes(v)))reason='known local secret';
 if(/(?:sk-[A-Za-z0-9_-]{24,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,})/.test(text))reason='credential pattern';
 for(const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(jwt[0].split('.')[1],'base64url')).role==='service_role')reason='service role JWT';}catch{}}
 if(reason){console.error('BLOCKED '+file+' ('+reason+')');failures++;}
}
console.log(JSON.stringify({sourceFiles:files.length,knownSecretValuesChecked:known.length,failures}));
if(failures)process.exitCode=1;
