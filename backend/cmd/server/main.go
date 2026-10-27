// Command server runs the calculator API and, optionally, the built frontend.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/J3r1ckSB/fullstack-calculator/backend/internal/httpapi"
)

// Timeouts are unmeasured defaults: requests are tiny and answered in
// microseconds, so they only bound what a stalled client can hold open.
const (
	readHeaderTimeout = 5 * time.Second  // slow-header (Slowloris) clients
	readTimeout       = 10 * time.Second // whole request, body included
	writeTimeout      = 10 * time.Second // response write
	idleTimeout       = 60 * time.Second // keep-alive connections
	shutdownTimeout   = 5 * time.Second  // inside Docker's default 10s stop grace period
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := run(ctx, os.Getenv, os.Stdout)
	stop()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// run serves until ctx is cancelled, then drains in-flight requests. It
// returns only after the shutdown has finished.
func run(ctx context.Context, getenv func(string) string, stdout io.Writer) error {
	cfg, err := loadConfig(getenv)
	if err != nil {
		return err
	}

	logger := slog.New(slog.NewJSONHandler(stdout, nil))
	srv := &http.Server{
		Handler:           httpapi.NewHandler(httpapi.Options{Logger: logger, StaticDir: cfg.staticDir}),
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	ln, err := net.Listen("tcp", ":"+strconv.Itoa(cfg.port))
	if err != nil {
		return err
	}
	logger.Info("listening", slog.String("addr", ln.Addr().String()))

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	// ctx is already cancelled, so the shutdown deadline starts from a fresh context.
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	logger.Info("stopped")
	return nil
}
