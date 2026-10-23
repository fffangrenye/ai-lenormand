// Dedicated loopback-only gateway. Opening public access is a separate step.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
require("./typescript-register.cjs");
const root = path.resolve(__dirname,"..");
process.chdir(root);
const file = path.join(root,".local-paid","xianyu-config.json");
if (!fs.existsSync(file)) {
  console.error("缺少 .local-paid/xianyu-config.json 私有配置；请勿把密钥发到聊天或提交 GitHub。");
  process.exit(1);
}
let config;
try {
  config = JSON.parse(fs.readFileSync(file,"utf8"));
  // This launch path is approved for interface connectivity only.
  if (config.allowRecharge !== false || !Array.isArray(config.products)) throw new Error();
  const { signVirtualSource } = require("../lib/payments/goofish.ts");
  signVirtualSource("{}",Math.floor(Date.now()/1000),config.credentials);
} catch { console.error("闲管家私有配置无效，网关未启动。"); process.exit(1); }
Object.assign(process.env,{NODE_ENV:"development",PAID_LOCAL_MODE:"1",PAID_LOCAL_MODEL:"mock",PAID_LOCAL_DB:path.join(root,".local-paid","v1.sqlite"),NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:9",SUPABASE_SERVICE_ROLE_KEY:"",DEEPSEEK_API_KEY:""});
const { PaidLocalStore } = require("../lib/paid-local/store.ts");
const { XianyuGateway } = require("../lib/payments/xianyu-gateway.ts");
const store = new PaidLocalStore();
const gateway = new XianyuGateway(config,store.xianyu);
const { reconcileXianyu } = require("../lib/paid-local/xianyu-config.ts");
let reconciling=false;
const refundTimer=setInterval(async()=>{if(reconciling)return;reconciling=true;try{await reconcileXianyu(store.xianyu);}catch{}finally{reconciling=false;}},60000);
refundTimer.unref();
const server=http.createServer(async(req,res)=>{
  const target = new URL(req.url || "/","http://127.0.0.1:3102");
  if (!target.pathname.startsWith("/goofish/")) { res.writeHead(404);res.end();return; }
  try {
    const { Readable } = require("node:stream");
    const request = new Request(target,{method:req.method,headers:{"content-type":"application/json"},...(req.method === "POST" ? {body:Readable.toWeb(req),duplex:"half"} : {})});
    const response = await gateway.handle(request);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(503);res.end(); }
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(3102,"127.0.0.1",()=>console.log(`闲管家独立测试网关：http://127.0.0.1:3102（真实充值${config.allowRecharge ? "已允许" : "未启用"}）`));
const stop=()=>{clearInterval(refundTimer);server.close(()=>{store.close();process.exit(0);});};
process.once("SIGINT",stop);process.once("SIGTERM",stop);
