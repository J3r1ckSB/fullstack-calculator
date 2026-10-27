package main

import (
	"os"
	"path/filepath"
	"testing"
)

func env(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()

	tests := []struct {
		name string
		env  map[string]string
		want config
	}{
		{"defaults", nil, config{port: 8080}},
		{"custom port", map[string]string{"PORT": "9090"}, config{port: 9090}},
		{"lowest port", map[string]string{"PORT": "1"}, config{port: 1}},
		{"highest port", map[string]string{"PORT": "65535"}, config{port: 65535}},
		{"static directory", map[string]string{"STATIC_DIR": dir}, config{port: 8080, staticDir: dir}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := loadConfig(env(tc.env))
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.want {
				t.Errorf("config = %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestLoadConfigErrors(t *testing.T) {
	file := filepath.Join(t.TempDir(), "file.txt")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		env  map[string]string
	}{
		{"port is not a number", map[string]string{"PORT": "http"}},
		{"port is zero", map[string]string{"PORT": "0"}},
		{"port is negative", map[string]string{"PORT": "-1"}},
		{"port is too large", map[string]string{"PORT": "65536"}},
		{"static directory is missing", map[string]string{"STATIC_DIR": filepath.Join(t.TempDir(), "missing")}},
		{"static path is a file", map[string]string{"STATIC_DIR": file}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := loadConfig(env(tc.env)); err == nil {
				t.Error("error = nil, want an error")
			}
		})
	}
}
