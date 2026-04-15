package transport

import (
	"encoding/json"
	"mindeflow-app/backend/internal/inbox"
	"mindeflow-app/backend/internal/inbox/service"
	"mindeflow-app/backend/internal/utils"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateInboxItem(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}

	item, err := h.service.Create(r.Context(), inbox.CreateInput{
		Title: req.Title,
		Text:  req.Text,
	})
	if err != nil {
		utils.WriteError(w, err)
		return
	}
	utils.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) ListInboxItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var filter inbox.ListFilter

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

	resp := ListResponse{
		Data: make([]InboxItemResponse, 0, len(result.Items)),
		Meta: MetaResponse{
			Limit:  result.Limit,
			Offset: result.Offset,
			Total:  result.Total,
		},
	}

	for _, item := range result.Items {
		resp.Data = append(resp.Data, InboxItemResponse{
			ID:       item.ID,
			Title:    item.Title,
			Text:     item.Text,
			Status:   item.Status,
			Position: item.Position,
		})
	}

	utils.WriteJSON(w, http.StatusOK, resp)
}
func (h *Handler) DeleteInboxItem(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	inboxID, err := strconv.Atoi(idParam)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid inbox id"))
		return
	}

	if err := h.service.Delete(r.Context(), inboxID); err != nil {
		utils.WriteError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SkipInboxItem(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	inboxID, err := strconv.Atoi(idParam)
	if err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid inbox id"))
		return
	}

	result, err := h.service.Skip(r.Context(), inboxID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, SkipResponse{
		ID:     result.ID,
		Status: result.Status,
	})
}
