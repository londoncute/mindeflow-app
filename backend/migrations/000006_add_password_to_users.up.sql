ALTER TABLE users
ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'mindflow123';

UPDATE users
SET password = 'mindflow123'
WHERE password IS NULL OR password = '';
