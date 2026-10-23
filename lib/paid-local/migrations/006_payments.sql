ALTER TABLE credit_batches ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked>=0);
CREATE TRIGGER credit_revocation_insert BEFORE INSERT ON credit_batches WHEN NEW.revoked+NEW.reserved+NEW.consumed>NEW.quantity BEGIN SELECT RAISE(ABORT,'credit batch overdraw'); END;
CREATE TRIGGER credit_revocation_update BEFORE UPDATE ON credit_batches WHEN NEW.revoked+NEW.reserved+NEW.consumed>NEW.quantity BEGIN SELECT RAISE(ABORT,'credit batch overdraw'); END;
CREATE TABLE local_orders (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES local_users(id),request_key TEXT NOT NULL,
 package_id TEXT NOT NULL,credits INTEGER NOT NULL CHECK(credits>0),regular_cents INTEGER NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),currency TEXT NOT NULL CHECK(currency='CNY'),
 channel TEXT NOT NULL CHECK(channel IN ('wechat','waffo')),promotion_version TEXT,
 state TEXT NOT NULL CHECK(state IN ('pending','processing','paid','failed','cancelled','expired','review','refunding','partially_refunded','refunded')),
 fulfillment TEXT NOT NULL DEFAULT 'none' CHECK(fulfillment IN ('none','granted','needs_review')),
 reading_id TEXT REFERENCES paid_readings(id),return_path TEXT NOT NULL,
 batch_id TEXT UNIQUE REFERENCES credit_batches(id),created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,paid_at TEXT,
 UNIQUE(user_id,request_key)
);
CREATE UNIQUE INDEX one_open_order ON local_orders(user_id) WHERE state IN ('pending','processing');
CREATE TABLE local_purchase_history(user_id TEXT PRIMARY KEY REFERENCES local_users(id),first_order_id TEXT NOT NULL REFERENCES local_orders(id),paid_at TEXT NOT NULL);
CREATE TABLE local_payment_receipts(
 order_id TEXT PRIMARY KEY REFERENCES local_orders(id),channel TEXT NOT NULL,transaction_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('success','failed')),notify_after INTEGER NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(channel,transaction_id)
);
CREATE TABLE local_payment_events(id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,order_id TEXT NOT NULL REFERENCES local_orders(id),outcome TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE local_refunds(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES local_orders(id),request_key TEXT NOT NULL UNIQUE,
 credits INTEGER NOT NULL CHECK(credits>=0),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),state TEXT NOT NULL CHECK(state IN ('pending','succeeded','failed')),
 reason TEXT NOT NULL,created_at TEXT NOT NULL,completed_at TEXT
);
CREATE UNIQUE INDEX one_pending_refund ON local_refunds(order_id) WHERE state='pending';
CREATE TABLE local_payment_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE local_admin_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
CREATE TABLE local_admin_attempts(created_at INTEGER NOT NULL);
INSERT INTO local_schema_versions VALUES(6,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
