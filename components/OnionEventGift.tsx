"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/SiteLink";
import { Modal } from "@/components/deep/ConversationManagement";
import { getPaidSiteSession, paidLocalSiteEnabled, paidSiteEnabled, paidSiteRequest, PaidSiteError, subscribePaidSiteRefresh } from "@/lib/paid-local/site-bridge";
import { onionEventActive, type OnionCouponStatus, type OnionEventStatus } from "@/lib/guided-reading/onion-event";

const primary = "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#6E2638] px-6 text-sm text-[#FFF9F2] disabled:opacity-50";
const expiry = (value: string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function OnionEventGift({ opened }: { opened: boolean }) {
  const [event, setEvent] = useState<OnionEventStatus | null>(null);
  const [claimed, setClaimed] = useState<OnionCouponStatus | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soldOut, setSoldOut] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const generation = useRef(0);
  const deadline = useRef(0);

  useEffect(() => {
    // The animation must be explicitly opened. No popup or event request on arrival.
    const localPreview = paidLocalSiteEnabled && process.env.NEXT_PUBLIC_PAID_LOCAL_EVENT_PREVIEW === "1";
    if (!opened || !paidSiteEnabled || (!localPreview && !onionEventActive(Date.now()))) return;
    let disposed = false;
    let closeTimer: ReturnType<typeof setTimeout>;
    let lastOwner: string | undefined;
    const refresh = async () => {
      const request = ++generation.current;
      const owner = getPaidSiteSession()?.userId;
      let exhausted = false;
      const requestedAt = performance.now();
      const status = await paidSiteRequest<OnionEventStatus>("onion-event");
      if (disposed || request !== generation.current || !status.active) { if (!disposed) setEvent(null); return; }
      // Subtract the full round trip so network delay cannot extend the event.
      const remaining = Date.parse(status.endsAt) - Date.parse(status.serverNow) - (performance.now() - requestedAt);
      if (remaining <= 0) return;
      deadline.current = performance.now() + remaining;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => { generation.current++; setEvent(null); }, remaining);
      // Skip known claims on this account, but never trust this cache for issuance.
      if (owner) {
        const value = await paidSiteRequest<OnionCouponStatus>("onion-coupon");
        if (disposed || request !== generation.current || owner !== getPaidSiteSession()?.userId || performance.now() >= deadline.current) return;
        if (value.coupon) { setEvent(null); return; }
        exhausted = value.soldOut;
      }
      lastOwner = owner;
      setGuest(!owner); setSoldOut(exhausted); setClaimed(null); setError(""); setEvent(status);
    };
    // Wait until the four entry cards finish turning over.
    const openTimer = setTimeout(() => { void refresh().catch(() => undefined); }, 1600);
    const unsubscribe = subscribePaidSiteRefresh(reason => {
      if (reason === "account" || getPaidSiteSession()?.userId !== lastOwner) {
        generation.current++; setEvent(null); setClaimed(null); setBusy(false); pending.current = false;
        void refresh().catch(() => undefined);
      } else if (reason === "resume" && deadline.current && performance.now() >= deadline.current) setEvent(null);
    });
    return () => { disposed = true; clearTimeout(openTimer); clearTimeout(closeTimer); unsubscribe(); };
  }, [opened]);

  async function claim() {
    if (pending.current || !event || soldOut) return;
    if (performance.now() >= deadline.current) { setEvent(null); return; }
    const owner = getPaidSiteSession()?.userId;
    if (!owner) { setGuest(true); return; }
    pending.current = true; setBusy(true); setError("");
    const request = generation.current;
    try {
      const value = await paidSiteRequest<OnionCouponStatus>("onion-coupon/claim", { expectedUserId: owner });
      if (request === generation.current && owner === getPaidSiteSession()?.userId && performance.now() < deadline.current) setClaimed(value);
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof PaidSiteError && cause.code === "EVENT_CLOSED") { setEvent(null); return; }
      if (cause instanceof PaidSiteError && cause.code === "EVENT_SOLD_OUT") setSoldOut(true);
      if (cause instanceof PaidSiteError && cause.status === 401) setGuest(true);
      setError(cause instanceof Error ? cause.message : "领取暂未完成，请重试。");
    } finally { pending.current = false; setBusy(false); }
  }

  if (!event) return null;
  return <Modal title={claimed ? "洋葱体验券已到账" : "三万人，谢谢你在这里"} busy={busy} onClose={() => setEvent(null)}>
    <p className="mt-4 text-sm leading-7 text-ink/75">Flora 注册突破三万人，送你一次完整的洋葱解牌。新朋友、老朋友都可以领取。</p>
    <div className="my-5 rounded-xl border border-[#6E2638]/15 bg-[#6E2638]/5 p-5 text-center">
      <p className="font-serif text-2xl text-[#6E2638]">洋葱体验券 × 1</p>
      <p className="mt-2 text-xs leading-6 text-ink/65">九轮解读与最终汇总 · 使用时不扣花瓣</p>
      <p className="text-xs leading-6 text-ink/65">{claimed?.coupon ? `有效至 ${expiry(claimed.coupon.expiresAt)}（北京时间）` : "领取后7天内有效，每个账号限领一次"}</p>
    </div>
    <p className="mb-4 text-xs leading-6 text-ink/60">领取时间：11月23日22:00—24日00:00（北京时间）</p>
    <p className="mb-4 text-xs leading-6 text-[#6E2638]">限量{event.displayClaimLimit}张，先到先得，领完即止。</p>
    {error && <p role="alert" className="mb-3 text-sm text-[#8E4D4A]">{error}</p>}
    {claimed ? <>
      <p role="status" className="mb-3 text-sm text-ink/70">已保存在你的账号里，稍后进入洋葱解牌也可以使用。</p>
      <Link href="/guided" className={primary}>开始洋葱解牌</Link>
    </> : soldOut ? <p role="status" className="rounded-xl bg-ink/5 p-4 text-center text-sm text-ink/70">本次体验券已领完，谢谢你的参与。</p>
      : guest ? <Link href="/login?returnTo=%2F" className={primary}>登录 / 注册后领取</Link>
      : <button type="button" autoFocus disabled={busy} onClick={() => void claim()} className={primary}>{busy ? "正在领取…" : "领取一次洋葱体验"}</button>}
    <button type="button" disabled={busy} onClick={() => setEvent(null)} className="mt-2 min-h-11 w-full text-xs text-ink/60">{claimed ? "稍后再用" : "先逛逛"}</button>
  </Modal>;
}
