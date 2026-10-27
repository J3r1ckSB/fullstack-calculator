STATICCHECK := honnef.co/go/tools/cmd/staticcheck@v0.8.2
IMAGE := fullstack-calculator

.DEFAULT_GOAL := help
.PHONY: help dev-backend dev-frontend test test-backend test-frontend coverage lint build docker-build docker-run

help: ## List the available targets
	@awk -F ':.*## ' '/^[a-z-]+:.*## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev-backend: ## Run the API on port 8080
	cd backend && go run ./cmd/server

dev-frontend: ## Run the Vite dev server on port 5173, proxying /api to port 8080
	cd frontend && npm run dev

test: test-backend test-frontend ## Run both test suites

test-backend: ## Run the Go tests with the race detector
	cd backend && go test -race -cover ./...

test-frontend: ## Run the Vitest suite
	cd frontend && npm test

coverage: ## Write coverage reports for both layers and print their summaries
	cd backend && go test -race -coverprofile=coverage.out ./... \
		&& go tool cover -html=coverage.out -o coverage.html \
		&& go tool cover -func=coverage.out | tail -n 1
	cd frontend && npm run coverage

lint: ## Check formatting, static analysis and types in both layers
	cd backend && test -z "$$(gofmt -l .)" && go vet ./... && go run $(STATICCHECK) ./...
	cd frontend && npm run lint && npm run format:check && npm run typecheck

build: ## Build the server binary into bin/ and the frontend into frontend/dist
	cd backend && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o ../bin/server ./cmd/server
	cd frontend && npm run build

docker-build: ## Build the Docker image
	docker build -t $(IMAGE) .

docker-run: docker-build ## Run the image on http://localhost:8080
	docker run --rm -p 8080:8080 $(IMAGE)
