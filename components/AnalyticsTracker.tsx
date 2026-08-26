"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSession } from "@/lib/project-store";

const ANALYTICS_SESSION_KEY = "ai-lenormand:analytics-session";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAnalyticsSessionId() {
  try {
    const existing = window.localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) return existing;

    const next = createSessionId();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

type AnalyticsEventName = "page_view" | "signup_clicked" | "referral_landed" | "share_clicked" | "deep_start" | "deep_submit" | "follow_up_submit";

function getChannel() {
  const params = new URLSearchParams(window.location.search);
  return params.get("utm_source") || params.get("ref") || "";
}

export function trackAnalyticsEvent(eventName: AnalyticsEventName, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const session = getSession();
  const payload = {
    eventName,
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer,
    sessionId: getAnalyticsSessionId(),
    userId: session?.userId,
    metadata: {
      ...metadata,
      channel: metadata?.channel ?? getChannel()
    }
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/event", blob);
    return;
  }

  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // Analytics should never interrupt the reading flow.
  });
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackAnalyticsEvent("page_view", { title: document.title });
  }, [pathname]);

  return null;
}
