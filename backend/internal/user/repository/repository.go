package repository

import (
	"context"
	"mindeflow-app/backend/internal/user"
)

type Repository interface {
	Get(ctx context.Context) (user.User, error)
	//Update(ctx context.Context, input user.UpdateInput)
}
