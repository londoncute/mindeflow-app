package utils

import (
	"errors"
	"net/http"
)

type AppError struct {
	Code    int
	Message string
}

func (e *AppError) Error() string {
	return e.Message
}

func NewBadRequest(msg string) *AppError {
	return &AppError{
		Code:    http.StatusBadRequest,
		Message: msg,
	}
}

func NewNotFound(msg string) *AppError {
	return &AppError{
		Code:    http.StatusNotFound,
		Message: msg,
	}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func WriteError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		WriteJSON(w, appErr.Code, ErrorResponse{
			Error: appErr.Message,
		})
		return
	}
	WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
		Error: "internal server error",
	})
}
