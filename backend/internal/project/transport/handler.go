package transport

import (
	"encoding/json"
	"net/http"
	"strconv"

	"mindeflow-app/backend/internal/auth"
	"mindeflow-app/backend/internal/project"
	"mindeflow-app/backend/internal/project/repository"
	"mindeflow-app/backend/internal/project/service"
	"mindeflow-app/backend/internal/utils"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	var req CreateProjectRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	input := project.CreateInput{
		Title:         req.Title,
		Description:   req.Description,
		Materials:     req.Materials,
		SourceInboxID: req.SourceInboxID,
	}

	created, err := h.service.Create(r.Context(), int64(userID), input)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, ToProjectResponse(created))
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid project id"))
		return
	}

	var req UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	updated, err := h.service.Update(r.Context(), int64(userID), projectID, project.UpdateInput{
		Title:       req.Title,
		Description: req.Description,
		Materials:   req.Materials,
		Status:      req.Status,
	})
	if err != nil {
		if err == repository.ErrProjectNotFound {
			utils.WriteError(w, utils.NewNotFound("project not found"))
			return
		}
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, ToProjectResponse(updated))
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	q := r.URL.Query()

	var filter project.ListFilter

	if status := q.Get("status"); status != "" {
		filter.Status = &status
	}

	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))

	filter.Limit = limit
	filter.Offset = offset

	result, err := h.service.List(r.Context(), int64(userID), filter)
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

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid project id"))
		return
	}

	if err := h.service.Delete(r.Context(), int64(userID), projectID); err != nil {
		utils.WriteError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
