# Full-stack calculator

A calculator with a React and TypeScript interface and a Go REST API that does the arithmetic: add, subtract, multiply, divide, exponentiation, square root and percentage.

## Quick start with Docker

```sh
docker build -t fullstack-calculator .
docker run --rm -p 8080:8080 fullstack-calculator
```

Open http://localhost:8080. The same container serves the interface at `/` and the API under `/api/v1`.

## Local development

Prerequisites:

- Go 1.26 or newer (developed on 1.27.3).
- Node 24, the version in `frontend/.nvmrc`, with npm.
- Docker, only for the image.

Run the backend on port 8080:

```sh
cd backend
go run ./cmd/server
```

Run the frontend in a second terminal. Vite serves it on http://localhost:5173 and proxies `/api` to port 8080:

```sh
cd frontend
npm ci
npm run dev
```

The server reads two environment variables:

| Variable     | Default | Meaning                                                                                  |
| ------------ | ------- | ---------------------------------------------------------------------------------------- |
| `PORT`       | `8080`  | Listen port, an integer from 1 to 65535. Anything else exits with status 1.              |
| `STATIC_DIR` | unset   | Directory with the built frontend. It must exist. When set, the server serves it at `/`. |

Makefile shortcuts, run from the repository root. `make` alone lists them.

| Target                            | What it runs                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `make dev-backend`                | The API on port 8080.                                            |
| `make dev-frontend`               | The Vite dev server.                                             |
| `make test`                       | Both test suites.                                                |
| `make coverage`                   | Both suites with coverage reports.                               |
| `make lint`                       | gofmt, go vet, staticcheck, ESLint, Prettier and the type check. |
| `make build`                      | `bin/server` and `frontend/dist`.                                |
| `make docker-build`, `docker-run` | The image, and a container on port 8080.                         |

## Tests and coverage

Backend, from `backend/`:

```sh
go test -race -cover ./...
```

Frontend, from `frontend/`:

```sh
npm test
npm run coverage
```

`make coverage` also writes `backend/coverage.html` and `frontend/coverage/index.html`. Both are gitignored, and CI artifacts need a GitHub login, so this is the coverage output as of the last commit.

Backend:

```text
ok  	github.com/J3r1ckSB/fullstack-calculator/backend/cmd/server	1.153s	coverage: 31.7% of statements
ok  	github.com/J3r1ckSB/fullstack-calculator/backend/internal/calculator	1.137s	coverage: 100.0% of statements
ok  	github.com/J3r1ckSB/fullstack-calculator/backend/internal/httpapi	1.175s	coverage: 96.3% of statements
```

`cmd/server` is low because only `loadConfig` has tests. `main` and `run` (listening and graceful shutdown) do not.

Frontend. Vitest leaves files at 100% on every metric out of the table.

```text
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.56 |     97.1 |     100 |   99.42 |
 src/api           |     100 |    97.61 |     100 |     100 |
  client.ts        |     100 |    97.61 |     100 |     100 | 123
 src/calculator    |     100 |    99.09 |     100 |     100 |
  state.ts         |     100 |       99 |     100 |     100 | 317
 src/components    |    92.1 |    85.71 |     100 |   96.55 |
  Display.tsx      |   72.72 |       70 |     100 |   85.71 | 9
-------------------|---------|----------|---------|---------|-------------------
```

Both suites run against `contract/examples.json`, so a mismatch between the layers fails a test on whichever side moved.

## API

All paths are under `/api/v1`. Requests and responses are JSON.

| Method | Path                 | Body                 | Result                                  |
| ------ | -------------------- | -------------------- | --------------------------------------- |
| POST   | `/api/v1/add`        | `{"a": 2, "b": 3}`   | a + b                                   |
| POST   | `/api/v1/subtract`   | `{"a": 2, "b": 3}`   | a - b                                   |
| POST   | `/api/v1/multiply`   | `{"a": 2, "b": 3}`   | a × b                                   |
| POST   | `/api/v1/divide`     | `{"a": 2, "b": 3}`   | a ÷ b                                   |
| POST   | `/api/v1/power`      | `{"a": 2, "b": 3}`   | a raised to b                           |
| POST   | `/api/v1/percentage` | `{"a": 15, "b": 80}` | a percent of b: a × b / 100             |
| POST   | `/api/v1/sqrt`       | `{"a": 16}`          | square root of a                        |
| GET    | `/healthz`           |                      | `{"status":"ok"}`, for container probes |

A success is `200 {"result": <number>}`. The result is the exact float64 value.

```sh
curl -s -X POST localhost:8080/api/v1/add -H 'Content-Type: application/json' -d '{"a": 2, "b": 3}'
```

```text
{"result":5}
```

```sh
curl -s -X POST localhost:8080/api/v1/add -H 'Content-Type: application/json' -d '{"a": 0.1, "b": 0.2}'
```

```text
{"result":0.30000000000000004}
```

```sh
curl -s -X POST localhost:8080/api/v1/percentage -H 'Content-Type: application/json' -d '{"a": 15, "b": 80}'
```

```text
{"result":12}
```

```sh
curl -s -X POST localhost:8080/api/v1/sqrt -H 'Content-Type: application/json' -d '{"a": 16}'
```

```text
{"result":4}
```

An error has the shape `{"error": {"code": "...", "message": "..."}}`:

```sh
curl -s -w '\nHTTP %{http_code}\n' -X POST localhost:8080/api/v1/divide -H 'Content-Type: application/json' -d '{"a": 1, "b": 0}'
```

```text
{"error":{"code":"division_by_zero","message":"division by zero is undefined"}}
HTTP 422
```

```sh
curl -s -w '\nHTTP %{http_code}\n' -X POST localhost:8080/api/v1/add -H 'Content-Type: application/json' -d '{"a": 1}'
```

```text
{"error":{"code":"invalid_request","message":"missing operand \"b\""}}
HTTP 400
```

```sh
curl -s -w '\nHTTP %{http_code}\n' -X POST localhost:8080/api/v1/modulo -H 'Content-Type: application/json' -d '{"a": 1, "b": 2}'
```

```text
{"error":{"code":"unknown_operation","message":"unknown operation \"modulo\""}}
HTTP 404
```

| Status | Code                     | When                                                                                                                                                                          |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `invalid_request`        | The body is empty, not valid JSON, not an object or has trailing data. An operand is missing, null, not a number or out of range. A field is unknown, or `sqrt` receives `b`. |
| 404    | `unknown_operation`      | `POST /api/v1/{operation}` with an operation not in the table.                                                                                                                |
| 404    | `not_found`              | Any other unknown route.                                                                                                                                                      |
| 405    | `method_not_allowed`     | A method other than POST on an operation, with `Allow: POST`.                                                                                                                 |
| 413    | `request_too_large`      | The body is larger than 4096 bytes.                                                                                                                                           |
| 415    | `unsupported_media_type` | The Content-Type is not `application/json`. A charset parameter is allowed.                                                                                                   |
| 422    | `division_by_zero`       | Division by 0, or `power` with a = 0 and b < 0.                                                                                                                               |
| 422    | `negative_square_root`   | `sqrt` with a < 0.                                                                                                                                                            |
| 422    | `undefined_result`       | The result is NaN, for example (-8)^0.5.                                                                                                                                      |
| 422    | `result_out_of_range`    | The result is infinite, for example 10^400.                                                                                                                                   |
| 500    | `internal_error`         | An unexpected failure, such as a recovered panic.                                                                                                                             |

`contract/examples.json` holds 30 request and response pairs. They cover every row above except 413 and 500, which the Go handler tests exercise directly. It is the executable contract: the Go handler tests and the frontend client tests both replay it.

## Project structure

```text
backend/
  cmd/server/           entrypoint: environment config, timeouts, graceful shutdown
  internal/calculator/  the arithmetic and its domain errors, with no HTTP or JSON
  internal/httpapi/     routing, validation, error mapping, logging and panic recovery
contract/               examples.json, the API contract both test suites run against
frontend/
  src/api/              typed API client and its error kinds
  src/calculator/       input state machine, the hook that runs requests, number formatting
  src/components/       calculator, display, keypad and the key table
.github/workflows/      CI: both layers and the Docker build
Dockerfile              builds the frontend and the server into one image
Makefile                shortcuts for the commands above
```

## Design decisions and assumptions

- **Standard library only in the backend.** `net/http` method patterns, `encoding/json` and `log/slog` cover this API, so there is no `go.sum` and nothing to audit.
- **One endpoint per operation.** `POST /api/v1/{operation}` gives each operation its own arity check, and an unknown operation is a 404 that a client can tell apart from a bad body.
- **400 versus 422.** A 400 means the request is malformed. A 422 means it is well-formed but the operation has no real, representable result, such as dividing by zero.
- **float64 with display rounding.** The API returns the exact IEEE-754 result. The frontend rounds each result to 15 significant digits, float64's guaranteed decimal precision, so `0.1 + 0.2` shows `0.3` and the next step starts from the value on screen. Money would need decimal arithmetic or integer minor units.
- **Percentage.** `a percent of b` is a × b / 100, multiplying first so `15` of `80` is exactly `12` and `7` of `3` is `0.21`. If the product overflows, it uses (a / 100) × b. On the keypad, type `15`, press `%`, type `80`, press `=`.
- **Left-to-right evaluation.** Each operator press with a pending operation sends one request, so `2 + 3 × 4 = 20`, like a pocket calculator. Precedence and parentheses are out of scope.
- **The keypad makes invalid input unrepresentable.** There are no letters, at most one decimal point and at most 15 digits per number. The keyboard maps digits, `+ - * / ^ %`, Enter, Backspace and Escape to the same actions. The server still validates everything, because it cannot assume its caller is this interface.
- **A shared contract file.** `contract/examples.json` is the one description of the API. Neither layer's tests copy it, so a change starts there and both suites fail until each side follows.
- **Same origin, so no CORS.** The Go server serves the built interface and the API from one port, and the Vite dev server proxies `/api` to it.
- **Graceful shutdown and timeouts.** The server drains in-flight requests for up to 5 seconds on SIGINT or SIGTERM, inside Docker's default 10-second stop period. Read-header (5 s), read and write (10 s) and idle (60 s) timeouts keep slow clients from holding connections open. These values are unmeasured defaults, as is the client's 10-second request timeout.
- **A 4 KiB body cap.** A valid request is under 100 bytes. The cap bounds memory per request and leaves room for whitespace and long decimal literals.

## What I would do next

- Move money-like use cases to decimal arithmetic or integer minor units.
- Publish an OpenAPI spec and check it against `contract/examples.json`.
- Add Playwright end-to-end tests that drive the keypad against the real server.
- Test `run` in `cmd/server`, including the shutdown path.
- Add per-client rate limiting in front of the API.
