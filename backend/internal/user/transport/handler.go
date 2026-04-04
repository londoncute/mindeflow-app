package transport

import (
	"encoding/json"
	"mindeflow-app/backend/internal/user"
	"mindeflow-app/backend/internal/user/service"
	"net/http"
)

type Handler struct {
	service *service.Service
}

func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	u, err := h.service.Get(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error: err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, toUserpResponse(u))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func toUserpResponse(u user.User) UserRespone {
	return UserRespone{
		Full_name: u.Full_name,
		Email:     u.Email,
	}
}
