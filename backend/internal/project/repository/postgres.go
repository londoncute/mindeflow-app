package repository

import (
	"context"
	"errors"

	"mindeflow-app/backend/internal/project"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

var ErrProjectNotFound = errors.New("project not found")

func (r *PostgresRepository) Create(ctx context.Context, input project.CreateInput) (project.Project, error) {
	query := `
		INSERT INTO projects (user_id, title, description, materials, source_inbox_id)
		SELECT $1, $2, $3, $4, $5
		WHERE $5::bigint IS NULL OR EXISTS (
			SELECT 1
			FROM inbox
			WHERE id = $5 AND user_id = $1
		)
		RETURNING id, user_id, title, description, materials, status, source_inbox_id, created_at, updated_at, completed_at
	`

	var p project.Project

	err := r.pool.QueryRow(ctx, query,
		input.UserID,
		input.Title,
		input.Description,
		input.Materials,
		input.SourceInboxID,
	).Scan(
		&p.ID,
		&p.UserID,
		&p.Title,
		&p.Description,
		&p.Materials,
		&p.Status,
		&p.SourceInboxID,
		&p.CreatedAt,
		&p.UpdatedAt,
		&p.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return project.Project{}, ErrProjectNotFound
		}
		return project.Project{}, err
	}

	return p, nil
}

func (r *PostgresRepository) Update(ctx context.Context, userID, id int64, input project.UpdateInput) (project.Project, error) {
	query := `
		UPDATE projects
		SET title = $2,
			description = $3,
			materials = $4,
			status = $5,
			updated_at = NOW(),
			completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END
		WHERE user_id = $1 AND id = $6
		RETURNING id, user_id, title, description, materials, status, source_inbox_id, created_at, updated_at, completed_at
	`

	var p project.Project
	err := r.pool.QueryRow(ctx, query, userID, input.Title, input.Description, input.Materials, input.Status, id).Scan(
		&p.ID,
		&p.UserID,
		&p.Title,
		&p.Description,
		&p.Materials,
		&p.Status,
		&p.SourceInboxID,
		&p.CreatedAt,
		&p.UpdatedAt,
		&p.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return project.Project{}, ErrProjectNotFound
		}
		return project.Project{}, err
	}

	return p, nil
}

func (r *PostgresRepository) List(ctx context.Context, filter project.ListFilter) (project.ListResult, error) {
	countQuery := `
		SELECT COUNT(*)
		FROM projects
		WHERE user_id = $1
		  AND ($2::text IS NULL OR status = $2)
	`

	dataQuery := `
		SELECT id, user_id, title, description, materials, status, source_inbox_id, created_at, updated_at, completed_at
		FROM projects
		WHERE user_id = $1
		  AND ($2::text IS NULL OR status = $2)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`

	var total int
	err := r.pool.QueryRow(ctx, countQuery, filter.UserID, filter.Status).Scan(&total)
	if err != nil {
		return project.ListResult{}, err
	}

	rows, err := r.pool.Query(ctx, dataQuery, filter.UserID, filter.Status, filter.Limit, filter.Offset)
	if err != nil {
		return project.ListResult{}, err
	}
	defer rows.Close()

	items := make([]project.Project, 0)

	for rows.Next() {
		var p project.Project

		err := rows.Scan(
			&p.ID,
			&p.UserID,
			&p.Title,
			&p.Description,
			&p.Materials,
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

func (r *PostgresRepository) GetByID(ctx context.Context, userID, id int64) (project.Project, error) {
	query := `
		SELECT id, user_id, title, description, materials, status, source_inbox_id, created_at, updated_at, completed_at
		FROM projects
		WHERE user_id = $1 AND id = $2
	`

	var p project.Project
	err := r.pool.QueryRow(ctx, query, userID, id).Scan(
		&p.ID,
		&p.UserID,
		&p.Title,
		&p.Description,
		&p.Materials,
		&p.Status,
		&p.SourceInboxID,
		&p.CreatedAt,
		&p.UpdatedAt,
		&p.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return project.Project{}, ErrProjectNotFound
		}
		return project.Project{}, err
	}

	return p, nil
}

func (r *PostgresRepository) Delete(ctx context.Context, userID, id int64) error {
	commandTag, err := r.pool.Exec(ctx, `DELETE FROM projects WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrProjectNotFound
	}

	return nil
}
