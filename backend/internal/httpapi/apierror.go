package httpapi

import (
	"log/slog"
	"net/http"
)

// apiError is a client-visible failure: an HTTP status plus the error body.
type apiError struct {
	status  int
	code    string
	message string
	// cause is logged, never sent: the client sees only the message.
	cause error
}

func badRequest(message string) *apiError {
	return &apiError{http.StatusBadRequest, "invalid_request", message, nil}
}

func internalError(cause error) *apiError {
	return &apiError{http.StatusInternalServerError, "internal_error", "internal server error", cause}
}

// write sends the error response. A failure with a cause is logged with it: a
// broken request at Warn, a server fault at Error.
func (e *apiError) write(w http.ResponseWriter, r *http.Request, logger *slog.Logger) {
	if e.cause != nil {
		level := slog.LevelWarn
		if e.status >= http.StatusInternalServerError {
			level = slog.LevelError
		}
		logger.LogAttrs(r.Context(), level, "request failed",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Any("error", e.cause),
		)
	}
	writeError(w, e.status, e.code, e.message)
}
