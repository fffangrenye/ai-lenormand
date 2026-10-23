-- Local SQLite only. Preserve existing readings, runs, ledger and project links.
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TABLE paid_readings_v3 (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), request_key TEXT NOT NULL,
  question TEXT NOT NULL, spread TEXT NOT NULL CHECK(spread IN ('three_card','five_card_linear','matrix_six','cross_five','choice_two','choice_three','h_seven','nine_grid')),
  cards_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'locked' CHECK(state IN ('locked','generating','completed','failed')),
  result_json TEXT, active_run TEXT, created_at TEXT NOT NULL, choices_json TEXT NOT NULL DEFAULT '[]', UNIQUE(user_id,request_key),
  CHECK((state='completed' AND result_json IS NOT NULL) OR (state<>'completed' AND result_json IS NULL))
);
INSERT INTO paid_readings_v3(id,user_id,request_key,question,spread,cards_json,state,result_json,active_run,created_at)
  SELECT id,user_id,request_key,question,spread,cards_json,state,result_json,active_run,created_at FROM paid_readings;
DROP TABLE paid_readings;
ALTER TABLE paid_readings_v3 RENAME TO paid_readings;
CREATE INDEX paid_reading_owner ON paid_readings(user_id,created_at);
CREATE TABLE paid_draw_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_users(id), project_id TEXT NOT NULL REFERENCES local_projects(id),
  request_key TEXT NOT NULL, question TEXT NOT NULL, spread TEXT NOT NULL, choices_json TEXT NOT NULL,
  deck_json TEXT NOT NULL, selected_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'picking' CHECK(state IN ('picking','completed','abandoned')),
  reading_id TEXT REFERENCES paid_readings(id), created_at TEXT NOT NULL, UNIQUE(user_id,request_key)
);
CREATE INDEX local_draw_owner ON paid_draw_sessions(user_id,project_id,state,created_at);
INSERT INTO local_schema_versions VALUES (3,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
COMMIT;
PRAGMA foreign_keys = ON;
