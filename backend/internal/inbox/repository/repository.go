package repository

import (
	"context"
	"mindeflow-app/backend/internal/inbox"
)

type Repository interface {
	Create(ctx context.Context, input inbox.CreateInput) (inbox.InboxItem, error)
	List(ctx context.Context, filter inbox.ListFilter) (inbox.ListResult, error)
	GetByID(ctx context.Context, userID int64, id int) (inbox.InboxItem, error)
	Delete(ctx context.Context, userID int64, id int) error
	Skip(ctx context.Context, userID int64, id int) (inbox.InboxItem, error)
}
