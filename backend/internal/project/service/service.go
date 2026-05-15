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

func (s *Service) Create(ctx context.Context, userID int64, input project.CreateInput) (project.Project, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Materials = strings.TrimSpace(input.Materials)
	if input.Title == "" {
		return project.Project{}, utils.NewBadRequest("title is required")
	}
	input.UserID = userID

	return s.repo.Create(ctx, input)
}

func (s *Service) Update(ctx context.Context, userID, id int64, input project.UpdateInput) (project.Project, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Materials = strings.TrimSpace(input.Materials)
	input.Status = strings.TrimSpace(input.Status)

	if input.Title == "" {
		return project.Project{}, utils.NewBadRequest("title is required")
	}

	if input.Status == "" {
		input.Status = "active"
	}

	switch input.Status {
	case "active", "completed", "archived":
	default:
		return project.Project{}, utils.NewBadRequest("invalid project status")
	}

	return s.repo.Update(ctx, userID, id, input)
}

func (s *Service) List(ctx context.Context, userID int64, filter project.ListFilter) (project.ListResult, error) {
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	filter.UserID = userID

	return s.repo.List(ctx, filter)
}

func (s *Service) GetByID(ctx context.Context, userID, id int64) (project.Project, error) {
	return s.repo.GetByID(ctx, userID, id)
}

func (s *Service) Delete(ctx context.Context, userID, id int64) error {
	if id <= 0 {
		return utils.NewBadRequest("invalid project id")
	}

	if err := s.repo.Delete(ctx, userID, id); err != nil {
		if err == repository.ErrProjectNotFound {
			return utils.NewNotFound("project not found")
		}
		return err
	}

	return nil
}
