package service

import (
	"context"
	"strings"

	"mindeflow-app/backend/internal/task"
	"mindeflow-app/backend/internal/task/repository"
	"mindeflow-app/backend/internal/utils"
)

type Service struct {
	repo repository.Repository
}

func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID int64, input task.CreateInput) (task.Task, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Materials = strings.TrimSpace(input.Materials)

	if input.ProjectID <= 0 {
		return task.Task{}, utils.NewBadRequest("project_id is required")
	}

	if input.Title == "" {
		return task.Task{}, utils.NewBadRequest("title is required")
	}

	if input.Wave <= 0 {
		return task.Task{}, utils.NewBadRequest("wave must be greater than zero")
	}
	input.UserID = userID

	created, err := s.repo.Create(ctx, input)
	if err != nil {
		if err == repository.ErrProjectNotFound {
			return task.Task{}, utils.NewNotFound("project not found")
		}
		return task.Task{}, err
	}

	return created, nil
}

func (s *Service) List(ctx context.Context, userID int64, filter task.ListFilter) (task.ListResult, error) {
	if filter.Limit <= 0 {
		filter.Limit = 100
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	filter.UserID = userID

	return s.repo.List(ctx, filter)
}

func (s *Service) Start(ctx context.Context, userID, id int64) (task.Task, error) {
	item, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		if err == repository.ErrTaskNotFound {
			return task.Task{}, utils.NewNotFound("task not found")
		}
		return task.Task{}, err
	}

	if item.Status == task.StatusDone {
		return task.Task{}, utils.NewBadRequest("task is already done")
	}

	return s.repo.Start(ctx, userID, id)
}

func (s *Service) MoveToFront(ctx context.Context, userID, id int64) (task.Task, error) {
	if id <= 0 {
		return task.Task{}, utils.NewBadRequest("invalid task id")
	}

	item, err := s.repo.MoveToFront(ctx, userID, id)
	if err != nil {
		if err == repository.ErrTaskNotFound {
			return task.Task{}, utils.NewNotFound("task not found")
		}
		return task.Task{}, err
	}

	return item, nil
}

func (s *Service) Complete(ctx context.Context, userID, id int64) (task.Task, error) {
	item, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		if err == repository.ErrTaskNotFound {
			return task.Task{}, utils.NewNotFound("task not found")
		}
		return task.Task{}, err
	}

	if item.Status == task.StatusDone {
		return item, nil
	}

	return s.repo.Complete(ctx, userID, id)
}

func (s *Service) Delete(ctx context.Context, userID, id int64) error {
	if err := s.repo.Delete(ctx, userID, id); err != nil {
		if err == repository.ErrTaskNotFound {
			return utils.NewNotFound("task not found")
		}
		return err
	}

	return nil
}

func (s *Service) DeleteByProject(ctx context.Context, userID, projectID int64) error {
	if projectID <= 0 {
		return utils.NewBadRequest("invalid project id")
	}

	return s.repo.DeleteByProject(ctx, userID, projectID)
}
