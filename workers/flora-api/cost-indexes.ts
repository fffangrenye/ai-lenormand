// One-time SQLite indexes. No customer records or balances are rewritten.
export const costIndexes = `
CREATE INDEX IF NOT EXISTS readings_created ON paid_readings(created_at);
CREATE INDEX IF NOT EXISTS ledger_created ON credit_ledger(created_at);
CREATE INDEX IF NOT EXISTS ledger_owner_created ON credit_ledger(user_id,created_at);
CREATE INDEX IF NOT EXISTS checkins_created ON daily_check_ins(created_at);
CREATE INDEX IF NOT EXISTS draws_created ON paid_draw_sessions(created_at);
CREATE INDEX IF NOT EXISTS runs_created ON reading_runs(created_at);
CREATE INDEX IF NOT EXISTS follows_created ON paid_follow_ups(created_at);
CREATE INDEX IF NOT EXISTS codes_redeemed ON local_recharge_codes(redeemed_at);
CREATE INDEX IF NOT EXISTS xianyu_intents_created ON local_xianyu_intents(created_at);
CREATE INDEX IF NOT EXISTS xianyu_deliveries_received ON local_xianyu_deliveries(received_at);
CREATE INDEX IF NOT EXISTS orders_created ON local_orders(created_at);
CREATE INDEX IF NOT EXISTS receipts_created ON local_payment_receipts(created_at);
CREATE INDEX IF NOT EXISTS expired_reading_runs ON reading_runs(lease_until,reading_id) WHERE state='reserved';
CREATE INDEX IF NOT EXISTS expired_followups ON paid_follow_ups(lease_until,reading_id) WHERE state='reserved';
INSERT OR IGNORE INTO local_schema_versions VALUES(10,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
`;
