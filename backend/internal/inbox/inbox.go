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
	Title       string
	Text        string
	Status      string
	CreatedAt   time.Time
	CompletedAt *time.Time
}

type CreateInput struct {
	Title string
	Text  string
}

type ListFilter struct {
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
	ID     int    `json:"id"`
	Status string `json:"status"`
}
