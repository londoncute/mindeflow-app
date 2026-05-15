package transport

import (
	"mindeflow-app/backend/internal/project"
)

const timeLayout = "2006-01-02T15:04:05Z07:00"

type CreateProjectRequest struct {
	Title         string  `json:"title"`
	Description   *string `json:"description"`
	Materials     string  `json:"materials"`
	SourceInboxID *int64  `json:"source_inbox_id"`
}

type UpdateProjectRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Materials   string  `json:"materials"`
	Status      string  `json:"status"`
}

type ProjectResponse struct {
	ID            int64   `json:"id"`
	Title         string  `json:"title"`
	Description   *string `json:"description,omitempty"`
	Materials     string  `json:"materials"`
	Status        string  `json:"status"`
	SourceInboxID *int64  `json:"source_inbox_id,omitempty"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
	CompletedAt   *string `json:"completed_at,omitempty"`
}

type MetaResponse struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

type ListProjectsResponse struct {
	Data []ProjectResponse `json:"data"`
	Meta MetaResponse      `json:"meta"`
}

func ToProjectResponse(p project.Project) ProjectResponse {
	var completedAt *string
	if p.CompletedAt != nil {
		value := p.CompletedAt.Format(timeLayout)
		completedAt = &value
	}

	return ProjectResponse{
		ID:            p.ID,
		Title:         p.Title,
		Description:   p.Description,
		Materials:     p.Materials,
		Status:        p.Status,
		SourceInboxID: p.SourceInboxID,
		CreatedAt:     p.CreatedAt.Format(timeLayout),
		UpdatedAt:     p.UpdatedAt.Format(timeLayout),
		CompletedAt:   completedAt,
	}
}
