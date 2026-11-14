export const readingReviewMigration = `
ALTER TABLE paid_draw_sessions ADD COLUMN reviewed_context TEXT;
ALTER TABLE paid_readings ADD COLUMN reviewed_context TEXT;
INSERT INTO local_schema_versions VALUES (12, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
`;
