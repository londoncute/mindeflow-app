package service

import (
	"context"
	"errors"
	"mindeflow-app/backend/internal/inbox"
	"mindeflow-app/backend/internal/inbox/repository"
	"mindeflow-app/backend/internal/utils"
)

type Service struct {
	repo repository.Repository
}

func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, input inbox.CreateInput) (inbox.InboxItem, error) {
	if input.Title == "" {
		return inbox.InboxItem{}, errors.New("title is required")
	}
	return s.repo.Create(ctx, input)
}

func (s *Service) List(ctx context.Context, filter inbox.ListFilter) (inbox.ListResult, error) {
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	return s.repo.List(ctx, filter)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if err == repository.ErrInboxItemNotFound {
			return utils.NewNotFound("inbox item not found")
		}
		return err
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if err == repository.ErrInboxItemNotFound {
			return utils.NewNotFound("inbox item not found")
		}
		return err
	}

	return nil
}

func (s *Service) Skip(ctx context.Context, id int) (inbox.SkipResult, error) {
	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == repository.ErrInboxItemNotFound {
			return inbox.SkipResult{}, utils.NewNotFound("inbox item not found")
		}
		return inbox.SkipResult{}, err
	}

	if item.Status != inbox.StatusNew {
		return inbox.SkipResult{}, utils.NewBadRequest("only new inbox items can be skipped")
	}

	item, err = s.repo.Skip(ctx, id)
	if err != nil {
		if err == repository.ErrInboxItemNotFound {
			return inbox.SkipResult{}, utils.NewNotFound("inbox item not found")
		}
		return inbox.SkipResult{}, err
	}

	return inbox.SkipResult{
		ID:     item.ID,
		Status: item.Status,
	}, nil
}
