-- Preserve all cards and rewards earned under the previous cumulative policy.
CREATE TABLE IF NOT EXISTS consecutive_check_in_rewards (
  user_id TEXT NOT NULL REFERENCES local_users(id),
  streak_start TEXT NOT NULL CHECK(length(streak_start)=10),
  milestone INTEGER NOT NULL CHECK(milestone>0 AND milestone%3=0),
  batch_id TEXT NOT NULL UNIQUE REFERENCES credit_batches(id),
  earned_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,streak_start,milestone),
  UNIQUE(user_id,earned_on)
);
INSERT OR IGNORE INTO local_schema_versions VALUES (5,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
