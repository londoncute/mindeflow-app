package repository

import (
	"context"
	"mindeflow-app/backend/internal/user"
)

type Repository interface {
	GetByID(ctx context.Context, id int) (user.User, error)
	GetByEmail(ctx context.Context, email string) (user.User, error)
	Create(ctx context.Context, input user.CreateInput) (user.User, error)
}
