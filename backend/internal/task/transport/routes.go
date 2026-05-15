package transport

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, handler *Handler) {
	r.Route("/tasks", func(r chi.Router) {
		r.Post("/", handler.CreateTask)
		r.Get("/", handler.ListTasks)
		r.Post("/{id}/prioritize", handler.MoveTaskToFront)
		r.Post("/{id}/start", handler.StartTask)
		r.Post("/{id}/complete", handler.CompleteTask)
		r.Delete("/{id}", handler.DeleteTask)
	})

	r.Delete("/projects/{projectId}/tasks", handler.DeleteTasksByProject)
}
