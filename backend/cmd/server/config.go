package main

import (
	"fmt"
	"os"
	"strconv"
)

const defaultPort = 8080

type config struct {
	port      int
	staticDir string
}

func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{port: defaultPort, staticDir: getenv("STATIC_DIR")}

	if raw := getenv("PORT"); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return config{}, fmt.Errorf("PORT %q must be an integer from 1 to 65535", raw)
		}
		cfg.port = port
	}

	if cfg.staticDir != "" {
		info, err := os.Stat(cfg.staticDir)
		if err != nil {
			return config{}, fmt.Errorf("STATIC_DIR: %w", err)
		}
		if !info.IsDir() {
			return config{}, fmt.Errorf("STATIC_DIR %q is not a directory", cfg.staticDir)
		}
	}
	return cfg, nil
}
