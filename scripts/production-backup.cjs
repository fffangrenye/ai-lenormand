const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {config,request,sha,writeJson}=require('./private-maintenance-client.cjs');
const magic=Buffer.from('FLORA-BACKUP-V1\n');
function seal(value,key,id,name){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(id+':'+name));const encrypted=Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(value)))),cipher.final()]);return Buffer.concat([magic,iv,cipher.getAuthTag(),encrypted]);}
function open(bytes,key,id,name){if(!bytes.subarray(0,magic.length).equals(magic))throw Error('Unrecognized encrypted backup');const iv=bytes.subarray(magic.length,magic.length+12),tag=bytes.subarray(magic.length+12,magic.length+28),decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(id+':'+name));decipher.setAuthTag(tag);return JSON.parse(zlib.gunzipSync(Buffer.concat([decipher.update(bytes.subarray(magic.length+28)),decipher.final()])).toString('utf8'));}
function savePart(directory,name,value,key,id){const bytes=seal(value,key,id,name);fs.writeFileSync(path.join(directory,name),bytes);return{file:name,sha256:sha(bytes),bytes:bytes.length};}
async function backup(configFile,stateFile){
 const cfg=config(configFile),state=JSON.parse(fs.readFileSync(stateFile,'utf8')),directory=path.resolve(state.directory),keyFile=path.resolve(state.keyFile);
 fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(path.dirname(keyFile),{recursive:true});
 if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,crypto.randomBytes(32).toString('base64')+'\n',{flag:'wx'});
 const key=Buffer.from(fs.readFileSync(keyFile,'utf8').trim(),'base64');if(key.length!==32)throw Error('Invalid backup recovery key');
 const indexFile=path.join(directory,'index.json');let index=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile,'utf8')):null;
 if(!index){const manifest=await request(cfg,'backup-begin',{backupId:state.id});const {manifestHash,...data}=manifest;if(sha(JSON.stringify(data))!==manifestHash)throw Error('Server snapshot manifest hash mismatch');index={format:'flora-encrypted-backup-v1',id:state.id,createdAt:manifest.createdAt,status:'exporting',manifest:savePart(directory,'manifest.enc',manifest,key,state.id),secrets:savePart(directory,'voucher-signing-key.enc',{CODE_SIGNING_KEY:cfg.signingKey},key,state.id),tables:manifest.tables.map(t=>({name:t.name,expected:t.count,count:0,cursor:0,done:false})),chunks:[]};writeJson(indexFile,index);}
 if(index.id!==state.id)throw Error('Backup directory belongs to another snapshot');
 const manifestBytes=fs.readFileSync(path.join(directory,index.manifest.file));if(sha(manifestBytes)!==index.manifest.sha256)throw Error('Encrypted manifest checksum mismatch');const manifest=open(manifestBytes,key,index.id,index.manifest.file);
 let pages=0;
 const queue=index.tables.filter(t=>!t.done);let nextTable=0;
 // Independent tables share one frozen start point. Keep each table's cursor
 // sequential and use three download streams to avoid an unnecessarily long
 // capture window. All checkpoint writes below are synchronous and atomic.
 await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
  while(nextTable<queue.length){const table=queue[nextTable++];while(!table.done){const page=await request(cfg,'backup-page',{backupId:index.id,table:table.name,after:table.cursor});if(page.manifestHash!==manifest.manifestHash||page.table!==table.name||page.after!==table.cursor||(!page.done&&page.nextCursor<=table.cursor))throw Error('Snapshot page identity or cursor mismatch');const name=`chunk-${String(index.chunks.length).padStart(6,'0')}.enc`;const part=savePart(directory,name,page,key,index.id);index.chunks.push({...part,table:table.name,after:page.after,nextCursor:page.nextCursor,count:page.rows.length});table.count+=page.rows.length;table.cursor=page.nextCursor;table.done=page.done;if(table.done&&table.count!==table.expected)throw Error('Snapshot row count mismatch: '+table.name);writeJson(indexFile,index);if(++pages%25===0)console.log(JSON.stringify({phase:'exporting',pages:index.chunks.length,rows:index.tables.reduce((n,t)=>n+t.count,0),tablesDone:index.tables.filter(t=>t.done).length,tables:index.tables.length}));}}
 }));
 if(index.status!=='verified')index.status='exported';writeJson(indexFile,index);
 if(!index.snapshotEnded){index.finish=await request(cfg,'backup-end',{backupId:index.id});index.snapshotEnded=true;index.finishedAt=new Date().toISOString();writeJson(indexFile,index);}
 console.log(JSON.stringify({phase:'exported',directory,rows:index.tables.reduce((n,t)=>n+t.count,0),tables:index.tables.length,chunks:index.chunks.length,encryptedBytes:index.chunks.reduce((n,c)=>n+c.bytes,0),snapshotEnded:true}));
 return{directory,keyFile};
}
module.exports={seal,open,backup};
if(require.main===module)backup(process.argv[2],process.argv[3]).catch(error=>{console.error(error.message);process.exitCode=1;});
