CREATE SEQUENCE IF NOT EXISTS users_id_seq;

ALTER TABLE users
    ALTER COLUMN id SET DEFAULT nextval('users_id_seq');

SELECT setval(
    'users_id_seq',
    COALESCE((SELECT MAX(id) FROM users), 1),
    true
);
