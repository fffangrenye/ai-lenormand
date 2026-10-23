-- Local-only adapter for the existing site's project workflow.
CREATE TABLE IF NOT EXISTS local_projects (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), title TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT '', memory_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT NOT NULL, archived_at TEXT
);
CREATE TABLE IF NOT EXISTS local_reading_projects (
  reading_id TEXT PRIMARY KEY REFERENCES paid_readings(id), project_id TEXT NOT NULL REFERENCES local_projects(id)
);
CREATE INDEX IF NOT EXISTS local_project_owner ON local_projects(user_id,last_opened_at);
INSERT OR IGNORE INTO local_schema_versions VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
