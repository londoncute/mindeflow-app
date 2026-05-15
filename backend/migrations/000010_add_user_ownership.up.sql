ALTER TABLE inbox
    ADD COLUMN IF NOT EXISTS user_id BIGINT;

UPDATE inbox
SET user_id = 1
WHERE user_id IS NULL;

ALTER TABLE inbox
    ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inbox_user_id_fkey'
    ) THEN
        ALTER TABLE inbox
            ADD CONSTRAINT inbox_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbox_user_id ON inbox(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_user_position ON inbox(user_id, position);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS user_id BIGINT;

UPDATE projects p
SET user_id = i.user_id
FROM inbox i
WHERE p.user_id IS NULL
  AND p.source_inbox_id = i.id;

UPDATE projects
SET user_id = 1
WHERE user_id IS NULL;

ALTER TABLE projects
    ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'projects_user_id_fkey'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status);

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS user_id BIGINT;

UPDATE tasks t
SET user_id = p.user_id
FROM projects p
WHERE t.user_id IS NULL
  AND t.project_id = p.id;

UPDATE tasks
SET user_id = 1
WHERE user_id IS NULL;

ALTER TABLE tasks
    ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_user_id_fkey'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT tasks_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_project_wave ON tasks(user_id, project_id, wave);
