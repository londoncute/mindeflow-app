package repository

import (
	"context"

	"mindeflow-app/backend/internal/project"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Create(ctx context.Context, input project.CreateInput) (project.Project, error) {
	query := `
		INSERT INTO projects (title, description, source_inbox_id)
		VALUES ($1, $2, $3)
		RETURNING id, title, description, status, source_inbox_id, created_at, updated_at, completed_at
	`

	var p project.Project

	err := r.pool.QueryRow(ctx, query,
		input.Title,
		input.Description,
		input.SourceInboxID,
	).Scan(
		&p.ID,
		&p.Title,
		&p.Description,
		&p.Status,
		&p.SourceInboxID,
		&p.CreatedAt,
		&p.UpdatedAt,
		&p.CompletedAt,
	)
	if err != nil {
		return project.Project{}, err
	}

	return p, nil
}

func (r *PostgresRepository) List(ctx context.Context, filter project.ListFilter) (project.ListResult, error) {
	countQuery := `
		SELECT COUNT(*)
		FROM projects
		WHERE ($1::text IS NULL OR status = $1)
	`

	dataQuery := `
		SELECT id, title, description, status, source_inbox_id, created_at, updated_at, completed_at
		FROM projects
		WHERE ($1::text IS NULL OR status = $1)
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	var total int
	err := r.pool.QueryRow(ctx, countQuery, filter.Status).Scan(&total)
	if err != nil {
		return project.ListResult{}, err
	}

	rows, err := r.pool.Query(ctx, dataQuery, filter.Status, filter.Limit, filter.Offset)
	if err != nil {
		return project.ListResult{}, err
	}
	defer rows.Close()

	items := make([]project.Project, 0)

	for rows.Next() {
		var p project.Project

		err := rows.Scan(
			&p.ID,
			&p.Title,
			&p.Description,
			&p.Status,
			&p.SourceInboxID,
			&p.CreatedAt,
			&p.UpdatedAt,
			&p.CompletedAt,
		)
		if err != nil {
			return project.ListResult{}, err
		}

		items = append(items, p)
	}

	if err := rows.Err(); err != nil {
		return project.ListResult{}, err
	}

	return project.ListResult{
		Items:  items,
		Limit:  filter.Limit,
		Offset: filter.Offset,
		Total:  total,
	}, nil
}
