package repository

import (
	"context"
	"errors"
	"fmt"
	"log"
	"mindeflow-app/backend/internal/inbox"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Create(ctx context.Context, input inbox.CreateInput) (inbox.InboxItem, error) {
	query := `
	INSERT INTO inbox (title, text, status, position)
	VALUES ($1, $2, 'new', (SELECT COALESCE(MAX(position), 0) + 1 FROM inbox))
	RETURNING id, title, text, status, position, created_at, completed_at
	`

	var item inbox.InboxItem

	err := r.pool.QueryRow(ctx, query, input.Title, input.Text).Scan(&item.ID, &item.Title, &item.Text,
		&item.Status, &item.Position, &item.CreatedAt, &item.CompletedAt)

	if err != nil {
		log.Println("create inbox error:", err)
		return inbox.InboxItem{}, err
	}

	return item, err
}

func (r *PostgresRepository) List(ctx context.Context, filter inbox.ListFilter) (inbox.ListResult, error) {

	var args []any
	var where []string

	if filter.Status != nil && *filter.Status != "" {
		args = append(args, *filter.Status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	countQuery := `SELECT COUNT(*) FROM inbox` + whereSQL
	var total int

	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return inbox.ListResult{}, err
	}

	args = append(args, filter.Limit, filter.Offset)

	listQuery := fmt.Sprintf(`
		SELECT id, title, text, position, status, created_at, completed_at
		FROM inbox
		%s
		ORDER BY position ASC
		LIMIT $%d OFFSET $%d
	`, whereSQL, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return inbox.ListResult{}, err
	}
	defer rows.Close()

	items := make([]inbox.InboxItem, 0)
	for rows.Next() {
		var item inbox.InboxItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Text, &item.Position, &item.Status, &item.CreatedAt, &item.CompletedAt); err != nil {
			return inbox.ListResult{}, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return inbox.ListResult{}, err
	}

	return inbox.ListResult{
		Items:  items,
		Total:  total,
		Limit:  filter.Limit,
		Offset: filter.Offset,
	}, nil

}

var ErrInboxItemNotFound = errors.New("inbox item not found")

func (r *PostgresRepository) GetByID(ctx context.Context, id int) (inbox.InboxItem, error) {
	query := `
		SELECT id, title, status, created_at, completed_at
		FROM inbox
		WHERE id = $1
	`

	var item inbox.InboxItem
	err := r.pool.QueryRow(ctx, query, id).
		Scan(&item.ID, &item.Title, &item.Status, &item.CreatedAt, &item.CompletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return inbox.InboxItem{}, ErrInboxItemNotFound
		}
		return inbox.InboxItem{}, err
	}

	return item, nil
}

func (r *PostgresRepository) Delete(ctx context.Context, id int) error {
	query := `DELETE FROM inbox WHERE id = $1`

	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errors.New("inbox item not found")
	}

	return nil
}

func (r *PostgresRepository) Skip(ctx context.Context, id int) (inbox.InboxItem, error) {
	query := `
		UPDATE inbox
		SET position = (
			SELECT COALESCE(MAX(position), 0) + 1
			FROM inbox
		)
		WHERE id = $1
		RETURNING id, title, text, status, position, created_at, completed_at
	`

	var item inbox.InboxItem
	err := r.pool.QueryRow(ctx, query, id).
		Scan(
			&item.ID,
			&item.Title,
			&item.Text,
			&item.Status,
			&item.Position,
			&item.CreatedAt,
			&item.CompletedAt,
		)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return inbox.InboxItem{}, ErrInboxItemNotFound
		}
		return inbox.InboxItem{}, err
	}

	return item, nil
}
