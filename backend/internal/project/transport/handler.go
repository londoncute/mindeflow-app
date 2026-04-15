package transport

import (
	"encoding/json"
	"net/http"
	"strconv"

	"mindeflow-app/backend/internal/project"
	"mindeflow-app/backend/internal/project/service"
	"mindeflow-app/backend/internal/utils"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req CreateProjectRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	input := project.CreateInput{
		Title:         req.Title,
		Description:   req.Description,
		SourceInboxID: req.SourceInboxID,
	}

	created, err := h.service.Create(r.Context(), input)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, ToProjectResponse(created))
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var filter project.ListFilter

	if status := q.Get("status"); status != "" {
		filter.Status = &status
	}

	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))

	filter.Limit = limit
	filter.Offset = offset

	result, err := h.service.List(r.Context(), filter)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	resp := ListProjectsResponse{
		Data: make([]ProjectResponse, 0, len(result.Items)),
		Meta: MetaResponse{
			Limit:  result.Limit,
			Offset: result.Offset,
			Total:  result.Total,
		},
	}

	for _, item := range result.Items {
		resp.Data = append(resp.Data, ToProjectResponse(item))
	}

	utils.WriteJSON(w, http.StatusOK, resp)
}
