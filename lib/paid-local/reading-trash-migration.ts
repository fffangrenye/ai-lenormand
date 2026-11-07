export const readingTrashMigration = `
ALTER TABLE paid_readings ADD COLUMN deleted_at TEXT;
CREATE INDEX reading_trash_owner ON paid_readings(user_id, deleted_at DESC, id DESC) WHERE deleted_at IS NOT NULL;
INSERT INTO local_schema_versions VALUES (11, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
`;
