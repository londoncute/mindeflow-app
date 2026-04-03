package main

import (
	"log"
	"mindeflow-app/backend/internal/config"
	"mindeflow-app/backend/internal/db"
	"mindeflow-app/backend/internal/user/repository"
	"mindeflow-app/backend/internal/user/service"
	"mindeflow-app/backend/internal/user/transport"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"

	"github.com/go-chi/cors"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	pool, err := db.NewPostgresPool(cfg.DatabaseURL())

	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	userRepo := repository.NewPostgresRepository(pool)
	userService := service.New(userRepo)
	userHandler := transport.NewHandler(userService)

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"}, // Для демки разрешаем всё
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	// Глобальная настройка заголовка UTF-8 для всех ответов JSON
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			next.ServeHTTP(w, r)
		})
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api/v1", func(r chi.Router) {
		transport.RegisterRoutes(r, userHandler)
	})

	addr := ":" + cfg.AppPort
	log.Printf("server started on %s", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
