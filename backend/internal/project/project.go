package project

import "time"

type Project struct {
	ID            int64
	UserID        int64
	Title         string
	Description   *string
	Materials     string
	Status        string
	SourceInboxID *int64
	CreatedAt     time.Time
	UpdatedAt     time.Time
	CompletedAt   *time.Time
}

type CreateInput struct {
	UserID        int64
	Title         string
	Description   *string
	Materials     string
	SourceInboxID *int64
}

type UpdateInput struct {
	Title       string
	Description *string
	Materials   string
	Status      string
}

type ListFilter struct {
	UserID int64
	Status *string
	Limit  int
	Offset int
}

type ListResult struct {
	Items  []Project
	Limit  int
	Offset int
	Total  int
}
