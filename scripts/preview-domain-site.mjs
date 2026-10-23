import { createServer } from "node:http";
import worker from "../workers/domain-info/worker.mjs";

const port = 3101;
createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, { method: incoming.method });
    const response = await worker.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end("Preview unavailable"); }
}).listen(port, "127.0.0.1", () => console.log(`独立新域名介绍站预览：http://127.0.0.1:${port}/（不连接数据库，不影响 3100）`));
