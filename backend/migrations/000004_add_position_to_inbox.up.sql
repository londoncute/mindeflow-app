ALTER TABLE inbox ADD COLUMN position BIGINT;

UPDATE inbox
SET position = sub.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
    FROM inbox
) sub
WHERE inbox.id = sub.id;

ALTER TABLE inbox ALTER COLUMN position SET NOT NULL;

CREATE INDEX idx_inbox_position ON inbox(position);