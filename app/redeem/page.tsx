import { Suspense } from "react";
import { RedeemClient } from "@/components/RedeemPage";
export default function RedeemPage(){return <Suspense fallback={<p className="p-8 text-sm">正在读取兑换页面…</p>}><RedeemClient/></Suspense>;}
