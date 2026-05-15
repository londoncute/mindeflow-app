package transport

import "github.com/go-chi/chi/v5"

func RegisterPublicRoutes(r chi.Router, h *Handler) {
	r.Post("/auth/login", h.Login)
	r.Post("/auth/register", h.Register)
	r.Post("/auth/logout", h.Logout)
}

func RegisterProtectedRoutes(r chi.Router, h *Handler) {
	r.Get("/user/", h.GetUser)
	r.Get("/auth/session", h.Session)
}
