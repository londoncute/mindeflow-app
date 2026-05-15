package main

import (
	"context"
	"log"
	"mindeflow-app/backend/internal/auth"
	"mindeflow-app/backend/internal/config"
	"mindeflow-app/backend/internal/db"
	inboxRepositoryPkg "mindeflow-app/backend/internal/inbox/repository"
	inboxServicePkg "mindeflow-app/backend/internal/inbox/service"
	inboxHandlerPkg "mindeflow-app/backend/internal/inbox/transport"
	taskRepositoryPkg "mindeflow-app/backend/internal/task/repository"
	taskServicePkg "mindeflow-app/backend/internal/task/service"
	taskTransportPkg "mindeflow-app/backend/internal/task/transport"
	userRepositoryPkg "mindeflow-app/backend/internal/user/repository"
	userServicePkg "mindeflow-app/backend/internal/user/service"
	userHttpPkg "mindeflow-app/backend/internal/user/transport"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

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

	if err := db.ApplyMigrations(context.Background(), pool, "migrations"); err != nil {
		log.Fatalf("failed to apply migrations: %v", err)
	}

	userRepo := userRepositoryPkg.NewPostgresRepository(pool)
	userService := userServicePkg.New(userRepo)
	sessionStore := auth.NewSessionStore()
	userHandler := userHttpPkg.NewHandler(userService, sessionStore)

	inboxRepo := inboxRepositoryPkg.NewPostgresRepository(pool)
	inboxService := inboxServicePkg.New(inboxRepo)
	inboxHandler := inboxHandlerPkg.NewHandler(inboxService)

	projectRepo := projectRepository.NewPostgresRepository(pool)
	projectService := projectService.New(projectRepo)
	projectHandler := projectTransport.NewHandler(projectService)

	taskRepo := taskRepositoryPkg.NewPostgresRepository(pool)
	taskService := taskServicePkg.New(taskRepo)
	taskHandler := taskTransportPkg.NewHandler(taskService)

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api/v1", func(r chi.Router) {
		userHttpPkg.RegisterPublicRoutes(r, userHandler)

		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware(sessionStore))
			userHttpPkg.RegisterProtectedRoutes(r, userHandler)
			inboxHandlerPkg.RegisterRoutes(r, inboxHandler)
			projectTransport.RegisterRoutes(r, projectHandler)
			taskTransportPkg.RegisterRoutes(r, taskHandler)
		})
	})

	frontendDir := filepath.Join("..", "frontend")
	spaHandler := frontendHandler(frontendDir)
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		spaHandler.ServeHTTP(w, r)
	})

	addr := ":" + cfg.AppPort
	log.Printf("server started on %s", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}

func frontendHandler(frontendDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/health" {
			http.NotFound(w, r)
			return
		}

		requestPath := path.Clean("/" + r.URL.Path)
		if requestPath == "/" {
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
			return
		}

		target := filepath.Join(frontendDir, filepath.FromSlash(strings.TrimPrefix(requestPath, "/")))
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			http.ServeFile(w, r, target)
			return
		}

		http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
	})
}
