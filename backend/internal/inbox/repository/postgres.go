package repository

import (
	"context"
	"mindeflow-app/backend/internal/inbox"

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
	INSERT INTO inbox (title, status)
	VALUES ($1, 'new')
	RETURNING id, title, status, created_at, completed_at
	`

	var item inbox.InboxItem

	err := r.pool.QueryRow(ctx, query, input.Title).Scan(&item.ID, &item.Text,
		&item.Status, &item.CreatedAt, &item.CompletedAt)

	return item, err
}
