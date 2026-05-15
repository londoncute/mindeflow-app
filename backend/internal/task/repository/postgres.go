package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"mindeflow-app/backend/internal/task"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

var (
	ErrTaskNotFound    = errors.New("task not found")
	ErrProjectNotFound = errors.New("project not found")
)

func (r *PostgresRepository) Create(ctx context.Context, input task.CreateInput) (task.Task, error) {
	query := `
		INSERT INTO tasks (user_id, project_id, title, description, materials, wave, status)
		SELECT $1, id, $3, $4, $5, $6, 'pending'
		FROM projects
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
	`

	var item task.Task
	err := r.pool.QueryRow(ctx, query, input.UserID, input.ProjectID, input.Title, input.Description, input.Materials, input.Wave).Scan(
		&item.ID,
		&item.UserID,
		&item.ProjectID,
		&item.Title,
		&item.Description,
		&item.Materials,
		&item.Wave,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.StartedAt,
		&item.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || isForeignKeyViolation(err) {
			return task.Task{}, ErrProjectNotFound
		}
		return task.Task{}, err
	}

	return item, nil
}

func (r *PostgresRepository) List(ctx context.Context, filter task.ListFilter) (task.ListResult, error) {
	var (
		args  = []any{filter.UserID}
		where []string
	)

	where = append(where, fmt.Sprintf("user_id = $%d", len(args)))

	if filter.ProjectID != nil {
		args = append(args, *filter.ProjectID)
		where = append(where, fmt.Sprintf("project_id = $%d", len(args)))
	}

	if filter.Status != nil && *filter.Status != "" {
		args = append(args, *filter.Status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	countQuery := `SELECT COUNT(*) FROM tasks` + whereSQL
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return task.ListResult{}, err
	}

	args = append(args, filter.Limit, filter.Offset)

	query := fmt.Sprintf(`
		SELECT id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
		FROM tasks
		%s
		ORDER BY
			CASE status
				WHEN 'in_progress' THEN 0
				WHEN 'pending' THEN 1
				ELSE 2
			END,
			wave ASC,
			created_at ASC
		LIMIT $%d OFFSET $%d
	`, whereSQL, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return task.ListResult{}, err
	}
	defer rows.Close()

	items := make([]task.Task, 0)
	for rows.Next() {
		var item task.Task
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.ProjectID,
			&item.Title,
			&item.Description,
			&item.Materials,
			&item.Wave,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.StartedAt,
			&item.CompletedAt,
		); err != nil {
			return task.ListResult{}, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return task.ListResult{}, err
	}

	return task.ListResult{
		Items:  items,
		Limit:  filter.Limit,
		Offset: filter.Offset,
		Total:  total,
	}, nil
}

func (r *PostgresRepository) GetByID(ctx context.Context, userID, id int64) (task.Task, error) {
	query := `
		SELECT id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
		FROM tasks
		WHERE user_id = $1 AND id = $2
	`

	var item task.Task
	err := r.pool.QueryRow(ctx, query, userID, id).Scan(
		&item.ID,
		&item.UserID,
		&item.ProjectID,
		&item.Title,
		&item.Description,
		&item.Materials,
		&item.Wave,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.StartedAt,
		&item.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task.Task{}, ErrTaskNotFound
		}
		return task.Task{}, err
	}

	return item, nil
}

func (r *PostgresRepository) MoveToFront(ctx context.Context, userID, id int64) (task.Task, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return task.Task{}, err
	}
	defer tx.Rollback(ctx)

	var projectID int64
	err = tx.QueryRow(ctx, `SELECT project_id FROM tasks WHERE user_id = $1 AND id = $2`, userID, id).Scan(&projectID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task.Task{}, ErrTaskNotFound
		}
		return task.Task{}, err
	}

	reorderQuery := `
		WITH ranked AS (
			SELECT id,
				   ROW_NUMBER() OVER (
				   	ORDER BY
				   		CASE WHEN id = $3 THEN 0 ELSE 1 END,
				   		wave ASC,
				   		created_at ASC,
				   		id ASC
				   ) AS new_wave
			FROM tasks
			WHERE user_id = $1 AND project_id = $2
		)
		UPDATE tasks AS t
		SET wave = ranked.new_wave,
			updated_at = NOW()
		FROM ranked
		WHERE t.user_id = $1 AND t.id = ranked.id
	`

	if _, err := tx.Exec(ctx, reorderQuery, userID, projectID, id); err != nil {
		return task.Task{}, err
	}

	var item task.Task
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
		FROM tasks
		WHERE user_id = $1 AND id = $2
	`, userID, id).Scan(
		&item.ID,
		&item.UserID,
		&item.ProjectID,
		&item.Title,
		&item.Description,
		&item.Materials,
		&item.Wave,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.StartedAt,
		&item.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task.Task{}, ErrTaskNotFound
		}
		return task.Task{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return task.Task{}, err
	}

	return item, nil
}

func (r *PostgresRepository) Start(ctx context.Context, userID, id int64) (task.Task, error) {
	query := `
		UPDATE tasks
		SET status = 'in_progress',
			started_at = COALESCE(started_at, NOW()),
			updated_at = NOW()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
	`

	return r.returningTask(ctx, query, userID, id)
}

func (r *PostgresRepository) Complete(ctx context.Context, userID, id int64) (task.Task, error) {
	query := `
		UPDATE tasks
		SET status = 'done',
			started_at = COALESCE(started_at, NOW()),
			completed_at = NOW(),
			updated_at = NOW()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, project_id, title, description, materials, wave, status, created_at, updated_at, started_at, completed_at
	`

	return r.returningTask(ctx, query, userID, id)
}

func (r *PostgresRepository) Delete(ctx context.Context, userID, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return ErrTaskNotFound
	}

	return nil
}

func (r *PostgresRepository) DeleteByProject(ctx context.Context, userID, projectID int64) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE user_id = $1 AND project_id = $2`, userID, projectID)
	return err
}

func (r *PostgresRepository) returningTask(ctx context.Context, query string, userID, id int64) (task.Task, error) {
	var item task.Task
	err := r.pool.QueryRow(ctx, query, userID, id).Scan(
		&item.ID,
		&item.UserID,
		&item.ProjectID,
		&item.Title,
		&item.Description,
		&item.Materials,
		&item.Wave,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.StartedAt,
		&item.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task.Task{}, ErrTaskNotFound
		}
		return task.Task{}, err
	}

	return item, nil
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
