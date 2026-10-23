import Link from "next/link";
import type { LocalOrder } from "@/lib/paid-local/types";

export const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
export const orderState: Record<LocalOrder["state"], string> = { pending: "等待付款", processing: "付款核实中", paid: "付款成功", failed: "付款失败", cancelled: "已取消", expired: "已过期", review: "需要人工核实", refunding: "退款处理中", partially_refunded: "已部分退款", refunded: "已退款" };
export const channelName = (channel: string) => channel === "wechat" ? "微信 Native" : "Waffo · 银行卡";
export const paymentButton = "inline-flex min-h-11 items-center justify-center rounded-full border border-[#6E2638]/20 px-5 text-sm text-[#6E2638] transition hover:bg-[#6E2638]/5 disabled:cursor-wait disabled:opacity-40";
export function FeedbackContact() {
  return <aside className="mt-10 border-t border-ink/10 pt-6 text-sm leading-7 text-ink/55"><p>遇到账户、充值或使用问题，欢迎联系我们。</p><a className="break-all text-[#6E2638] underline underline-offset-4" href="mailto:FFFangrenye@outlook.com">FFFangrenye@outlook.com</a><p className="mt-1 text-xs">涉及订单时请附上订单号，方便核查。</p></aside>;
}
export function OrderList({ orders }: { orders: LocalOrder[] }) {
  return orders.length ? <ul className="divide-y divide-ink/10">{orders.map(order => <li key={order.id} className="py-5"><Link href={`/recharge/mock?order=${order.id}`} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{order.credits} 花瓣 · {channelName(order.channel)}<span className="mt-2 block text-xs text-ink/45">{new Date(order.createdAt).toLocaleString("zh-CN")} · {orderState[order.state]}</span></span><span className="text-[#6E2638]">{money(order.amountCents)}{order.promotionVersion && <span className="ml-2 text-xs">首充五折</span>} →</span></Link><p className="mt-2 break-all text-[11px] text-ink/35">订单 {order.id}</p></li>)}</ul> : <p className="py-14 text-center text-sm text-ink/45">还没有充值订单。</p>;
}
