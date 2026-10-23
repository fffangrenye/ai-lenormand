"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { paidSiteEnabled, paidSiteRequest } from "@/lib/paid-local/site-bridge";
import type { DailyCheckInState } from "@/lib/paid-local/types";

export function TodayCheckIn() {
  const [signed, setSigned] = useState(false);
  const refresh = useCallback(async () => {
    try { const value = await paidSiteRequest<DailyCheckInState>("daily"); setSigned(Boolean(value.todayEntry)); }
    catch { setSigned(false); }
  }, []);
  useEffect(() => {
    if (!paidSiteEnabled) return;
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    // Refresh the small status on returning to the homepage and across midnight.
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60_000);
    return () => { window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); window.clearInterval(timer); };
  }, [refresh]);
  if (!paidSiteEnabled) return null;
  // Only the destination handles this explicit click intent. Prefetching never signs in.
  return <Link prefetch={false} href={signed ? "/daily#daily-calendar" : "/daily?checkin=1"} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-sage/25 bg-ivory/70 px-3 text-[11px] text-sage transition hover:border-sage/50 hover:bg-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage sm:gap-2 sm:px-4 sm:text-xs">{signed ? <Check size={14} /> : <CalendarDays size={14} />}<span>{signed ? "今日已签" : "今日签到"}</span></Link>;
}
