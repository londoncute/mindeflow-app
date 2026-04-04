package service

import (
	"context"
	"mindeflow-app/backend/internal/user"
	"mindeflow-app/backend/internal/user/repository"
)

type Service struct {
	repo repository.Repository
}

func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context) (user.User, error) {
	return s.repo.Get(ctx)
}
