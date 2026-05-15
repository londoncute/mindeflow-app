package transport

import (
	"encoding/json"
	"net/http"
	"strconv"

	"mindeflow-app/backend/internal/auth"
	"mindeflow-app/backend/internal/task"
	"mindeflow-app/backend/internal/task/service"
	"mindeflow-app/backend/internal/utils"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	created, err := h.service.Create(r.Context(), int64(userID), task.CreateInput{
		ProjectID:   req.ProjectID,
		Title:       req.Title,
		Description: req.Description,
		Materials:   req.Materials,
		Wave:        req.Wave,
	})
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, ToTaskResponse(created))
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	q := r.URL.Query()

	var filter task.ListFilter

	if projectID := q.Get("project_id"); projectID != "" {
		value, err := strconv.ParseInt(projectID, 10, 64)
		if err != nil {
			utils.WriteError(w, utils.NewBadRequest("invalid project_id"))
			return
		}
		filter.ProjectID = &value
	}

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

	resp := ListTasksResponse{
		Data: make([]TaskResponse, 0, len(result.Items)),
		Meta: MetaResponse{
			Limit:  result.Limit,
			Offset: result.Offset,
			Total:  result.Total,
		},
	}

	for _, item := range result.Items {
		resp.Data = append(resp.Data, ToTaskResponse(item))
	}

	utils.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) StartTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	taskID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid task id"))
		return
	}

	item, err := h.service.Start(r.Context(), int64(userID), taskID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, ToTaskResponse(item))
}

func (h *Handler) MoveTaskToFront(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	taskID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid task id"))
		return
	}

	item, err := h.service.MoveToFront(r.Context(), int64(userID), taskID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, ToTaskResponse(item))
}

func (h *Handler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	taskID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid task id"))
		return
	}

	item, err := h.service.Complete(r.Context(), int64(userID), taskID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, ToTaskResponse(item))
}

func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	taskID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid task id"))
		return
	}

	if err := h.service.Delete(r.Context(), int64(userID), taskID); err != nil {
		utils.WriteError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteTasksByProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	projectID, err := strconv.ParseInt(chi.URLParam(r, "projectId"), 10, 64)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid project id"))
		return
	}

	if err := h.service.DeleteByProject(r.Context(), int64(userID), projectID); err != nil {
		utils.WriteError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
