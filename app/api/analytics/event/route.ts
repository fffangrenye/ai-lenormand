import { NextResponse } from "next/server";
import { getBeijingDateKey, getSupabaseServiceConfig, getSupabaseServiceHeaders } from "@/lib/supabase-server";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "signup_clicked",
  "signin_clicked",
  "referral_landed",
  "share_clicked",
  "copy_prompt",
  "save_cards",
  "daily_draw",
  "yes_no_submit",
  "deep_start",
  "deep_submit",
  "follow_up_submit",
  "ai_success",
  "ai_failed",
  "reading_generation_started",
  "reading_generation_success",
  "reading_generation_failed",
  "quota_exceeded"
]);

type AnalyticsPayload = {
  eventName?: string;
  path?: string;
  url?: string;
  origin?: string;
  host?: string;
  referrer?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanHost(value: unknown) {
  return cleanText(value, 120).toLowerCase().replace(/^https?:\/\//, "").split("/")[0] || "";
}

function getUrlHost(value: unknown) {
  const text = cleanText(value, 500);
  if (!text) return "";

  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function cleanUuid(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .map(([key, entry]) => {
        if (typeof entry === "string") return [key.slice(0, 40), entry.slice(0, 160)];
        if (typeof entry === "number" || typeof entry === "boolean") return [key.slice(0, 40), entry];
        return [key.slice(0, 40), String(entry).slice(0, 160)];
      })
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as AnalyticsPayload;
    const eventName = cleanText(payload.eventName, 40);
    const path = cleanText(payload.path, 240);
    const sessionId = cleanText(payload.sessionId, 80);
    const metadata = cleanMetadata(payload.metadata);
    const requestHost = cleanHost(request.headers.get("host"));
    const requestOrigin = cleanText(request.headers.get("origin"), 240);
    const referrer = cleanText(payload.referrer, 300);
    const host = cleanHost(payload.host) || getUrlHost(payload.url) || requestHost;
    const origin = cleanText(payload.origin, 240) || requestOrigin;
    const referrerHost = cleanHost(metadata.referrerHost) || getUrlHost(referrer);
    const channel = cleanText(metadata.channel, 80) || (referrerHost && referrerHost !== host ? referrerHost : referrer ? "internal" : "direct");

    if (!ALLOWED_EVENTS.has(eventName) || !path || !sessionId) {
      return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
    }

    const { url } = getSupabaseServiceConfig();
    const response = await fetch(`${url}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getSupabaseServiceHeaders(),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        user_id: cleanUuid(payload.userId),
        visitor_id: sessionId,
        session_id: sessionId,
        event_name: eventName,
        reading_id: cleanUuid(metadata.readingId),
        spread_type: cleanText(metadata.spreadType, 40) || null,
        channel: channel || null,
        referrer: referrer || null,
        properties: {
          ...metadata,
          path,
          url: cleanText(payload.url, 500) || null,
          origin: origin || null,
          host: host || null,
          site: host || requestHost || null,
          requestHost: requestHost || null,
          requestOrigin: requestOrigin || null,
          referrerHost: referrerHost || null,
          channel: channel || null,
          dateKey: getBeijingDateKey(),
          userAgent: cleanText(request.headers.get("user-agent"), 400) || null
        }
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Analytics insert failed: ${response.status} ${message.slice(0, 240)}`);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 204 });
  }
}
