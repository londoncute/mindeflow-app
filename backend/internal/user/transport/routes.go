package transport

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Route("/user", func(r chi.Router) {
		r.Get("/", h.GetUser)
	})
}
