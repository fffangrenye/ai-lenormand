import { RechargeClient } from "@/components/RechargePage";
import { Suspense } from "react";

export default function RechargePage() {
  return <Suspense fallback={<p className="p-8 text-sm">正在读取充值页面…</p>}><RechargeClient /></Suspense>;
}
