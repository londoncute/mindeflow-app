package project

import "time"

type Project struct {
	ID            int64
	Title         string
	Description   *string
	Status        string
	SourceInboxID *int64
	CreatedAt     time.Time
	UpdatedAt     time.Time
	CompletedAt   *time.Time
}

type CreateInput struct {
	Title         string
	Description   *string
	SourceInboxID *int64
}

type ListFilter struct {
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
