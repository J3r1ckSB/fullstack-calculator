package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggingRecordsRequest(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		wantLevel string
	}{
		{"success is info", http.StatusOK, "INFO"},
		{"client error is info", http.StatusUnprocessableEntity, "INFO"},
		{"server error is error", http.StatusInternalServerError, "ERROR"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&buf, nil))
			h := logging(logger, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
			}))

			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v1/add", nil))

			var entry map[string]any
			if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
				t.Fatalf("log line is not JSON: %v; %s", err, buf.String())
			}
			if entry["level"] != tc.wantLevel || entry["method"] != "POST" ||
				entry["path"] != "/api/v1/add" || entry["status"] != float64(tc.status) {
				t.Errorf("log entry = %v", entry)
			}
			if _, ok := entry["duration"]; !ok {
				t.Error("log entry has no duration")
			}
		})
	}
}

func TestLoggingDefaultsToOK(t *testing.T) {
	var buf bytes.Buffer
	h := logging(slog.New(slog.NewJSONHandler(&buf, nil)), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["status"] != float64(http.StatusOK) {
		t.Errorf("status = %v, want 200", entry["status"])
	}
}

func TestRecoveryReturnsInternalError(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	h := logging(logger, recovery(logger, panicking))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	assertError(t, rec, http.StatusInternalServerError, "internal_error", "internal server error")

	// The panic line and the access line, which must report the recovered 500.
	lines := bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n"))
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want 2: %s", len(lines), buf.String())
	}
	var panicEntry, accessEntry map[string]any
	if err := json.Unmarshal(lines[0], &panicEntry); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(lines[1], &accessEntry); err != nil {
		t.Fatal(err)
	}
	if panicEntry["panic"] != "boom" || panicEntry["stack"] == "" {
		t.Errorf("panic entry = %v, want the panic value and a stack", panicEntry)
	}
	if accessEntry["status"] != float64(http.StatusInternalServerError) || accessEntry["level"] != "ERROR" {
		t.Errorf("access entry = %v, want an ERROR 500", accessEntry)
	}
}
