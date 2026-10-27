package httpapi

import "net/http"

// apiError is a client-visible failure: an HTTP status plus the error body.
type apiError struct {
	status  int
	code    string
	message string
}

func badRequest(message string) *apiError {
	return &apiError{http.StatusBadRequest, "invalid_request", message}
}

func internalError() *apiError {
	return &apiError{http.StatusInternalServerError, "internal_error", "internal server error"}
}

func (e *apiError) write(w http.ResponseWriter) {
	writeError(w, e.status, e.code, e.message)
}
