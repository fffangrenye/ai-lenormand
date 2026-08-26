export type SupabaseUser = {
  id: string;
  email: string;
};

export type ServerQuotaKind = "deep_reading" | "follow_up";

const RESET_LABEL = "北京时间 00:00";

function getServerSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
    serviceRoleKey
  };
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.trim().toLowerCase());
}

export function getSupabaseServiceConfig() {
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  return { url, serviceRoleKey };
}

export function getSupabaseServiceHeaders(extra?: Record<string, string>): Record<string, string> {
  const { serviceRoleKey } = getServerSupabaseConfig();
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    ...extra
  };

  if (!serviceRoleKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  return headers;
}

export function getBeijingDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export async function requireSupabaseUser(request: Request): Promise<SupabaseUser> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    throw new Error("Unauthorized");
  }

  const { url, anonKey } = getServerSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }

  const payload = (await response.json()) as { id?: string; email?: string };
  if (!payload.id || !payload.email) {
    throw new Error("Unauthorized");
  }

  return {
    id: payload.id,
    email: payload.email
  };
}

async function callQuotaRpc(name: string, body: Record<string, unknown>) {
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getSupabaseServiceHeaders()
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as Array<{ allowed?: boolean; used?: number; remaining?: number }> | null;
  if (!response.ok || !payload?.[0]) {
    throw new Error(`Supabase quota RPC failed: ${response.status}`);
  }

  return {
    allowed: Boolean(payload[0].allowed),
    used: Number(payload[0].used ?? 0),
    remaining: Number(payload[0].remaining ?? 0),
    resetLabel: RESET_LABEL
  };
}

export async function reserveDailyQuota(userId: string, kind: ServerQuotaKind, limit: number) {
  return callQuotaRpc("reserve_daily_ai_quota", {
    p_user_id: userId,
    p_date_key: getBeijingDateKey(),
    p_kind: kind,
    p_limit: limit
  });
}

export async function refundDailyQuota(userId: string, kind: ServerQuotaKind) {
  return callQuotaRpc("refund_daily_ai_quota", {
    p_user_id: userId,
    p_date_key: getBeijingDateKey(),
    p_kind: kind
  });
}
