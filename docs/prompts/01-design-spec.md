# 1. Design spec

Written by Claude Opus 5.5 from the assignment, then corrected with the plan check's findings (see `02-plan-check.md`). This is the version the build agents read: every lane brief points to it.

````text
# Full-stack calculator: design spec

This spec covers a take-home assignment: build a full-stack calculator. The candidate submits it to a hiring team, who read the code, run it and judge it on correctness, clarity, maintainability and testability. Their instructions:
- Spend about 2–4 hours.
- Use any AI tooling.
- Share the prompts used.

The bar is a clean repository a senior engineer would approve: idiomatic code, meaningful tests, a readable history of meaningful commits, accurate docs, and no filler. When in doubt, choose the simpler design. Add nothing beyond this spec.

## 0. Assignment, verbatim requirements

**Operations**
- Required: add, subtract, multiply, divide.
- Optional: exponentiation, square root, percentage. All three are in scope.

**Frontend (React, TypeScript preferred)**
- Intuitive UI for entering input and displaying results.
- Input validation and error handling.
- Responsive design with basic mobile support.

**Backend (REST API, Go preferred)**
- Expose endpoints for calculator operations.
- Validate input and handle edge cases (division by zero, invalid data).
- Return results in JSON.

**Non-functional**
- Clean, idiomatic code in both layers.
- Unit tests covering key functionality in both layers.
- Docs: setup instructions, API usage, design rationale.
- Optional Dockerfile running frontend and backend together. It is in scope.

**Deliverables**
- A Git repository.
- A README with setup instructions, how to run each layer, API call examples, and design decisions or assumptions.
- Unit tests and a coverage report.
- An optional Dockerfile.

## 1. Repository

**Location and module path**
- Path: `~/Documents/Claude Code/fullstack-calculator`, a git repository on branch `main`.
- Go module path: `github.com/J3r1ckSB/fullstack-calculator/backend`.

**Layout**

```
.editorconfig  .gitignore  .dockerignore  Dockerfile  Makefile  README.md
.github/workflows/ci.yml
contract/README.md  contract/examples.json   # the HTTP contract, consumed by both test suites
backend/   go.mod  cmd/server/  internal/calculator/  internal/httpapi/
frontend/  (Vite + React + TypeScript app)
docs/      (added at the end by the session)
```

**Git**
- Author: the repository owner's existing global git identity. Never change git config.
- Commit format: Conventional Commits (`feat(backend): …`, `test(frontend): …`, `build: …`, `ci: …`, `docs: …`, `chore: …`).
  - Imperative subject of 72 characters or fewer, no trailing period.
  - A body only when the "why" is not obvious, wrapped at 72 characters.
- Every commit is atomic and green: at that commit, the layer it touches builds and its tests pass.
- Every commit message ends with a trailer naming the model that actually wrote it, preceded by a blank line: `Co-Authored-By: Claude <your model name, e.g. Sonnet 5.5> <noreply@anthropic.com>`.
- Never push. Never rewrite commits made by someone else. No merge commits: integration fast-forwards and rebases.

**Code style**
- Comments explain why, never what, and are sparse.
- No commented-out code, TODOs, console logs, dead files or template leftovers.
- No emoji anywhere.

## 2. HTTP contract (frozen; both layers must match it exactly)

All API paths are under `/api/v1`. The API is JSON in and JSON out.

### 2.1 Operations

Each operation is `POST /api/v1/{operation}`.

| operation | operands | result |
|---|---|---|
| `add` | a, b | a + b |
| `subtract` | a, b | a − b |
| `multiply` | a, b | a × b |
| `divide` | a, b | a ÷ b |
| `power` | a, b | a raised to b |
| `percentage` | a, b | a percent of b: a × b / 100. If the intermediate product overflows to ±Inf while (a / 100) × b is finite, use the latter. Multiplying first keeps whole-number percentages exact (15% of 80 = 12, 7% of 3 = 0.21). |
| `sqrt` | a | √a |

- **Request:** a binary operation takes `{"a": <number>, "b": <number>}`; `sqrt` takes `{"a": <number>}`.
- **Success:** `200 {"result": <number>}`.

Arithmetic is IEEE-754 float64.
- The API returns the exact float64 result; for example, 0.1 + 0.2 returns 0.30000000000000004. Rounding for display is the frontend's job.
- A result of negative zero is normalized to 0.

### 2.2 Errors

Every error body has the shape `{"error": {"code": "<code>", "message": "<message>"}}`.
- Messages are lowercase with no trailing period, in Go error style.
- Error responses are `Content-Type: application/json`.

| status | code | when |
|---|---|---|
| 400 | `invalid_request` | The body is empty, not valid JSON, not a JSON object, or has trailing data; an operand is missing, null, not a number or out of float64 range; there is an unknown field; or `sqrt` receives `b`. |
| 404 | `unknown_operation` | `POST /api/v1/{operation}` with an operation not in the table. |
| 404 | `not_found` | Any other unknown route. |
| 405 | `method_not_allowed` | `/api/v1/{operation}` with a method other than POST. Sets the `Allow: POST` header. |
| 413 | `request_too_large` | The body exceeds 4096 bytes. A valid request is well under 100 bytes; the cap bounds memory per request and leaves room for whitespace and long decimal literals. |
| 415 | `unsupported_media_type` | The Content-Type is not `application/json`. Parameters such as `; charset=utf-8` are allowed. A missing header is also a 415. |
| 422 | `division_by_zero` | Divide by 0 (including -0), or `power` with a = 0 and b < 0. |
| 422 | `negative_square_root` | `sqrt` with a < 0. |
| 422 | `undefined_result` | The result is NaN, for example (-8)^0.5. |
| 422 | `result_out_of_range` | The result is ±Inf, for example 10^400 or 1e308 × 10. |
| 500 | `internal_error` | Unexpected failure. Never expected in practice. |

Why 400 versus 422: a 400 means the request itself is malformed. A 422 (RFC 9110 §15.5.21, Unprocessable Content) means the request is well-formed but the operation has no real, representable result for those operands.

Messages (exact strings):
- `division by zero is undefined`
- `square root of a negative number is not a real number`
- `result is not a real number`
- `result is outside the representable range`
- `request body is empty`
- `request body is not valid JSON`
- `request body must be a JSON object`
- `request body must contain a single JSON object`
- `missing operand "b"` (and the same for "a")
- `operand "a" must be a number`
- `operand "a" is outside the representable range`
- `unknown field "c"`
- `operation "sqrt" takes only operand "a"`
- `Content-Type must be application/json`
- `request body exceeds 4096 bytes`
- `unknown operation "modulo"`
- `method GET not allowed; use POST`
- `no route for GET /api/v2/add` (the method and path are interpolated)
- `internal server error`

Other endpoints:
- `GET /healthz` returns `200 {"status":"ok"}`, for container and orchestrator probes.
- When the server is configured with a static directory, every other GET or HEAD request serves files from it (the built frontend).

### 2.3 contract/examples.json

The architect has already written `contract/examples.json` and committed it. It is the independent test oracle: no lane edits anything under `contract/`. If an implementation and the file disagree, the lane stops and reports the mismatch with evidence.

The file is consumed by the Go handler tests (backend) and by the API client tests (frontend). Shape:

```json
{
  "examples": [
    {
      "name": "add two numbers",
      "request": { "method": "POST", "path": "/api/v1/add", "body": { "a": 2, "b": 3 } },
      "response": { "status": 200, "body": { "result": 5 } }
    }
  ]
}
```

Fields:
- **`request.body`**: a JSON value, sent with `Content-Type: application/json`.
- **`request.rawBody`**: a string sent byte for byte, for malformed or out-of-range inputs. It is used instead of `body`.
- **`request.headers`**: an optional object that overrides the default headers.
- **`response.headers`**: an optional object of headers that must be present.

Examples, in this order:

1. add 2 + 3 → 200, result 5
2. subtract 10 − 4 → 200, result 6
3. multiply 2.5 × 4 → 200, result 10
4. divide 1 ÷ 4 → 200, result 0.25
5. power 2^10 → 200, result 1024
6. sqrt 16 → 200, result 4
7. percentage 15 of 80 → 200, result 12
8. add 0.1 + 0.2 → 200, result 0.30000000000000004 (float64 is not rounded)
9. multiply 0 × -5 → 200, result 0 (negative zero is normalized)
10. divide 1 ÷ 0 → 422 `division_by_zero`
11. power 0^-1 → 422 `division_by_zero`
12. sqrt -9 → 422 `negative_square_root`
13. power (-8)^0.5 → 422 `undefined_result`
14. power 10^400 → 422 `result_out_of_range`
15. multiply 1e308 × 10 → 422 `result_out_of_range`
16. add `{"a":1}` → 400 `missing operand "b"`
17. add `{"a":1,"b":null}` → 400 `missing operand "b"`
18. add `{"a":"1","b":2}` → 400 `operand "a" must be a number`
19. add, rawBody `{"a":1e400,"b":1}` → 400 `operand "a" is outside the representable range`
20. add `{"a":1,"b":2,"c":3}` → 400 `unknown field "c"`
21. sqrt `{"a":4,"b":2}` → 400 `operation "sqrt" takes only operand "a"`
22. add, rawBody `{"a": 1,` → 400 `request body is not valid JSON`
23. add, body `[1,2]` → 400 `request body must be a JSON object`
24. add, rawBody `{"a":1,"b":2} {"a":3}` → 400 `request body must contain a single JSON object`
25. add, rawBody `""` (empty string) → 400 `request body is empty`
26. add, header `Content-Type: text/plain`, rawBody `{"a":1,"b":2}` → 415 `unsupported_media_type`
27. POST /api/v1/modulo `{"a":1,"b":2}` → 404 `unknown_operation`
28. GET /api/v1/add, no body → 405 `method_not_allowed`, header `Allow: POST`
29. GET /api/v2/add → 404 `not_found`, message `no route for GET /api/v2/add`
30. GET /healthz → 200 `{"status":"ok"}`

The example names are short lowercase phrases.

## 3. Backend (Go, standard library only)

### Toolchain
- `go.mod` declares `go 1.26`, the oldest Go release still supported upstream. Go 1.27.3 is installed locally.
- Zero third-party modules, so there is no `go.sum`.

### `internal/calculator`
The pure domain package. It has no HTTP and no JSON.
- Functions: `Add`, `Subtract`, `Multiply`, `Divide`, `Power`, `Percentage` take `(a, b float64)`; `Sqrt` takes `(a float64)`. Each returns `(float64, error)`.
- Sentinel errors carry the exact messages from §2.2: `ErrDivisionByZero`, `ErrNegativeSquareRoot`, `ErrUndefinedResult`, `ErrOutOfRange`.
- One unexported helper checks results: NaN → `ErrUndefinedResult`; ±Inf → `ErrOutOfRange`; `r == 0` → return 0, which normalizes -0.
- `Sqrt(-0)` returns 0 and is not an error.
- A package doc comment explains the float64 choice in one or two sentences.

### `internal/httpapi`
The transport layer.
- **`NewHandler(opts Options) http.Handler`**. `Options` holds `Logger *slog.Logger` and `StaticDir string`.
- **Routing**: a Go 1.22+ `http.ServeMux` with method patterns. Two patterns that overlap with neither more specific make `ServeMux` panic; for example, `GET /` together with `/api/` panics. Use this set:
  - `POST /api/v1/{operation}`: the calculation handler.
  - `/api/v1/{operation}`: a JSON 405 with `Allow: POST`.
  - `GET /healthz`
  - `/api/`: a JSON 404 `not_found`.
  - `/`: static files when `StaticDir` is set, but only for GET and HEAD (any other method gets a JSON 405 `method_not_allowed` whose message names the method and with `Allow: GET, HEAD`). Without `StaticDir`, `/` returns a JSON 404 `not_found`.
- **Operation registry**: a map from the operation name in the URL to `{arity, apply}`. It is built from the calculator functions through small `binary(fn)` and `unary(fn)` adapters.
- **Calculation handler, in this order**:
  1. Look up the operation; unknown → 404.
  2. Check the Content-Type with `mime.ParseMediaType`; bad → 415.
  3. Wrap the body in `http.MaxBytesReader(w, r.Body, 4096)`; a `*http.MaxBytesError` → 413.
  4. Decode with `json.Decoder` and `DisallowUnknownFields()` into `struct{ A, B *float64 }`, tagged `json:"a"` and `json:"b"`. Pointers distinguish a missing or null operand from 0. Map errors in one `classify` helper, used for both the Decode error and the step 5 Token error. Check in this order:
     - `errors.As(err, *http.MaxBytesError)` → 413. Check it first: a whitespace-padded oversized body decodes fine and only fails in step 5.
     - `io.EOF` → empty. In step 5, `io.EOF` means success.
     - `*json.SyntaxError` or `io.ErrUnexpectedEOF` → not valid JSON.
     - `*json.UnmarshalTypeError` with an empty `Field` → must be a JSON object.
     - `*json.UnmarshalTypeError` whose `Value` starts with `number` → outside the representable range.
     - Any other `*json.UnmarshalTypeError` → must be a number.
     - An error string with prefix `json: unknown field ` → unknown field (encoding/json has no typed error for this).
  5. Make sure exactly one JSON value was sent: after Decode, `dec.Token()` must return `io.EOF`. Any other token → single JSON object. Errors go through `classify`.

  These encoding/json behaviors were observed and are accepted without extra code. Pin each with a one-line test:
  - A body of `null` → `missing operand "a"`.
  - `sqrt` with `{"a":4,"b":null}` is accepted, because null counts as missing.
  - Keys match case-insensitively: `{"A":1,"B":2}` is accepted.
  6. Validate arity: a missing a, then a missing b; `sqrt` with b → the takes-only-a message.
  7. Apply the operation. Map domain errors with `errors.Is` → 422 and the code; success → 200.
- **Response helpers**:
  - `writeJSON(w, status, v)` sets `Content-Type: application/json` and `X-Content-Type-Options: nosniff`.
  - `writeError(w, status, code, message)`.
  - Never write `-0`; the domain already normalizes it.
- **Logging middleware**: `log/slog` JSON logs with method, path, status and duration. It needs a small status-recording ResponseWriter wrapper, which gets `Unwrap() http.ResponseWriter`. Log 5xx at Error level and the rest at Info.
- **Panic recovery middleware**: log the panic with its stack and return the JSON 500 `internal_error`.
- **Middleware order**: `logging(recovery(mux))`, so a recovered panic is logged as a 500.
- ServeMux's own 307 redirects (`GET /api` → `/api/`, and paths with `//`) are outside the contract and are accepted as they are.

### `cmd/server/main.go`
- `main` builds a context with `signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)` and calls `run(ctx, os.Getenv, os.Stdout) error`; on error it prints to stderr and exits 1.
- `run` loads its config through a testable `loadConfig(getenv)`:
  - `PORT`: default `8080`; must be an integer from 1 to 65535, otherwise an error.
  - `STATIC_DIR`: optional; if set, it must be an existing directory, otherwise an error.
- `run` builds the slog JSON logger, the handler and an `http.Server` with these timeouts:
  - `ReadHeaderTimeout` 5s. Header timeouts guard against slow-header (Slowloris) clients, the issue gosec G112 flags.
  - `ReadTimeout` 10s, `WriteTimeout` 10s, `IdleTimeout` 60s.
  - The values are named constants with a one-line comment.
- `run` logs the listen address, serves, and on context cancellation calls `Shutdown` with a 5s timeout, inside Docker's default 10s stop grace period.
- `run` returns only after `Shutdown` has returned, not as soon as `ListenAndServe` returns `http.ErrServerClosed`.

### Tests
- Table-driven with `t.Run`.
- Errors are checked with `errors.Is`.
- Expected values are written by hand, never computed by the code under test.
- **Trap**: Go constant-folds untyped float constants exactly. `0.1 + 0.2` written as constants equals 0.3, so tests must pass operands through variables or table fields.
- **`calculator_test.go`**: every operation plus these edge cases:
  - Divide: 1/0, 0/0, 1/-0.
  - Power: 0^-1, 0^0=1, 2^-1=0.5, (-8)^3=-512, (-8)^(1/3) → undefined, 10^400 → out of range.
  - Sqrt: √-9, √0, √-0, which is +0 with no error (check `math.Signbit`).
  - Percentage: 15 of 80 = 12, 7 of 3 = 0.21, 1e308 of 10 = 1e307 (the overflow fallback), 1e308 of 1e308 → out of range.
  - Add: 0.1 + 0.2 = 0.30000000000000004; overflow; -0 normalization.
- **`httpapi` tests**:
  - A contract test that loads `../../../contract/examples.json`, sends each example through `NewHandler` via `httptest`, and asserts the status, the JSON-equal body and the required headers. Decode the expected and actual bodies into `any` and compare with `reflect.DeepEqual`. Request bodies are kept as `json.RawMessage` so literals like 1e400 survive. `reflect.DeepEqual` treats -0 and 0 as equal, so add one assertion that the raw body of the "negative zero is normalized" response contains no `-0`.
  - Unit tests for what the examples do not cover:
    - 413 for a 5000-byte body, both a long string field and a valid object padded with whitespace.
    - The three accepted encoding/json quirks above.
    - Content-Type with a charset accepted; missing Content-Type → 415.
    - A panic → 500, using a test-only route or a recovery middleware test.
    - Static serving: index.html is served from a temp dir; POST / → 405; a missing file → 404 from the file server.
    - Logging middleware: records the status.
- **`cmd/server` tests**: `loadConfig` cases (defaults, bad port, missing static dir).
- **Commands**: `go vet ./...`, `gofmt -l .` (empty output), `go test -race -cover ./...`, and `go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...`. Staticcheck v0.8.2 was verified clean on Go 1.27.3 and needs only Go 1.26. Run all four before every backend commit.

## 4. Frontend (Vite + React + TypeScript)

### Scaffold and tooling
- Scaffold with `npm create vite@latest frontend -- --template react-ts --eslint`. Since create-vite 9, plain `--template` defaults to oxlint; the `--eslint` flag keeps the ESLint flat config.
- Remove everything the template adds that this app does not use: `public/` (favicon.svg, icons.svg), `src/App.css`, `src/assets/`, the demo content, `frontend/README.md` and `frontend/.gitignore`. The root `.gitignore` covers node_modules, dist, coverage, `*.local` and logs.
- Use the latest stable versions npm resolves. Commit `package-lock.json`.
- `.nvmrc` = `24` (the current LTS line).
- `engines.node` matches what Vite requires.
- Dev dependencies: vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, and prettier. Keep the template's ESLint flat config and switch typescript-eslint to `recommendedTypeChecked`, using the project service. Add `globalIgnores(['dist', 'coverage'])`.
- **TypeScript**: the template ships TS ~6.0 with `erasableSyntaxOnly`, so classes cannot use constructor parameter properties. Set `"strict": true` explicitly in `tsconfig.app.json`; under TS 6 it is only implicit.
- **Scripts**: `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `lint` (`eslint . --max-warnings 0`), `format`, `format:check`, `test` (`vitest run`), `test:watch`, `coverage` (`vitest run --coverage`, reporters text, html and lcov).
- **`vite.config.ts`**:
  - Dev server proxy `/api` → `http://localhost:8080`.
  - The Vitest config uses the jsdom environment, a setup file with jest-dom matchers and `afterEach(cleanup)`, and coverage over `src/**` excluding `main.tsx` and test files.
- **The scaffold commit already has a test**: `src/App.test.tsx`, a smoke test of the composition root. `vitest run` exits 1 when no test files exist. The UI lane later updates this test to assert that App renders the calculator; that is the only test of another lane it may edit.
- No CSS framework and no UI library: plain CSS with custom properties.
- **Favicon**: an inline SVG data URI in `index.html`, so the Go static server never 404s on `/favicon.ico` noise. The title is `Calculator`.

### Source layout (`src/`)
```
main.tsx                 createRoot + StrictMode + <App/>
App.tsx                  <Calculator client={createCalculatorClient()} />
messages.ts              catalog of every visible string and aria-label (tests import from here; never retype wording)
api/client.ts            createCalculatorClient + CalculatorError + types
api/client.test.ts
calculator/format.ts     formatNumber
calculator/format.test.ts
calculator/state.ts      pure reducer, initial state, selectors for the view
calculator/state.test.ts
calculator/useCalculator.ts       useReducer + effect that runs requests through the client
calculator/useCalculator.test.tsx
components/Calculator.tsx         composes Display, Notice, Keypad; keyboard listener
components/Display.tsx
components/Keypad.tsx
components/keys.ts                key definitions table (label, aria label, action, keyboard keys, grid area)
components/Calculator.test.tsx    integration tests with a fake client
styles.css (or index.css)
test/setup.ts
```

### API client (`api/client.ts`)

```ts
type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
type UnaryOperation = 'sqrt'
type CalculationRequest =
  | { operation: BinaryOperation; a: number; b: number }
  | { operation: UnaryOperation; a: number }
interface CalculatorClient {
  calculate(request: CalculationRequest, options?: { signal?: AbortSignal }): Promise<number>
}
function createCalculatorClient(options?: { baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number }): CalculatorClient
```

**Defaults**
- `baseUrl` is `/api/v1`: same origin in dev through the proxy, and in Docker.
- `fetch` is `globalThis.fetch`.
- `timeoutMs` is 10000. Calls to the local service take milliseconds, so this default is not a measurement. It stops a stalled request from freezing the calculator.

**Request**
- `POST {baseUrl}/{operation}` with `Content-Type: application/json`.
- The body is `{a, b}`, or `{a}` for `sqrt`.

**Errors**
- Failures throw `CalculatorError extends Error` with `kind`, an optional `code` (the server code), an optional `status`, and `cause` (the original error). Errors keep their cause: a transport failure or an unreadable answer is never reported as a math verdict.
- `kind` takes these values:
  - `math`: a 422 with a well-formed error body. The code is one of the four domain codes.
  - `rejected`: any other 4xx with a well-formed error body.
  - `server`: a 5xx, with or without a body.
  - `network`: fetch rejected (server unreachable).
  - `timeout`: no answer within `timeoutMs`.
  - `unreadable`: a 2xx without a finite numeric `result`, a non-JSON body, or a 4xx without a well-formed error body.
- If the caller aborts through its own signal, rethrow the abort error as is, not as a `CalculatorError`; callers ignore it.
- Implement the timeout with `setTimeout` plus an internal `AbortController` combined with the caller's signal, so tests can drive it with fake timers.

**Tests** (`api/client.test.ts`)
- Load `../../../contract/examples.json` (import the JSON).
- For each example the client could produce (POST to `/api/v1/<known operation>`, a `body` that is an object whose keys match the operation's arity, all values finite numbers, and no rawBody or header overrides):
  - Assert that the client sends exactly that path, method, header and JSON body.
  - Return the example's status and body from a fake fetch.
  - Assert either the resolved result or the thrown `CalculatorError`, with `kind` following the status mapping and `code` equal to the body's code.
- Separate tests: network failure, timeout (fake timers), caller abort, a 500 with a non-JSON body, and a 200 whose body lacks `result` or has a non-numeric one.

### Number rounding and formatting (`calculator/format.ts`)
- `roundResult(value: number): number` rounds to 15 significant digits with `Number(value.toPrecision(15))`. Fifteen digits is float64's guaranteed decimal precision (DBL_DIG). If the rounded value is not finite (`Number.MAX_VALUE` rounds past the float64 maximum), return `value` unchanged.
- The reducer stores `roundResult(result)` for every successful calculation. What the person sees is then exactly what the next request sends: `0.1 + 0.2 = − 0.3 =` shows `0`, not `5.55111512312578e-17`. The API still returns exact float64; the README says the frontend rounds to 15 significant digits.
- `formatNumber(value: number): string` returns `String(roundResult(value))`. JavaScript's own number-to-string rules apply: exponent notation outside [1e-6, 1e21), and -0 → "0".
- The longest output is about 23 characters, for example `-0.00000123456789012346` or `-1.7976931348623157e+308`. Size the display for 24.
- Tests:
  - 0.30000000000000004 → "0.3"
  - 5 → "5"
  - -0 → "0"
  - 1/3 → "0.333333333333333"
  - 2/3 → "0.666666666666667"
  - -2.5 → "-2.5"
  - 1e21 → "1e+21"
  - 1e-6 → "0.000001"
  - 1e-7 → "1e-7"
  - 123456789012345680 → "123456789012346000"
  - Number.MAX_VALUE → "1.7976931348623157e+308"
  - roundResult(0.30000000000000004) === 0.3

### State machine (`calculator/state.ts`)
A pure reducer with no I/O. Calculations are requested as data and run by the hook.

Evaluation is immediate and left to right, like a basic calculator: each step is one API call. For example, 2 + 3 × 4 = 20, and the expression line shows the running total.

**Suggested state**
- `operand`: one of
  - `{ kind: 'typed', text }` while the user types;
  - `{ kind: 'computed', value, label? }` for a result or a square root;
  - `null` right after an operator was chosen.
- `accumulator: number | null`, the left side.
- `operator: BinaryOperation | null`.
- `lastExpression` for the line shown after `=`.
- `status`: `'ready' | 'computing' | 'error'`.
- `pending`: the request in flight. It holds an incrementing id, the request, what to do on success, and a snapshot of the state to restore on a transport failure.
- `errorCode` for a math error.
- `notice` for a transport-failure banner.

The initial operand is typed `"0"`.

**Typed operand value**: `Number(text)`. `"0."` → 0 and `"-0"` → -0; the backend normalizes. Computed values are stored already rounded by `roundResult` and are never re-parsed from formatted text.

Any event that changes the operand clears `lastExpression`. `toggleSign` on a computed value also drops its `√(x)` label, so the expression line never describes a value that is no longer on screen.

**Events and rules**

- **`digit(d)`**
  - In the error state, start over with entry `d`.
  - If the operand is null or computed, start a new typed operand `d`. After `=`, this starts a fresh calculation.
  - If typed, `"0"` becomes `d`, `"-0"` becomes `-d`, and anything else appends, but only while the entry has fewer than 15 digits. Count every digit except the leading `0` of `"0."`. Fifteen is DBL_DIG: such a decimal survives a round trip through float64.
- **`decimal`**
  - Error, null or computed → start `"0."`.
  - Typed without a `.` → append it.
  - Otherwise ignore.
- **`toggleSign`**
  - Typed: toggle a leading `-`. `"0"` becomes `"-0"`.
  - Computed: negate the value.
  - Null: start a typed `"-0"`.
  - Error: ignore.
- **`backspace`**
  - Typed: drop the last character. If `""` or `"-"` remains, it becomes `"0"`.
  - Computed or null: ignore.
  - Error: reset to the initial state.
- **`clear`** (AC): reset to the initial state. This also drops `pending`; a late response carries a stale id and is ignored.
- **`operator(op)`**
  - Error: ignore.
  - Operand null (an operator was just chosen) → replace the operator.
  - Operator pending and operand present → request `(operator, accumulator, operand)`. On success: accumulator = result, operator = op, operand = null.
  - Otherwise → accumulator = operand value, operator = op, operand = null.
- **`equals`**
  - Operator pending and operand present → request. On success: operand = computed result, accumulator = null, operator = null, and lastExpression records `a op b`.
  - Otherwise ignore.
- **`squareRoot`**
  - Operand present → request `sqrt(operand)`. On success, operand = computed result with label `√(x)`; the operator and accumulator stay as they were.
  - Operand null or error → ignore.
- **While computing**, every event except `clear`, `succeeded` and `failed` is ignored.
- **`succeeded(id, result)` and `failed(id, error)`** are ignored when the id is not the pending one.
- **Failure handling**
  - A math error → the error state. Show the message for the code; the accumulator, operator and operand are cleared.
  - Any other kind → restore the snapshot taken before the request and set `notice` to the kind. Pressing the same key again retries. The next event clears the notice.

**View selectors**
- **Main display**
  - Typed text exactly as typed.
  - A computed value through `formatNumber`.
  - If the operand is null, the accumulator through `formatNumber`.
  - In the error state, the catalog message for the code.
- **Expression line**
  - Empty initially, but keep its height.
  - `"12 ×"` while an operator is pending.
  - `"12 × 4 ="` after equals.
  - `"√(16)"` after a square root, or `"9 + √(16)"` when an operator is pending.
  - In the error state, a catalog hint telling the person to enter a number or press AC to start over.
- **Operator symbols**: add `+`, subtract `−` (U+2212), multiply `×`, divide `÷`, power `^`, percentage `% of`. The expression for 15 percent of 80 reads `15 % of 80 =`, a typed `15` followed by the `% of` operator.

**Required tests** (as event sequences with expected display and expression)
- `1 2 + 7 =` → 19.
- Chaining: `2 + 3 ×` requests add first, then shows `5 ×`.
- Replacing an operator.
- The 15-digit cap.
- Decimal rules.
- ± on typed, computed and null operands.
- Backspace.
- AC during computing, followed by a stale success that is ignored.
- Events ignored while computing.
- Square root with and without a pending operator.
- A math error, then a digit, starts over.
- A network failure restores the state and sets a notice, and pressing `=` again re-requests.
- Digits after `=` start fresh.

### Hook (`calculator/useCalculator.ts`)
- `useCalculator(client)` returns `{ view, press(action) }`.
- An effect with deps `[pending, client]` calls `client.calculate(pending.request, { signal })` and dispatches `succeeded` or `failed` with the id. `pending` changes only when a new request starts. A dep list keyed on `pending?.id` fails `react-hooks/exhaustive-deps`.
- The cleanup aborts the request; abort errors are ignored. This works under StrictMode's double-invoked effects.
- Tests use `renderHook` with a fake client: a request is sent and its result applied; AC aborts the in-flight request; a rejection maps to a notice.

### UI
- **Layout**: one centered calculator card, with a visually hidden `<h1>` "Calculator".
- **Display**
  - The expression line sits above the main value.
  - The main value is an `<output aria-live="polite" aria-atomic="true">`.
  - It has `aria-busy` while computing.
  - The main value never clips or overflows: its font size steps down by text length (CSS classes or a data attribute keyed on length buckets). It must fit up to 24 characters, for example "-0.00000123456789012346" or an error message, at a 320 px viewport.
  - The expression line can reach about 35 characters, for example `999999999999999 × 999999999999999 =`, and the error hint must fit too. It uses a smaller font and may wrap to a second line (`overflow-wrap: anywhere`). It is never clipped or ellipsized.
- **Notice**: a `role="alert"` banner under the display for transport failures, with the catalog text. It always tells the person the next action, for example "Can't reach the calculator service. Check that it is running, then try again."
- **Keypad**: a CSS grid of `<button type="button">`. Visible labels are symbols; `aria-label`s are words (divide, multiply, power, percent of, square root, toggle sign, backspace, all clear, equals, decimal point). Layout, four columns:

  ```
  AC  ⌫   ±   ÷
  √   xʸ  %   ×
  7   8   9   −
  4   5   6   +
  1   2   3   =
  0 (two columns)  .   =
  ```

  `=` is a single button spanning rows 5 and 6.

  Buttons stay enabled while computing (disabling them would drop focus); the reducer ignores the input.
- **Indicator**: a subtle busy indicator in the display appears only if computing lasts more than 250 ms (CSS `animation-delay` or `transition-delay`), so fast answers never flicker.
- **Keyboard** (window keydown listener; skip events with Ctrl, Meta or Alt so browser shortcuts keep working):

  | key | action |
  |---|---|
  | `0`–`9` | digit |
  | `.` or `,` | decimal |
  | `+` | add |
  | `-` | subtract |
  | `*` | multiply |
  | `/` | divide (call `preventDefault`: Firefox quick find) |
  | `^` | power |
  | `%` | percentage |
  | `Enter` or `=` | equals |
  | `Backspace` | backspace |
  | `Escape` or `Delete` | clear |

  Call `preventDefault` for every handled key. Enter in particular, or a focused button would also fire its own click and input would be applied twice. A test must cover Enter while a digit button has focus.
- **Copy catalog** (`messages.ts`): math errors keyed by code, for example "Can't divide by zero", "No real square root", "No real result", "Result too large". It also holds four transport notices, each naming the next action: `network` (can't reach the service), `timeout` (no answer in time), `server` (the service had a problem), and one shared by `rejected` and `unreadable` (unexpected answer). It also holds the error hint and all aria-labels. Plain words, no internal codes on screen.
- **Styles**
  - System font stack.
  - A restrained palette: neutral surfaces plus one accent for operator keys and a stronger shade of it for `=`.
  - Light and dark themes via `prefers-color-scheme`.
  - WCAG AA contrast.
  - A visible `:focus-visible` ring.
  - Touch targets of 48 px or more.
  - On phones the card fills the width with 16 px gutters, and there is no horizontal scroll at 320 px.
  - Never use these: gradients, glassmorphism, glows, emoji, decorative badges.
  - Motion: only `transform` and `opacity` on key press (a short scale on `:active`), disabled under `prefers-reduced-motion`.
- **Integration tests** (`components/Calculator.test.tsx`, user-event, with a fake client whose results are written in the test, for example `{ 'add 12 7': 19 }`):
  - A click flow.
  - A keyboard flow.
  - Enter on a focused button does not double-apply.
  - Division by zero shows the catalog message, then a digit starts over.
  - A network failure shows the alert, and retry works.
  - ±, backspace and decimal.
  - The busy state sets `aria-busy`.

## 5. Docker, Makefile, CI

### Dockerfile
A multi-stage build from the repository root.
1. `node:24-alpine` builds the frontend.
   - Use `WORKDIR /repo/frontend`, run `npm ci` from the lockfile with a cache-friendly layer order, and `COPY contract /repo/contract` before `npm run build`.
   - `tsc -b` type-checks the client tests, which import `../../../contract/examples.json`; without the copy the build fails with TS2307 (verified). Keep `contract/` out of `.dockerignore`.
2. `golang:1.27-alpine` builds the backend: `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"`.
3. `gcr.io/distroless/static-debian12:nonroot` is the final image. It contains:
   - the binary and `dist/` at `/static`;
   - `ENV PORT=8080 STATIC_DIR=/static`;
   - `EXPOSE 8080`;
   - `USER nonroot:nonroot`;
   - `ENTRYPOINT`.

Pin image tags to specific versions.

Do not use BuildKit-only syntax such as `RUN --mount`. Local verification runs on Colima with the classic builder (buildx is not installed), and the file should build on either builder.

`.dockerignore` excludes `node_modules`, `dist`, coverage output, `.git` and editor files.

**Verification**
- `docker build -t fullstack-calculator .` succeeds.
- `docker run -p 8080:8080 fullstack-calculator` serves the UI at `/` and the API at `/api/v1/...`.
- Docker runs through Colima on this Mac (`colima start` already done; use the `docker` CLI).

### Makefile
- Targets: `help` (default; lists targets), `dev-backend`, `dev-frontend`, `test`, `test-backend`, `test-frontend`, `coverage`, `lint`, `build`, `docker-build`, `docker-run`.
- `coverage` writes `backend/coverage.out`, `backend/coverage.html` and `frontend/coverage/`, all gitignored, and prints each layer's summary.

### CI (`.github/workflows/ci.yml`)
- Runs on push and pull_request.
- `permissions: contents: read`, plus a concurrency group that cancels in-progress runs.
- Jobs:
  - **backend**: `working-directory: backend`. Use setup-go with `go-version-file: backend/go.mod` and `cache: false` (there is no go.sum). Run the gofmt check, vet, `go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...` and `go test -race -coverprofile`, then upload the coverage artifact.
  - **frontend**: setup-node with `node-version-file: frontend/.nvmrc` and the npm cache; `npm ci`, lint, format:check, typecheck, coverage, build; upload the coverage artifact.
  - **docker**: `docker build .`
- Use the current major tags of the official actions; check them with `gh api repos/actions/<name>/releases/latest`.

## 6. README (repository root)

Write in plain, specific English: short sentences, no marketing adjectives, no emoji, no "Features 🚀" sections, no filler intro. Facts only. Every command must have been run successfully, and every API example's output is real output captured from the running server.

Sections:
1. Title and one sentence.
2. A screenshot (added later by the session).
3. **Quick start with Docker**: two commands.
4. **Local development**: prerequisites with versions, then backend, frontend and the Makefile shortcuts.
5. **Tests and coverage**: the commands, plus the real coverage text output for each layer. For Go, the per-package lines of `go test -cover`; for the frontend, the per-file table of `vitest --coverage`. The HTML reports are gitignored, and CI artifacts need a GitHub login, so this text is the coverage report a reviewer can read without running anything.
6. **API**: an endpoint table, curl examples with real responses, the error-code table, and a pointer to `contract/examples.json` as the executable contract.
7. **Project structure**: a short tree with one line per directory.
8. **Design decisions and assumptions**: bullets, each a decision plus the reason in one line:
   - standard library only;
   - an endpoint per operation;
   - 400 versus 422;
   - float64, with display rounding to 15 significant digits (money would use decimal or integer minor units);
   - percentage semantics;
   - left-to-right evaluation;
   - a keypad that makes invalid input unrepresentable, with the server still validating everything;
   - a shared contract file that keeps both layers in step;
   - same origin, so no CORS;
   - graceful shutdown and timeouts;
   - the 4 KiB body cap.
9. **What I would do next**: 3–5 bullets, for example decimal arithmetic for money, an OpenAPI spec, Playwright end-to-end tests, rate limiting.
10. **How this was built**: a short pointer to `docs/ai-workflow.md`, which the session adds.

## 7. Out of scope
- History of past calculations.
- Memory keys.
- Operator precedence and parentheses.
- Localization of decimal separators (only `.` is shown; `,` on the keyboard maps to it).
- Authentication.
- Persistence.
- CORS.
- An OpenAPI spec.
- End-to-end browser tests.
````
