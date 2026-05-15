package transport

import (
	"encoding/json"
	"mindeflow-app/backend/internal/auth"
	"mindeflow-app/backend/internal/user"
	"mindeflow-app/backend/internal/user/service"
	"mindeflow-app/backend/internal/utils"
	"net/http"
)

type Handler struct {
	service      *service.Service
	sessionStore *auth.SessionStore
}

func NewHandler(service *service.Service, sessionStore *auth.SessionStore) *Handler {
	return &Handler{
		service:      service,
		sessionStore: sessionStore,
	}
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, utils.NewUnauthorized("login required"))
		return
	}

	u, err := h.service.GetByID(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserResponse(u))
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	u, err := h.service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	token, err := h.sessionStore.Create(u.ID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	auth.SetSessionCookie(w, token)
	writeJSON(w, http.StatusOK, toUserResponse(u))
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, utils.NewBadRequest("invalid request body"))
		return
	}

	u, err := h.service.Register(r.Context(), user.CreateInput{
		FullName: req.FullName,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	token, err := h.sessionStore.Create(u.ID)
	if err != nil {
		utils.WriteError(w, err)
		return
	}

	auth.SetSessionCookie(w, token)
	writeJSON(w, http.StatusCreated, toUserResponse(u))
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err == nil {
		h.sessionStore.Delete(cookie.Value)
	}

	auth.ClearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	h.GetUser(w, r)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func toUserResponse(u user.User) UserResponse {
	return UserResponse{
		FullName: u.Full_name,
		Email:    u.Email,
	}
}
