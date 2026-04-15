package main

import (
	"log"
	"mindeflow-app/backend/internal/config"
	"mindeflow-app/backend/internal/db"
	inboxRepositoryPkg "mindeflow-app/backend/internal/inbox/repository"
	inboxServicePkg "mindeflow-app/backend/internal/inbox/service"
	inboxHandlerPkg "mindeflow-app/backend/internal/inbox/transport"
	userRepositoryPkg "mindeflow-app/backend/internal/user/repository"
	userServicePkg "mindeflow-app/backend/internal/user/service"
	userHttpPkg "mindeflow-app/backend/internal/user/transport"
	"net/http"

	projectRepository "mindeflow-app/backend/internal/project/repository"
	projectService "mindeflow-app/backend/internal/project/service"
	projectTransport "mindeflow-app/backend/internal/project/transport"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	pool, err := db.NewPostgresPool(cfg.DatabaseURL())

	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	userRepo := userRepositoryPkg.NewPostgresRepository(pool)
	userService := userServicePkg.New(userRepo)
	userHandler := userHttpPkg.NewHandler(userService)

	inboxRepo := inboxRepositoryPkg.NewPostgresRepository(pool)
	inboxService := inboxServicePkg.New(inboxRepo)
	inboxHandler := inboxHandlerPkg.NewHandler(inboxService)

	projectRepo := projectRepository.NewPostgresRepository(pool)
	projectService := projectService.New(projectRepo)
	projectHandler := projectTransport.NewHandler(projectService)

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/", func(r chi.Router) {
		userHttpPkg.RegisterRoutes(r, userHandler)
		inboxHandlerPkg.RegisterRoutes(r, inboxHandler)
		projectTransport.RegisterRoutes(r, projectHandler)

	})

	addr := ":" + cfg.AppPort
	log.Printf("server started on %s", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
