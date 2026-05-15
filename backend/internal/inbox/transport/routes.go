package transport

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Route("/inbox", func(r chi.Router) {
		r.Post("/", h.CreateInboxItem)
		r.Get("/", h.ListInboxItems)
		r.Delete("/{id}", h.DeleteInboxItem)
		r.Post("/{id}/skip", h.SkipInboxItem)
	})
}
