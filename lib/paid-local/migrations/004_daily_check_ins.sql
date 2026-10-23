-- V2, isolated local database only. Readings and credit history are preserved.
CREATE TABLE IF NOT EXISTS daily_check_ins (
  user_id TEXT NOT NULL REFERENCES local_users(id),
  date_key TEXT NOT NULL CHECK(length(date_key)=10),
  card_number INTEGER NOT NULL CHECK(card_number BETWEEN 1 AND 36),
  card_json TEXT NOT NULL,
  fortune_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,date_key)
);
CREATE TABLE IF NOT EXISTS check_in_rewards (
  user_id TEXT NOT NULL REFERENCES local_users(id),
  milestone INTEGER NOT NULL CHECK(milestone>0),
  batch_id TEXT NOT NULL UNIQUE REFERENCES credit_batches(id),
  earned_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,milestone)
);
INSERT OR IGNORE INTO local_schema_versions VALUES (4,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
