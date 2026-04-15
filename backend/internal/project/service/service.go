package service

import (
	"context"
	"strings"

	"mindeflow-app/backend/internal/project"
	"mindeflow-app/backend/internal/project/repository"
	"mindeflow-app/backend/internal/utils"
)

type Service struct {
	repo repository.Repository
}

func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, input project.CreateInput) (project.Project, error) {
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		return project.Project{}, utils.NewBadRequest("title is required")
	}

	return s.repo.Create(ctx, input)
}

func (s *Service) List(ctx context.Context, filter project.ListFilter) (project.ListResult, error) {
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	return s.repo.List(ctx, filter)
}
