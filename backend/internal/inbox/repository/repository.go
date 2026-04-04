package repository

import (
	"context"
	"mindeflow-app/backend/internal/inbox"
)

type Repository interface {
	Create(ctx context.Context, input inbox.CreateInput) (inbox.InboxItem, error)
}
