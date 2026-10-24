"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Flower2, Home, UserRound } from "lucide-react";
import { paidConfig, packagePrice } from "@/lib/paid-local/config";
import { paidOnlineSiteEnabled, paidSiteEnabled, paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { CardCatalog } from "@/lib/paid-local/card-catalog";

function Dropdown({ label, children, compact = false }: { label: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className="relative shrink-0" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-expanded={open} onClick={() => setOpen(!open)}
      className={`inline-flex items-center justify-center gap-2 rounded-full text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E2638] ${compact ? "min-h-9 px-2 text-xs" : "h-11 border border-ink/10 bg-ivory/80 px-3 text-xs"}`}>
      {label}<ChevronDown size={13} aria-hidden="true" className={open ? "rotate-180" : ""} />
    </button>
    {open && <div onClick={() => setOpen(false)} className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-xl border border-ink/10 bg-[#FFFDF8] p-2 shadow-paper">{children}</div>}
  </div>;
}

const itemClass = "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-ink/75 hover:bg-[#6E2638]/5 focus-visible:bg-[#6E2638]/5 focus-visible:outline-none";

export function AccountMenu() {
  return <Dropdown label={<><UserRound size={16} aria-hidden="true" /><span className="hidden sm:inline">我的</span><span className="sr-only sm:hidden">账户菜单</span></>}>
    <Link prefetch={false} href="/profile" className={itemClass}><UserRound size={17} />我的主页</Link>
    <Link prefetch={false} href="/recharge" className={itemClass}><Flower2 size={17} />充值花瓣</Link>
    <Link prefetch={false} href="/" className={itemClass}><Home size={17} />首页</Link>
  </Dropdown>;
}

export function PetalTopUp({ readingId }: { readingId?: string }) {
  const [catalog, setCatalog] = useState<CardCatalog | null>(null);
  useEffect(() => {
    if (!paidSiteEnabled) return;
    let active = true;
    const load = () => { void paidSiteRequest<CardCatalog>("card-catalog").then(data => { if (active) setCatalog(data); }).catch(() => undefined); };
    load(); window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, []);
  return <Dropdown compact label={<><Flower2 size={14} aria-hidden="true" />充值花瓣</>}>
    <p className="px-3 pb-2 pt-3 text-xs tracking-wider text-clay/70">选择花瓣套餐</p>
    {(catalog?.packages || paidConfig.packages.map(item => packagePrice(item.id))).map((item) => <Link prefetch={false} key={item.id} href={`/recharge?package=${item.id}${readingId ? `&readingId=${encodeURIComponent(readingId)}` : ""}`} className={`${itemClass} justify-between`}>
      <span>{item.credits} 花瓣</span><span>¥{(item.amountCents / 100).toFixed(2)}</span>
    </Link>)}
    <p className="border-t border-ink/8 px-3 py-3 text-xs leading-5 text-ink/45">1 花瓣解锁 1 次主解读，含 2 次追问。<br />{paidOnlineSiteEnabled ? "闲鱼购买充值码，返回本站兑换。" : "本地模拟支付，不产生真实扣款。"}</p>
  </Dropdown>;
}
