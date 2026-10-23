type Sql = { exec(query: string, ...args: unknown[]): { toArray(): Record<string, unknown>[] } };

export const SITE_HOST = "floralenormand.site";

export function ensureTelemetrySchema(sql: Sql) {
  sql.exec(`CREATE TABLE IF NOT EXISTS site_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT,
    visitor_id TEXT,
    session_id TEXT,
    path TEXT,
    channel TEXT,
    host TEXT NOT NULL,
    reason TEXT,
    request_id TEXT,
    created_at TEXT NOT NULL
  )`);
  sql.exec("CREATE INDEX IF NOT EXISTS site_events_created ON site_events(created_at, name)");
  sql.exec("CREATE INDEX IF NOT EXISTS site_events_visitor ON site_events(visitor_id, created_at)");
}

export type SiteEvent = {
  id: string;
  name: string;
  userId?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  channel?: string | null;
  reason?: string | null;
  requestId?: string | null;
  host: string;
};

export function recordSiteEvent(sql: Sql, event: SiteEvent) {
  sql.exec(
    "INSERT OR IGNORE INTO site_events(id,name,user_id,visitor_id,session_id,path,channel,host,reason,request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    event.id, event.name, event.userId || null, event.visitorId || null,
    event.sessionId || null, event.path || null, event.channel || null,
    event.host, event.reason || null, event.requestId || null, new Date().toISOString()
  );
}

function dateBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid report date");
  const start = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== new Date(`${date}T00:00:00+08:00`).toISOString().slice(0, 10)) throw new Error("Invalid report date");
  return [start.toISOString(), new Date(start.getTime() + 86_400_000).toISOString()] as const;
}

export function readDailyReport(sql: Sql, date: string) {
  const [start, end] = dateBounds(date);
  const one = (query: string, ...args: unknown[]) => sql.exec(query, ...args).toArray()[0] || {};
  const rows = (query: string, ...args: unknown[]) => sql.exec(query, ...args).toArray();
  const events = one(`SELECT count(*) events,
    count(DISTINCT CASE WHEN name='page_view' THEN visitor_id END) page_view_uv,
    count(DISTINCT CASE WHEN name='page_view' THEN session_id END) sessions,
    count(DISTINCT user_id) known_users,
    sum(CASE WHEN name='page_view' THEN 1 ELSE 0 END) page_views,
    sum(CASE WHEN name='signup_succeeded' THEN 1 ELSE 0 END) signup_success,
    sum(CASE WHEN name='signin_succeeded' THEN 1 ELSE 0 END) signin_success,
    sum(CASE WHEN name='signin_failed' THEN 1 ELSE 0 END) signin_failed,
    sum(CASE WHEN name='ai_call_started' AND path='/api/flora/unlock' THEN 1 ELSE 0 END) initial_ai_calls,
    sum(CASE WHEN name='ai_call_failed' AND path='/api/flora/unlock' THEN 1 ELSE 0 END) initial_ai_failures,
    sum(CASE WHEN name='ai_call_started' AND path='/api/flora/follow-up' THEN 1 ELSE 0 END) follow_up_ai_calls,
    sum(CASE WHEN name='ai_call_failed' AND path='/api/flora/follow-up' THEN 1 ELSE 0 END) follow_up_ai_failures,
    sum(CASE WHEN name='quota_limited' THEN 1 ELSE 0 END) quota_limited,
    sum(CASE WHEN name='initial_eligible' THEN 1 ELSE 0 END) initial_eligible
    FROM site_events WHERE created_at>=? AND created_at<? AND host=?`, start, end, SITE_HOST);
  const behavior = rows("SELECT name,count(*) n FROM site_events WHERE created_at>=? AND created_at<? AND host=? GROUP BY name ORDER BY n DESC", start, end, SITE_HOST);
  const channels = rows("SELECT coalesce(channel,'unknown') channel,count(*) views FROM site_events WHERE created_at>=? AND created_at<? AND host=? AND name='page_view' GROUP BY channel ORDER BY views DESC", start, end, SITE_HOST);
  const pages = rows("SELECT path,count(*) views FROM site_events WHERE created_at>=? AND created_at<? AND host=? AND name='page_view' GROUP BY path ORDER BY views DESC", start, end, SITE_HOST);
  const hours = rows("SELECT substr(datetime(created_at,'+8 hours'),12,2) hour,count(*) views FROM site_events WHERE created_at>=? AND created_at<? AND host=? AND name='page_view' GROUP BY hour ORDER BY hour", start, end, SITE_HOST);
  const failureReasons = rows("SELECT path,coalesce(reason,'unknown') reason,count(DISTINCT request_id) n FROM site_events WHERE created_at>=? AND created_at<? AND host=? AND name='ai_call_failed' GROUP BY path,reason", start, end, SITE_HOST);
  const business = {
    users: one("SELECT count(*) active_users FROM local_users WHERE id IN (SELECT user_id FROM paid_readings WHERE created_at>=? AND created_at<? UNION SELECT user_id FROM daily_check_ins WHERE created_at>=? AND created_at<? UNION SELECT user_id FROM paid_draw_sessions WHERE created_at>=? AND created_at<?)", start, end, start, end, start, end),
    dailyDraws: one("SELECT count(*) n FROM daily_check_ins WHERE created_at>=? AND created_at<?", start, end),
    drawSessions: one("SELECT state,count(*) n FROM paid_draw_sessions WHERE created_at>=? AND created_at<? GROUP BY state", start, end),
    readings: rows("SELECT state,count(*) n FROM paid_readings WHERE created_at>=? AND created_at<? GROUP BY state", start, end),
    readingRuns: rows("SELECT state,count(*) n FROM reading_runs WHERE created_at>=? AND created_at<? GROUP BY state", start, end),
    followUps: rows("SELECT state,count(*) n FROM paid_follow_ups WHERE created_at>=? AND created_at<? GROUP BY state", start, end),
    codeBatches: one("SELECT count(*) batches,coalesce(sum(quantity),0) codes FROM local_code_batches WHERE created_at>=? AND created_at<?", start, end),
    redemptions: one("SELECT count(*) n FROM local_recharge_codes WHERE redeemed_at>=? AND redeemed_at<?", start, end),
    creditLedger: rows("SELECT kind,count(*) entries,coalesce(sum(available_delta),0) available_delta FROM credit_ledger WHERE created_at>=? AND created_at<? GROUP BY kind", start, end),
    xianyuIntents: rows("SELECT state,count(*) n,coalesce(sum(amount_cents),0) amount_cents FROM local_xianyu_intents WHERE created_at>=? AND created_at<? GROUP BY state", Date.parse(start), Date.parse(end)),
    xianyuDeliveries: one("SELECT count(*) n FROM local_xianyu_deliveries WHERE received_at>=? AND received_at<?", Date.parse(start), Date.parse(end)),
    paymentOrders: rows("SELECT state,fulfillment,count(*) n,coalesce(sum(amount_cents),0) amount_cents FROM local_orders WHERE created_at>=? AND created_at<? GROUP BY state,fulfillment", start, end),
    paymentReceipts: rows("SELECT status,count(*) n,coalesce(sum(amount_cents),0) amount_cents FROM local_payment_receipts WHERE created_at>=? AND created_at<? GROUP BY status", start, end)
  };
  return { site: SITE_HOST, date, timezone: "Asia/Shanghai", start, end, generatedAt: new Date().toISOString(), events, behavior, channels, pages, hours, failureReasons, business };
}
