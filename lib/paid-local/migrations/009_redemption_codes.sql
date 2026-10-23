-- Isolated local voucher redemption. No payment-provider credentials or raw codes.
CREATE TABLE local_code_batches (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, package_id TEXT NOT NULL,
 credits INTEGER NOT NULL CHECK(credits IN (1,5,10)), price_cents INTEGER NOT NULL CHECK(price_cents>0),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 500), actor TEXT NOT NULL,
 reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE local_recharge_codes (
 id TEXT PRIMARY KEY, code_batch_id TEXT NOT NULL REFERENCES local_code_batches(id),
 code_hash TEXT NOT NULL UNIQUE, suffix TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','redeemed','disabled','refunded')),
 redeemed_by TEXT REFERENCES local_users(id), credit_batch_id TEXT UNIQUE REFERENCES credit_batches(id),
 redeemed_at TEXT, reading_id TEXT REFERENCES paid_readings(id), return_path TEXT NOT NULL DEFAULT '/profile',
 refunded_credits INTEGER NOT NULL DEFAULT 0 CHECK(refunded_credits>=0),
 refund_review INTEGER NOT NULL DEFAULT 0 CHECK(refund_review IN (0,1)),
 CHECK((redeemed_by IS NULL AND credit_batch_id IS NULL AND redeemed_at IS NULL) OR (redeemed_by IS NOT NULL AND credit_batch_id IS NOT NULL AND redeemed_at IS NOT NULL))
);
CREATE INDEX local_code_batches_created ON local_code_batches(created_at);
CREATE INDEX local_code_owner ON local_recharge_codes(redeemed_by,redeemed_at);
CREATE TABLE local_code_attempts(user_id TEXT NOT NULL REFERENCES local_users(id), created_at INTEGER NOT NULL);
CREATE INDEX local_code_attempt_window ON local_code_attempts(user_id,created_at);
CREATE TABLE local_code_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO local_schema_versions VALUES(9,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
