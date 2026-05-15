package inbox

import (
	"time"
)

const (
	StatusNew       = "new"
	StatusProcessed = "processed"
)

type InboxItem struct {
	ID          int
	UserID      int64
	Title       string
	Text        string
	Status      string
	Position    int
	CreatedAt   time.Time
	CompletedAt *time.Time
}

type CreateInput struct {
	UserID int64
	Title string
	Text  string
}

type ListFilter struct {
	UserID int64
	Status *string
	Limit  int
	Offset int
}

type ListResult struct {
	Items  []InboxItem
	Total  int
	Limit  int
	Offset int
}

type SkipResult struct {
	ID       int    `json:"id"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}
