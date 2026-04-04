package transport

import (
	"encoding/json"
	"mindeflow-app/backend/internal/inbox"
	"mindeflow-app/backend/internal/inbox/service"
	"mindeflow-app/backend/internal/utils"
	"net/http"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateInboxItem(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	item, err := h.service.Create(r.Context(), inbox.CreateInput{
		Title: req.Title,
	})
	if err != nil {
		utils.WriteError(w, err)
		return
	}
	utils.WriteJSON(w, http.StatusOK, item)
}
