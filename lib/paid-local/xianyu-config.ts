import { readFileSync } from "node:fs";
import path from "node:path";
import { assertLocalEnvironment } from "./guard";
import { GoofishOrderClient } from "../payments/goofish";
import type { XianyuGatewayConfig } from "../payments/xianyu-gateway";
import type { LocalXianyuPayments } from "./xianyu-store";

export function xianyuConfig(): XianyuGatewayConfig | null {
  assertLocalEnvironment();
  try {
    const result=JSON.parse(readFileSync(path.join(process.cwd(),".local-paid/xianyu-config.json"),"utf8")) as XianyuGatewayConfig;
    if (typeof result.allowRecharge !== "boolean" || !Array.isArray(result.products)) return null;
    new GoofishOrderClient(result.credentials);
    return result;
  } catch { return null; }
}
export async function reconcileXianyu(store:LocalXianyuPayments,user?:string) {
  const config=xianyuConfig(); if (!config) return {ok:false};
  const client=new GoofishOrderClient(config.credentials);
  const results=await Promise.allSettled(store.reconcileQueue(user).slice(0,5).map(async orderNo=>store.syncRefund(await client.order(orderNo))));
  return {ok:results.every(x=>x.status === "fulfilled")};
}
