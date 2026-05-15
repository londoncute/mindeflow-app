package repository

import (
	"context"
	"mindeflow-app/backend/internal/project"
)

type Repository interface {
	Create(ctx context.Context, input project.CreateInput) (project.Project, error)
	Update(ctx context.Context, userID, id int64, input project.UpdateInput) (project.Project, error)
	List(ctx context.Context, filter project.ListFilter) (project.ListResult, error)
	GetByID(ctx context.Context, userID, id int64) (project.Project, error)
	Delete(ctx context.Context, userID, id int64) error
}
