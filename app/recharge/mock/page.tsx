import { Suspense } from "react";
import { MockRechargeClient } from "@/components/MockRechargePage";
export default function MockRechargePage(){return <Suspense fallback={<p className="p-8">正在读取历史模拟订单…</p>}><MockRechargeClient/></Suspense>;}
