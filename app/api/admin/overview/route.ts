import { NextResponse } from "next/server";
import { getBeijingDateKey, getSupabaseServiceConfig, getSupabaseServiceHeaders, isAdminEmail, requireSupabaseUser } from "@/lib/supabase-server";

type AuthUser = {
  user_id: string;
  email: string;
  created_at: string;
  last_seen_at: string;
};

type DailyUsageRow = {
  user_id: string;
  date_key: string;
  deep_reading_used: number;
  follow_up_used: number;
  updated_at: string;
};

type AnalyticsEventRow = {
  user_id: string | null;
  visitor_id: string | null;
  session_id: string | null;
  event_name: string;
  path?: string | null;
  created_at: string;
  properties?: Record<string, unknown>;
};

type UserActivity = {
  userId: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  todayDeepReading: number;
  todayFollowUp: number;
  totalDeepReading: number;
  totalFollowUp: number;
};

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

async function supabaseServiceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getSupabaseServiceConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...getSupabaseServiceHeaders(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase admin request failed: ${response.status} ${message.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

async function supabaseCount(table: string, query = "") {
  const { url } = getSupabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/${table}?select=id${query}&limit=1`, {
    method: "HEAD",
    headers: {
      ...getSupabaseServiceHeaders(),
      Prefer: "count=exact"
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase count failed: ${table} ${response.status}`);
  }

  const range = response.headers.get("content-range") ?? "0-0/0";
  return Number(range.split("/")[1] ?? 0);
}

async function safeSupabaseServiceFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseServiceFetch<T>(path);
  } catch {
    return fallback;
  }
}

async function safeSupabaseCount(table: string, query = "") {
  try {
    return await supabaseCount(table, query);
  } catch {
    return 0;
  }
}

function sumUsage(rows: DailyUsageRow[], userId: string, kind: "deep_reading_used" | "follow_up_used") {
  return rows.filter((row) => row.user_id === userId).reduce((total, row) => total + Number(row[kind] ?? 0), 0);
}

function countEvents(rows: AnalyticsEventRow[], eventName: string) {
  return rows.filter((row) => row.event_name === eventName).length;
}

function countUniqueVisitors(rows: AnalyticsEventRow[]) {
  return new Set(rows.map((row) => row.visitor_id || row.session_id).filter(Boolean)).size;
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request);

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "无权限访问管理员后台。" }, { status: 403 });
    }

    const today = getBeijingDateKey();
    const [users, allUsageRows, todayUsageRows, analyticsRows, projectCount, readingCount, followUpMessageCount, completedReadingCount] = await Promise.all([
      safeSupabaseServiceFetch<AuthUser[]>("/rest/v1/user_profiles?select=*&order=created_at.desc&limit=1000", []),
      safeSupabaseServiceFetch<DailyUsageRow[]>("/rest/v1/daily_ai_usage?select=*&order=updated_at.desc", []),
      safeSupabaseServiceFetch<DailyUsageRow[]>(`/rest/v1/daily_ai_usage?select=*&date_key=eq.${encodeURIComponent(today)}&order=updated_at.desc`, []),
      safeSupabaseServiceFetch<AnalyticsEventRow[]>("/rest/v1/analytics_events?select=*&order=created_at.desc&limit=5000", []),
      safeSupabaseCount("deep_projects"),
      safeSupabaseCount("deep_readings"),
      safeSupabaseCount("deep_follow_up_messages", "&role=eq.user"),
      safeSupabaseCount("deep_readings", "&status=eq.completed")
    ]);

    const todayEvents = analyticsRows.filter((row) => getBeijingDateKey(row.created_at) === today);
    const todayDeepReading = todayUsageRows.reduce((total, row) => total + Number(row.deep_reading_used ?? 0), 0);
    const todayFollowUp = todayUsageRows.reduce((total, row) => total + Number(row.follow_up_used ?? 0), 0);
    const totalDeepReading = allUsageRows.reduce((total, row) => total + Number(row.deep_reading_used ?? 0), 0);
    const totalFollowUp = allUsageRows.reduce((total, row) => total + Number(row.follow_up_used ?? 0), 0);

    const recentUsers: UserActivity[] = users
      .map((authUser) => {
        const userId = authUser.user_id;
        const todayRow = todayUsageRows.find((row) => row.user_id === userId);
        return {
          userId,
          email: authUser.email,
          createdAt: authUser.created_at,
          lastSignInAt: authUser.last_seen_at,
          todayDeepReading: Number(todayRow?.deep_reading_used ?? 0),
          todayFollowUp: Number(todayRow?.follow_up_used ?? 0),
          totalDeepReading: sumUsage(allUsageRows, userId, "deep_reading_used"),
          totalFollowUp: sumUsage(allUsageRows, userId, "follow_up_used")
        };
      })
      .sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0"))
      .slice(0, 50);

    return NextResponse.json({
      today,
      summary: {
        totalUsers: users.length,
        todayActiveUsers: todayUsageRows.length,
        todayDeepReading,
        todayFollowUp,
        totalDeepReading,
        totalFollowUp,
        projectCount,
        readingCount,
        completedReadingCount,
        followUpQuestionCount: followUpMessageCount,
        todayPageViews: countEvents(todayEvents, "page_view"),
        todayVisitors: countUniqueVisitors(todayEvents),
        todayDeepStarts: countEvents(todayEvents, "deep_start"),
        todayDeepSubmits: countEvents(todayEvents, "deep_submit"),
        todayAiSuccess: countEvents(todayEvents, "ai_success"),
        todayAiFailed: countEvents(todayEvents, "ai_failed"),
        todayQuotaExceeded: countEvents(todayEvents, "quota_exceeded"),
        todayBalanceInsufficient: todayEvents.filter((row) => row.event_name === "ai_failed" && row.properties?.failure_reason === "insufficient_balance").length,
        todayProviderRateLimited: todayEvents.filter((row) => row.event_name === "ai_failed" && row.properties?.failure_reason === "rate_limited").length,
        todayInvalidResponse: todayEvents.filter((row) => row.event_name === "ai_failed" && row.properties?.failure_reason === "invalid_response").length,
        totalPageViews: countEvents(analyticsRows, "page_view")
      },
      recentUsers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理员数据读取失败。";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
