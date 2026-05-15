package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"

	"mindeflow-app/backend/internal/utils"
)

type contextKey string

const (
	userIDContextKey  contextKey = "auth.user_id"
	SessionCookieName            = "mindeflow_session"
)

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]int
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]int),
	}
}

func (s *SessionStore) Create(userID int) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}

	token := hex.EncodeToString(tokenBytes)

	s.mu.Lock()
	s.sessions[token] = userID
	s.mu.Unlock()

	return token, nil
}

func (s *SessionStore) Delete(token string) {
	if token == "" {
		return
	}

	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

func (s *SessionStore) UserID(token string) (int, bool) {
	s.mu.RLock()
	userID, ok := s.sessions[token]
	s.mu.RUnlock()
	return userID, ok
}

func SetSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func AuthMiddleware(store *SessionStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil {
				utils.WriteError(w, utils.NewUnauthorized("login required"))
				return
			}

			userID, ok := store.UserID(cookie.Value)
			if !ok {
				utils.WriteError(w, utils.NewUnauthorized("session expired"))
				return
			}

			ctx := context.WithValue(r.Context(), userIDContextKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserIDFromContext(ctx context.Context) (int, bool) {
	userID, ok := ctx.Value(userIDContextKey).(int)
	return userID, ok
}
