package service

import (
	"context"
	"mindeflow-app/backend/internal/user"
	"mindeflow-app/backend/internal/user/repository"
	"mindeflow-app/backend/internal/utils"
	"strings"
)

type Service struct {
	repo repository.Repository
}

func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByID(ctx context.Context, id int) (user.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == repository.ErrUserNotFound {
			return user.User{}, utils.NewUnauthorized("user not found")
		}
		return user.User{}, err
	}

	return u, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (user.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	password = strings.TrimSpace(password)

	if email == "" || password == "" {
		return user.User{}, utils.NewBadRequest("email and password are required")
	}

	u, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if err == repository.ErrUserNotFound {
			return user.User{}, utils.NewUnauthorized("invalid email or password")
		}
		return user.User{}, err
	}

	if u.Password != password {
		return user.User{}, utils.NewUnauthorized("invalid email or password")
	}

	return u, nil
}

func (s *Service) Register(ctx context.Context, input user.CreateInput) (user.User, error) {
	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Password = strings.TrimSpace(input.Password)

	if input.FullName == "" {
		return user.User{}, utils.NewBadRequest("full_name is required")
	}

	if input.Email == "" || input.Password == "" {
		return user.User{}, utils.NewBadRequest("email and password are required")
	}

	if !strings.Contains(input.Email, "@") {
		return user.User{}, utils.NewBadRequest("invalid email")
	}

	if len(input.Password) < 6 {
		return user.User{}, utils.NewBadRequest("password must be at least 6 characters")
	}

	created, err := s.repo.Create(ctx, input)
	if err != nil {
		if err == repository.ErrUserEmailTaken {
			return user.User{}, utils.NewConflict("email is already registered")
		}
		return user.User{}, err
	}

	return created, nil
}
