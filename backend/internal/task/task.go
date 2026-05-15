package task

import "time"

const (
	StatusPending    = "pending"
	StatusInProgress = "in_progress"
	StatusDone       = "done"
)

type Task struct {
	ID          int64
	UserID      int64
	ProjectID   int64
	Title       string
	Description string
	Materials   string
	Wave        int
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
}

type CreateInput struct {
	UserID      int64
	ProjectID   int64
	Title       string
	Description string
	Materials   string
	Wave        int
}

type ListFilter struct {
	UserID    int64
	ProjectID *int64
	Status    *string
	Limit     int
	Offset    int
}

type ListResult struct {
	Items  []Task
	Limit  int
	Offset int
	Total  int
}
