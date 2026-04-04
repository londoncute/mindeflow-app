package inbox

import "time"

type InboxItem struct {
	ID          int
	Text        string
	Status      string
	CreatedAt   time.Time
	CompletedAt *time.Time
}

type CreateInput struct {
	Title string
}
