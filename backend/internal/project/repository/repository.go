package repository

import (
	"context"
	"mindeflow-app/backend/internal/project"
)

type Repository interface {
	Create(ctx context.Context, input project.CreateInput) (project.Project, error)
	List(ctx context.Context, filter project.ListFilter) (project.ListResult, error)
}
