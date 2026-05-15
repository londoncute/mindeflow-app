DROP INDEX IF EXISTS idx_tasks_user_project_wave;
DROP INDEX IF EXISTS idx_tasks_user_id;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS user_id;

DROP INDEX IF EXISTS idx_projects_user_status;
DROP INDEX IF EXISTS idx_projects_user_id;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE projects DROP COLUMN IF EXISTS user_id;

DROP INDEX IF EXISTS idx_inbox_user_position;
DROP INDEX IF EXISTS idx_inbox_user_id;
ALTER TABLE inbox DROP CONSTRAINT IF EXISTS inbox_user_id_fkey;
ALTER TABLE inbox DROP COLUMN IF EXISTS user_id;
