-- Local SQLite only. Not a Supabase/production migration.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('new','legacy','other')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_batches (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), source TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE, quantity INTEGER NOT NULL CHECK(quantity > 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed >= 0),
  created_at TEXT NOT NULL, CHECK(reserved + consumed <= quantity)
);
CREATE INDEX IF NOT EXISTS credit_owner ON credit_batches(user_id, created_at);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), batch_id TEXT NOT NULL REFERENCES credit_batches(id),
  event_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, available_delta INTEGER NOT NULL,
  reserved_delta INTEGER NOT NULL, consumed_delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS paid_readings (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), request_key TEXT NOT NULL,
  question TEXT NOT NULL, spread TEXT NOT NULL CHECK(spread IN ('three_card','five_card_linear')), cards_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'locked' CHECK(state IN ('locked','generating','completed','failed')),
  result_json TEXT, active_run TEXT, created_at TEXT NOT NULL, UNIQUE(user_id, request_key),
  CHECK((state='completed' AND result_json IS NOT NULL) OR (state<>'completed' AND result_json IS NULL))
);
CREATE INDEX IF NOT EXISTS paid_reading_owner ON paid_readings(user_id, created_at);
CREATE TABLE IF NOT EXISTS reading_runs (
  id TEXT PRIMARY KEY, reading_id TEXT NOT NULL REFERENCES paid_readings(id), batch_id TEXT NOT NULL REFERENCES credit_batches(id),
  state TEXT NOT NULL CHECK(state IN ('reserved','completed','released')), lease_until INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS active_reading_run ON reading_runs(reading_id) WHERE state='reserved';
CREATE TABLE IF NOT EXISTS paid_follow_ups (
  id TEXT PRIMARY KEY, reading_id TEXT NOT NULL REFERENCES paid_readings(id), request_key TEXT NOT NULL, question TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','completed','released')), answer TEXT, lease_until INTEGER NOT NULL, attempt TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(reading_id, request_key),
  CHECK(state<>'completed' OR answer IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS local_schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
INSERT OR IGNORE INTO local_schema_versions VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
