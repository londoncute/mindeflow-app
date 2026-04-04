package repository

import (
	"context"
	"mindeflow-app/backend/internal/user"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Get(ctx context.Context) (user.User, error) {
	const query = `
	SELECT id, full_name, email
		FROM users
		ORDER BY id
		LIMIT 1
	`
	var u user.User
	err := r.pool.QueryRow(ctx, query).Scan(&u.ID, &u.Full_name, &u.Email)
	if err != nil {
		return user.User{}, nil
	}
	return u, err
}
