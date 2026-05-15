package repository

import (
	"context"
	"errors"
	"mindeflow-app/backend/internal/user"

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
	ErrUserNotFound   = errors.New("user not found")
	ErrUserEmailTaken = errors.New("user email taken")
)

func (r *PostgresRepository) GetByID(ctx context.Context, id int) (user.User, error) {
	const query = `
	SELECT id, full_name, email, password
		FROM users
		WHERE id = $1
	`
	var u user.User
	err := r.pool.QueryRow(ctx, query, id).Scan(&u.ID, &u.Full_name, &u.Email, &u.Password)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.User{}, ErrUserNotFound
		}
		return user.User{}, err
	}
	return u, nil
}

func (r *PostgresRepository) GetByEmail(ctx context.Context, email string) (user.User, error) {
	const query = `
	SELECT id, full_name, email, password
		FROM users
		WHERE lower(email) = lower($1)
		LIMIT 1
	`

	var u user.User
	err := r.pool.QueryRow(ctx, query, email).Scan(&u.ID, &u.Full_name, &u.Email, &u.Password)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.User{}, ErrUserNotFound
		}
		return user.User{}, err
	}

	return u, nil
}

func (r *PostgresRepository) Create(ctx context.Context, input user.CreateInput) (user.User, error) {
	const query = `
		INSERT INTO users (full_name, email, password)
		VALUES ($1, $2, $3)
		RETURNING id, full_name, email, password
	`

	var u user.User
	err := r.pool.QueryRow(ctx, query, input.FullName, input.Email, input.Password).Scan(
		&u.ID,
		&u.Full_name,
		&u.Email,
		&u.Password,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return user.User{}, ErrUserEmailTaken
		}
		return user.User{}, err
	}

	return u, nil
}
