// Idempotent stock request. This never imports cards into the delivery service.
const fs=require('node:fs'),path=require('node:path');
const {config,request,sha,writeJson}=require('./private-maintenance-client.cjs');
(async()=>{
 const cfg=config(process.argv[2]),stateFile=path.resolve(process.argv[3]),state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 if(state.packageId!=='single'||state.quantity!==200||!state.requestKey||!state.exportKey||!state.reason)throw Error('Expected an explicit, persistent request for 200 single-petal codes');
 if(state.exported&&state.deliveryFile&&state.deliveryReceipt){const receipt=JSON.parse(fs.readFileSync(state.deliveryReceipt,'utf8'));if(sha(fs.readFileSync(state.deliveryFile))!==receipt.sha256)throw Error('Previously delivered stock file checksum failed');console.log(JSON.stringify({...receipt,alreadyDelivered:true}));return;}
 const batch=await request(cfg,'stock-generate',{packageId:state.packageId,quantity:state.quantity,requestKey:state.requestKey,reason:state.reason});
 state.batchId=batch.id;writeJson(stateFile,state);
 const result=await request(cfg,'stock-export',{batchId:batch.id,requestKey:state.exportKey,reason:state.reason});
 if(result.localOnly||result.credits!==1||result.codes.length!==200||new Set(result.codes).size!==200||result.codes.some(c=>!/^FLORA-[A-F0-9]{32}$/.test(c)))throw Error('Formal stock verification failed');
 const directory=path.resolve(cfg.stockDirectory);fs.mkdirSync(directory,{recursive:true});
 const deliveryDate=new Date(Date.now()+8*3600000).toISOString().slice(0,10).replace(/-/g,'');
 const filename=`1花瓣-新增200个-${deliveryDate}-${batch.id.slice(0,8)}.txt`,file=path.join(directory,filename);
 const content=Buffer.from(result.codes.join('\r\n')+'\r\n','utf8');
 const prior=new Set();for(const item of fs.readdirSync(directory)){if(item===filename||!item.endsWith('.txt'))continue;for(const code of fs.readFileSync(path.join(directory,item),'utf8').match(/FLORA-[A-F0-9]{32}/g)||[])prior.add(code);}
 if(result.codes.some(code=>prior.has(code)))throw Error('New stock overlaps an earlier delivery file');
 if(fs.existsSync(file)){if(sha(fs.readFileSync(file))!==sha(content))throw Error('Existing delivery filename has different contents');}else fs.writeFileSync(file,content,{flag:'wx'});
 const receipt={createdAt:new Date().toISOString(),batchId:batch.id,credits:1,quantity:200,priceCents:499,file,sha256:sha(content),newUniqueCodes:200,overlapWithEarlierFiles:0,importStatus:'等待用户导入闲管家；只导入一次；未兑换不代表未售出'};
 const receiptFile=path.join(directory,`库存交付记录-${deliveryDate}-${batch.id.slice(0,8)}.json`);writeJson(receiptFile,receipt);state.deliveryFile=file;state.deliveryReceipt=receiptFile;state.exported=true;writeJson(stateFile,state);console.log(JSON.stringify(receipt));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
