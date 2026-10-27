package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
)

type contractExample struct {
	Name    string `json:"name"`
	Request struct {
		Method  string            `json:"method"`
		Path    string            `json:"path"`
		Body    json.RawMessage   `json:"body"`
		RawBody *string           `json:"rawBody"`
		Headers map[string]string `json:"headers"`
	} `json:"request"`
	Response struct {
		Status  int               `json:"status"`
		Body    json.RawMessage   `json:"body"`
		Headers map[string]string `json:"headers"`
	} `json:"response"`
}

func loadExamples(t *testing.T) []contractExample {
	t.Helper()
	data, err := os.ReadFile("../../../contract/examples.json")
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Examples []contractExample `json:"examples"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Examples) == 0 {
		t.Fatal("contract has no examples")
	}
	return file.Examples
}

func (e contractExample) newRequest() *http.Request {
	var body io.Reader = http.NoBody
	switch {
	case e.Request.RawBody != nil:
		body = strings.NewReader(*e.Request.RawBody)
	case len(e.Request.Body) > 0:
		body = bytes.NewReader(e.Request.Body)
	}
	req := httptest.NewRequest(e.Request.Method, e.Request.Path, body)
	req.Header.Set("Content-Type", "application/json")
	for name, value := range e.Request.Headers {
		req.Header.Set(name, value)
	}
	return req
}

func TestContract(t *testing.T) {
	handler := NewHandler(Options{Logger: discardLogger()})

	for _, ex := range loadExamples(t) {
		t.Run(ex.Name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, ex.newRequest())

			if rec.Code != ex.Response.Status {
				t.Fatalf("status = %d, want %d; body %s", rec.Code, ex.Response.Status, rec.Body)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			for name, want := range ex.Response.Headers {
				if got := rec.Header().Get(name); got != want {
					t.Errorf("header %s = %q, want %q", name, got, want)
				}
			}

			var want, got any
			if err := json.Unmarshal(ex.Response.Body, &want); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("response is not JSON: %v; body %s", err, rec.Body)
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("body = %s, want %s", rec.Body, ex.Response.Body)
			}
		})
	}
}

// reflect.DeepEqual treats -0 and 0 as equal, so check the wire bytes.
func TestContractNegativeZeroIsNotSerialized(t *testing.T) {
	handler := NewHandler(Options{Logger: discardLogger()})

	for _, ex := range loadExamples(t) {
		if ex.Name != "negative zero is normalized" {
			continue
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, ex.newRequest())
		if strings.Contains(rec.Body.String(), "-0") {
			t.Errorf("body = %s, contains -0", rec.Body)
		}
		return
	}
	t.Fatal(`example "negative zero is normalized" not found`)
}
