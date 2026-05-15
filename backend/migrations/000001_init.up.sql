CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

INSERT INTO users (id, full_name, email)
VALUES (1, 'user', 'user@example.com')
ON CONFLICT (id) DO NOTHING;