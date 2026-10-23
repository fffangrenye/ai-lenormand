CREATE TABLE IF NOT EXISTS local_xianyu_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_users(id),
  request_key TEXT NOT NULL,
  account_hash TEXT NOT NULL UNIQUE,
  goods_no TEXT NOT NULL,
  seller_identity TEXT NOT NULL,
  product_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK(credits > 0),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  first_purchase INTEGER NOT NULL CHECK(first_purchase IN (0,1)),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','paid','review','expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(user_id, request_key)
);
CREATE TABLE IF NOT EXISTS local_xianyu_deliveries (
  provider_order_no TEXT PRIMARY KEY,
  xianyu_order_no TEXT NOT NULL UNIQUE,
  intent_id TEXT NOT NULL UNIQUE REFERENCES local_xianyu_intents(id),
  evidence_hash TEXT NOT NULL,
  batch_id TEXT UNIQUE REFERENCES credit_batches(id),
  state TEXT NOT NULL CHECK(state IN ('granted','review')),
  received_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO local_schema_versions VALUES(7,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
