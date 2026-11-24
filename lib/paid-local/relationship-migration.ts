export const relationshipMigration = `
ALTER TABLE paid_readings ADD COLUMN relationship_json TEXT NOT NULL DEFAULT 'null';
ALTER TABLE paid_draw_sessions ADD COLUMN relationship_json TEXT NOT NULL DEFAULT 'null';
INSERT INTO local_schema_versions VALUES(15, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
`;
