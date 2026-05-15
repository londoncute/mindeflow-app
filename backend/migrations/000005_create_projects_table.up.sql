CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    source_inbox_id BIGINT UNIQUE REFERENCES inbox(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT projects_status_check
        CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX idx_projects_status ON projects(status);