package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/iotest"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func post(h http.Handler, path, contentType, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func assertError(t *testing.T, rec *httptest.ResponseRecorder, status int, code, message string) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status = %d, want %d; body %s", rec.Code, status, rec.Body)
	}
	var body errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not an error body: %v; body %s", err, rec.Body)
	}
	if body.Error.Code != code || body.Error.Message != message {
		t.Errorf("error = %+v, want code %q message %q", body.Error, code, message)
	}
}

func TestRequestTooLarge(t *testing.T) {
	const want = "request body exceeds 4096 bytes"
	h := NewHandler(Options{Logger: discardLogger()})

	tests := []struct {
		name string
		body string
	}{
		{"long string field", `{"a":"` + strings.Repeat("x", 5000) + `"}`},
		{"valid object padded with whitespace", `{"a":1,"b":2}` + strings.Repeat(" ", 5000)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := post(h, "/api/v1/add", "application/json", tc.body)
			assertError(t, rec, http.StatusRequestEntityTooLarge, "request_too_large", want)
		})
	}
}

// These encoding/json behaviors are accepted as they are; the tests pin them
// so a change in the standard library or the decoder setup is noticed.
func TestAcceptedDecoderBehavior(t *testing.T) {
	h := NewHandler(Options{Logger: discardLogger()})

	t.Run("null body is a missing operand", func(t *testing.T) {
		rec := post(h, "/api/v1/add", "application/json", `null`)
		assertError(t, rec, http.StatusBadRequest, "invalid_request", `missing operand "a"`)
	})
	t.Run("null b counts as missing for sqrt", func(t *testing.T) {
		rec := post(h, "/api/v1/sqrt", "application/json", `{"a":4,"b":null}`)
		if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"result":2}` {
			t.Errorf("got %d %s, want 200 {\"result\":2}", rec.Code, rec.Body)
		}
	})
	t.Run("keys match case-insensitively", func(t *testing.T) {
		rec := post(h, "/api/v1/add", "application/json", `{"A":1,"B":2}`)
		if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"result":3}` {
			t.Errorf("got %d %s, want 200 {\"result\":3}", rec.Code, rec.Body)
		}
	})
}

func TestContentType(t *testing.T) {
	h := NewHandler(Options{Logger: discardLogger()})

	t.Run("charset parameter is accepted", func(t *testing.T) {
		rec := post(h, "/api/v1/add", "application/json; charset=utf-8", `{"a":1,"b":2}`)
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want 200; body %s", rec.Code, rec.Body)
		}
	})
	t.Run("missing header is rejected", func(t *testing.T) {
		rec := post(h, "/api/v1/add", "", `{"a":1,"b":2}`)
		assertError(t, rec, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
	})
}

func TestStaticFiles(t *testing.T) {
	dir := t.TempDir()
	const index = "<!doctype html><title>Calculator</title>"
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(index), 0o600); err != nil {
		t.Fatal(err)
	}
	h := NewHandler(Options{Logger: discardLogger(), StaticDir: dir})

	t.Run("serves index.html", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusOK || rec.Body.String() != index {
			t.Errorf("got %d %q, want 200 %q", rec.Code, rec.Body, index)
		}
	})
	t.Run("rejects other methods", func(t *testing.T) {
		rec := post(h, "/", "application/json", `{}`)
		assertError(t, rec, http.StatusMethodNotAllowed, "method_not_allowed", "method POST not allowed; use GET, HEAD")
		if got := rec.Header().Get("Allow"); got != "GET, HEAD" {
			t.Errorf("Allow = %q, want %q", got, "GET, HEAD")
		}
	})
	t.Run("missing file is a 404 from the file server", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/missing.js", nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", rec.Code)
		}
	})
	t.Run("API routes still win", func(t *testing.T) {
		rec := post(h, "/api/v1/add", "application/json", `{"a":1,"b":2}`)
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want 200", rec.Code)
		}
	})
}

func TestRootWithoutStaticDir(t *testing.T) {
	h := NewHandler(Options{Logger: discardLogger()})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assertError(t, rec, http.StatusNotFound, "not_found", "no route for GET /")
}

func TestUnreadableBodyIsBadRequestAndLogsCause(t *testing.T) {
	var logs bytes.Buffer
	readErr := errors.New("connection reset by peer")
	logger := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelWarn}))
	h := NewHandler(Options{Logger: logger})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/add", iotest.ErrReader(readErr))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assertError(t, rec, http.StatusBadRequest, "invalid_request", "request body could not be read")
	var entry map[string]any
	if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
		t.Fatalf("want one warning line, got %q: %v", logs.String(), err)
	}
	if entry["level"] != "WARN" || entry["error"] != readErr.Error() {
		t.Errorf("log entry = %v, want a WARN carrying %q", entry, readErr)
	}
}

func TestDomainErrorKeepsUnexpectedCause(t *testing.T) {
	cause := errors.New("unexpected failure")

	got := domainError(cause)

	if got.status != http.StatusInternalServerError || got.code != "internal_error" || got.message != "internal server error" {
		t.Errorf("got %d %s %q, want 500 internal_error", got.status, got.code, got.message)
	}
	if !errors.Is(got.cause, cause) {
		t.Errorf("cause = %v, want %v", got.cause, cause)
	}
}
