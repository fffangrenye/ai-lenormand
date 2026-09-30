"use client";

import { getSession } from "@/lib/project-store";

const ANALYTICS_SESSION_KEY = "ai-lenormand:analytics-session";
const ANALYTICS_FIRST_TOUCH_KEY = "ai-lenormand:first-touch";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"] as const;

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

type AnalyticsEventName =
  | "page_view"
  | "signup_clicked"
  | "signin_clicked"
  | "password_reset_code_requested"
  | "password_reset_submitted"
  | "referral_landed"
  | "share_clicked"
  | "copy_prompt"
  | "save_cards"
  | "daily_draw"
  | "yes_no_submit"
  | "deep_start"
  | "deep_submit"
  | "follow_up_submit";

function getSearchMetadata() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(UTM_KEYS.map((key) => [key, params.get(key) || ""]).filter(([, value]) => value));
}

function getHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getChannel(searchMetadata = getSearchMetadata()) {
  if (searchMetadata.utm_source) return String(searchMetadata.utm_source);
  if (searchMetadata.ref) return String(searchMetadata.ref);

  const referrerHost = getHost(document.referrer);
  const currentHost = window.location.hostname.toLowerCase();
  if (!referrerHost) return "direct";
  if (referrerHost === currentHost) return "internal";
  if (referrerHost.includes("instagram")) return "instagram";
  if (referrerHost.includes("tiktok")) return "tiktok";
  if (referrerHost.includes("xiaohongshu") || referrerHost.includes("xhs")) return "xiaohongshu";
  if (referrerHost.includes("google")) return "google";
  if (referrerHost.includes("bing")) return "bing";
  if (referrerHost.includes("baidu")) return "baidu";
  return referrerHost;
}

function getFirstTouchMetadata(channel: string, searchMetadata: Record<string, string>) {
  const landing = {
    firstTouchAt: new Date().toISOString(),
    firstTouchChannel: channel,
    firstTouchLandingPath: `${window.location.pathname}${window.location.search}`,
    firstTouchLandingUrl: window.location.href,
    firstTouchHost: window.location.hostname.toLowerCase(),
    firstTouchReferrer: document.referrer,
    ...Object.fromEntries(Object.entries(searchMetadata).map(([key, value]) => [`first_${key}`, value]))
  };

  try {
    const existing = window.localStorage.getItem(ANALYTICS_FIRST_TOUCH_KEY);
    if (existing) return JSON.parse(existing) as Record<string, unknown>;
    window.localStorage.setItem(ANALYTICS_FIRST_TOUCH_KEY, JSON.stringify(landing));
  } catch {
    // Ignore localStorage issues; tracking still works with current-touch data.
  }

  return landing;
}

export function trackAnalyticsEvent(eventName: AnalyticsEventName, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const session = getSession();
  const searchMetadata = getSearchMetadata();
  const safeUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const channel = String(metadata?.channel ?? getChannel(searchMetadata));
  const firstTouch = getFirstTouchMetadata(channel, searchMetadata);
  const payload = {
    eventName,
    path: `${window.location.pathname}${window.location.search}`,
    url: safeUrl,
    origin: window.location.origin,
    host: window.location.hostname.toLowerCase(),
    referrer: document.referrer,
    sessionId: getAnalyticsSessionId(),
    userId: session?.userId,
    metadata: {
      ...searchMetadata,
      ...firstTouch,
      ...metadata,
      channel,
      referrerHost: getHost(document.referrer) || null
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

