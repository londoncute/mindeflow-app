package repository

import (
	"context"
	"mindeflow-app/backend/internal/task"
)

type Repository interface {
	Create(ctx context.Context, input task.CreateInput) (task.Task, error)
	List(ctx context.Context, filter task.ListFilter) (task.ListResult, error)
	GetByID(ctx context.Context, userID, id int64) (task.Task, error)
	MoveToFront(ctx context.Context, userID, id int64) (task.Task, error)
	Start(ctx context.Context, userID, id int64) (task.Task, error)
	Complete(ctx context.Context, userID, id int64) (task.Task, error)
	Delete(ctx context.Context, userID, id int64) error
	DeleteByProject(ctx context.Context, userID, projectID int64) error
}
