import { NextResponse } from "next/server";
import { getBeijingDateKey, getSupabaseServiceConfig, getSupabaseServiceHeaders } from "@/lib/supabase-server";

const ALLOWED_EVENTS = new Set(["page_view", "signup_clicked", "referral_landed", "share_clicked", "deep_start", "deep_submit", "follow_up_submit"]);

type AnalyticsPayload = {
  eventName?: string;
  path?: string;
  referrer?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
        reading_id: cleanUuid(payload.metadata?.readingId),
        spread_type: cleanText(payload.metadata?.spreadType, 40) || null,
        channel: cleanText(payload.metadata?.channel, 80) || null,
        referrer: cleanText(payload.referrer, 300) || null,
        properties: {
          ...cleanMetadata(payload.metadata),
          path,
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
