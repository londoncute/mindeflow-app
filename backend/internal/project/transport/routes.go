package transport

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, handler *Handler) {
	r.Route("/projects", func(r chi.Router) {
		r.Post("/", handler.CreateProject)
		r.Get("/", handler.ListProjects)
	})
}
