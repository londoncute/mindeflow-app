package transport

import "mindeflow-app/backend/internal/task"

const timeLayout = "2006-01-02T15:04:05Z07:00"

type CreateTaskRequest struct {
	ProjectID   int64  `json:"project_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Materials   string `json:"materials"`
	Wave        int    `json:"wave"`
}

type TaskResponse struct {
	ID          int64   `json:"id"`
	ProjectID   int64   `json:"project_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Materials   string  `json:"materials"`
	Wave        int     `json:"wave"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
	StartedAt   *string `json:"started_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
}

type MetaResponse struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

type ListTasksResponse struct {
	Data []TaskResponse `json:"data"`
	Meta MetaResponse   `json:"meta"`
}

func ToTaskResponse(item task.Task) TaskResponse {
	var startedAt *string
	if item.StartedAt != nil {
		value := item.StartedAt.Format(timeLayout)
		startedAt = &value
	}

	var completedAt *string
	if item.CompletedAt != nil {
		value := item.CompletedAt.Format(timeLayout)
		completedAt = &value
	}

	return TaskResponse{
		ID:          item.ID,
		ProjectID:   item.ProjectID,
		Title:       item.Title,
		Description: item.Description,
		Materials:   item.Materials,
		Wave:        item.Wave,
		Status:      item.Status,
		CreatedAt:   item.CreatedAt.Format(timeLayout),
		UpdatedAt:   item.UpdatedAt.Format(timeLayout),
		StartedAt:   startedAt,
		CompletedAt: completedAt,
	}
}
