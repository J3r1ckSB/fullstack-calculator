// Package httpapi exposes the calculator over a JSON HTTP API.
package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
)

// Options configures NewHandler.
type Options struct {
	Logger *slog.Logger
	// StaticDir, when set, is served for GET and HEAD requests that match no
	// API route.
	StaticDir string
}

// NewHandler returns the API handler wrapped in logging and panic recovery.
func NewHandler(opts Options) http.Handler {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/{operation}", calculate)
	mux.HandleFunc("/api/v1/{operation}", methodNotAllowed("POST"))
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("/api/", notFound)
	mux.Handle("/", rootHandler(opts.StaticDir))

	return logging(logger, recovery(logger, mux))
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func notFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("no route for %s %s", r.Method, r.URL.Path))
}

// methodNotAllowed answers every method except the allowed ones, which are
// given as an Allow header value such as "POST" or "GET, HEAD".
func methodNotAllowed(allow string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", allow)
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed",
			fmt.Sprintf("method %s not allowed; use %s", r.Method, allow))
	}
}

// rootHandler serves the built frontend, or reports an unknown route when no
// directory is configured.
func rootHandler(staticDir string) http.Handler {
	if staticDir == "" {
		return http.HandlerFunc(notFound)
	}
	files := http.FileServer(http.Dir(staticDir))
	notAllowed := methodNotAllowed("GET, HEAD")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			notAllowed(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
}
