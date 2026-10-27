# 3. Build

Three lanes ran in separate git worktrees: the backend, and in parallel the frontend in two parts, one after the other. An integration lane then joined the branches into a linear history and added the Dockerfile, Makefile, CI and README. Each lane committed its own work, after the checks its brief names. The text after "Part 1's handoff" and "Lane handoffs" is what the earlier lanes reported.

Each agent also received Claude Code's own system prompt and my global working rules, which are not reproduced here. Paths under my home directory are shortened to `~`. Everything else is verbatim.

## Backend lane

Agent: Claude Sonnet 5.5, high effort.

````text
You are the backend lane of a take-home assignment: a full-stack calculator with a Go REST API and a React frontend.

Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/backend (branch "backend"). Your lane directory is backend/ inside it. The frontend is built by another lane in parallel; you do not touch it.

The design spec is at ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md. It is the single source of truth: read the sections named below in full before writing code, and follow them exactly. Where the spec and your judgment disagree, follow the spec and note the disagreement under "deviations". Where the spec cannot be followed (a tool behaves differently than it says), make the smallest change that keeps its intent and report it.

Ground rules for this lane:
- The quality bar is a submission a senior Go/React engineer at a fintech would approve on first read: idiomatic, small focused files, tests that pin behavior, nothing decorative, nothing left over. Comments explain why, never what, and stay sparse. No emoji, no TODOs, no commented-out code, no console logs.
- Work only inside your lane's directory in your worktree. Never edit anything under contract/ (it is the frozen test oracle written by the architect); if your code and contract/examples.json disagree and the spec does not resolve it, stop and report the mismatch with evidence.
- Commits follow spec section 1: Conventional Commits, imperative subject of 72 characters or fewer, a body only when the why is not obvious, and the trailer "Co-Authored-By: Claude <your own model name, e.g. Sonnet 5.5> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push. Each commit must be atomic and green: run the checks this brief names before every commit, and commit only when they pass.
- You may amend or reset commits you made on this lane's branch (never pushed) to keep each commit atomic and green.
- Stop every process you start (servers, watchers) before you finish.
- Report honestly: list each check you ran with its real result. "blocked" with the exact error is better than a claim you did not verify.

Read spec sections 0, 1, 2 and 3 in full. Section 2 is the HTTP contract; contract/examples.json in your worktree is its executable form, and all 30 examples must pass through your handler.

Make exactly these three commits, in order:
1. "feat(backend): add calculator operations with domain errors": backend/go.mod (module github.com/J3r1ckSB/fullstack-calculator/backend, go 1.26, no dependencies) and internal/calculator with its table-driven tests.
2. "feat(backend): serve calculator operations over a JSON API": internal/httpapi (routing, operation registry, request decoding through one classify helper, response helpers, logging and recovery middleware, optional static file serving) with the contract test over ../../../contract/examples.json and the unit tests spec section 3 lists. Split files by responsibility.
3. "feat(backend): add the server entrypoint with graceful shutdown": cmd/server (main, run, loadConfig) with loadConfig tests.

Checks before every commit, run from backend/: "gofmt -l ." prints nothing, "go vet ./...", "go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...", "go test -race -cover ./...".

After commit 3, smoke-test the real server: start it in the background with PORT=18080 from backend/ ("go run ./cmd/server"), then curl GET /healthz, POST /api/v1/add with {"a":2,"b":3} and POST /api/v1/divide with {"a":1,"b":0} (both with Content-Type: application/json), and confirm the JSON log lines. Stop the server. Put the curl outputs in "checks".

In "handoff", list the final file layout of backend/ and anything the integration lane needs (build command, env vars).
````

## Frontend lane, part 1: logic

Agent: Claude Sonnet 5.5, high effort.

````text
You are frontend lane part 1 of 2 for a take-home assignment: a full-stack calculator with a Go REST API and a React + TypeScript frontend. Part 1 builds the scaffold, tooling and all non-visual logic. Part 2 (another agent, after you) builds the components, styles and keyboard input on top of your work.

Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/frontend (branch "frontend"). Your lane directory is frontend/ inside it (create it with the Vite scaffold from the worktree root). The backend is built by another lane in parallel; you do not touch it. The client talks to it only through the contract.

The design spec is at ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md. It is the single source of truth: read the sections named below in full before writing code, and follow them exactly. Where the spec and your judgment disagree, follow the spec and note the disagreement under "deviations". Where the spec cannot be followed (a tool behaves differently than it says), make the smallest change that keeps its intent and report it.

Ground rules for this lane:
- The quality bar is a submission a senior Go/React engineer at a fintech would approve on first read: idiomatic, small focused files, tests that pin behavior, nothing decorative, nothing left over. Comments explain why, never what, and stay sparse. No emoji, no TODOs, no commented-out code, no console logs.
- Work only inside your lane's directory in your worktree. Never edit anything under contract/ (it is the frozen test oracle written by the architect); if your code and contract/examples.json disagree and the spec does not resolve it, stop and report the mismatch with evidence.
- Commits follow spec section 1: Conventional Commits, imperative subject of 72 characters or fewer, a body only when the why is not obvious, and the trailer "Co-Authored-By: Claude <your own model name, e.g. Sonnet 5.5> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push. Each commit must be atomic and green: run the checks this brief names before every commit, and commit only when they pass.
- You may amend or reset commits you made on this lane's branch (never pushed) to keep each commit atomic and green.
- Stop every process you start (servers, watchers) before you finish.
- Report honestly: list each check you ran with its real result. "blocked" with the exact error is better than a claim you did not verify.

Read spec sections 0, 1, 2 and 4 in full. Section 2 and contract/examples.json define every request and response the client handles. Section 4 defines the client, rounding and formatting, the state machine, the hook and the copy catalog. Skip the UI subsections of section 4 except to know what the view selectors must provide.

Make exactly these five commits, in order:
1. "chore(frontend): scaffold Vite, React and TypeScript with Vitest": run "npm create vite@latest frontend -- --template react-ts --eslint" from the worktree root (if the CLI asks questions, choose answers that neither install nor start a server; check "--help" for a no-interactive flag). Remove every template leftover the spec lists, add the tooling, scripts, .nvmrc, Prettier config and Vitest setup from spec section 4, and a placeholder App that renders a main element containing an h1 "Calculator", plus src/App.test.tsx asserting that heading.
2. "feat(frontend): add a typed client for the calculator API": src/api/client.ts and client.test.ts, driven by contract/examples.json as spec section 4 describes, plus the transport-failure tests.
3. "feat(frontend): round and format results to 15 significant digits": src/calculator/format.ts (roundResult, formatNumber) and its tests, exactly the cases in the spec.
4. "feat(frontend): model calculator input as a pure state machine": src/calculator/state.ts (reducer, initial state, view selectors) with the required event-sequence tests, and src/messages.ts with the strings the selectors need: math error messages by code, the error hint and operator symbols.
5. "feat(frontend): run calculations through a useCalculator hook": src/calculator/useCalculator.ts and its renderHook tests with a fake client.

Checks before every commit, run from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build". Install dependencies with npm in frontend/ only.

In "handoff", write what part 2 must know, precisely: the exported types and functions of state.ts, useCalculator.ts and messages.ts (names and signatures), the action names press() accepts, what the view object contains, and the test helpers or fake client you wrote that part 2 can reuse.
````

## Frontend lane, part 2: interface

Agent: Claude Sonnet 5.5, high effort.

````text
You are frontend lane part 2 of 2 for a take-home assignment: a full-stack calculator with a Go REST API and a React + TypeScript frontend. Part 1 (another agent) already committed the scaffold, the API client, rounding and formatting, the pure state machine, the useCalculator hook and the start of the copy catalog. You build the interface on top of it.

Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/frontend (branch "frontend"). Your lane directory is frontend/ inside it.

The design spec is at ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md. It is the single source of truth: read the sections named below in full before writing code, and follow them exactly. Where the spec and your judgment disagree, follow the spec and note the disagreement under "deviations". Where the spec cannot be followed (a tool behaves differently than it says), make the smallest change that keeps its intent and report it.

Ground rules for this lane:
- The quality bar is a submission a senior Go/React engineer at a fintech would approve on first read: idiomatic, small focused files, tests that pin behavior, nothing decorative, nothing left over. Comments explain why, never what, and stay sparse. No emoji, no TODOs, no commented-out code, no console logs.
- Work only inside your lane's directory in your worktree. Never edit anything under contract/ (it is the frozen test oracle written by the architect); if your code and contract/examples.json disagree and the spec does not resolve it, stop and report the mismatch with evidence.
- Commits follow spec section 1: Conventional Commits, imperative subject of 72 characters or fewer, a body only when the why is not obvious, and the trailer "Co-Authored-By: Claude <your own model name, e.g. Sonnet 5.5> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push. Each commit must be atomic and green: run the checks this brief names before every commit, and commit only when they pass.
- You may amend or reset commits you made on this lane's branch (never pushed) to keep each commit atomic and green.
- Stop every process you start (servers, watchers) before you finish.
- Report honestly: list each check you ran with its real result. "blocked" with the exact error is better than a claim you did not verify.

Read spec sections 0, 1 and 4 in full, especially UI, Keyboard, Copy catalog, Styles and Integration tests. Then read part 1's code under frontend/src before writing anything.

Part 1's handoff:
All paths are under frontend/src/. Part 2 should create styles.css and import it in main.tsx. It should replace the placeholder App with <Calculator client={createCalculatorClient()} /> and update src/App.test.tsx, which currently asserts only the h1 'Calculator'.

== api/client.ts ==
Types and values it exports:
- Types: BinaryOperation ('add'|'subtract'|'multiply'|'divide'|'power'|'percentage'), UnaryOperation ('sqrt'), CalculationRequest, CalculatorClient { calculate(request, options?: {signal?}): Promise<number> }, CalculatorClientOptions, ErrorKind ('math'|'rejected'|'server'|'network'|'timeout'|'unreadable'), MathErrorCode.
- Functions: createCalculatorClient(options?: {baseUrl?, fetch?, timeoutMs?}): CalculatorClient; isMathErrorCode(code: unknown): code is MathErrorCode.
- class CalculatorError extends Error, with fields kind, code?, status?, cause. Constructor: new CalculatorError(kind: ErrorKind, message: string, details?: {code?: string; status?: number; cause?: unknown}).
- Component tests build a fake client with CalculatorError, for example new CalculatorError('network', 'x') or new CalculatorError('math', 'x', {code: 'division_by_zero'}).

== messages.ts ==
It exports one const object, `messages`:
- messages.mathErrors: Record<MathErrorCode, string>: "Can't divide by zero", 'No real square root', 'No real result', 'Result too large'.
- messages.notices: Record<ErrorKind, string>. network: "Can't reach the calculator service. Check that it is running, then try again." timeout: 'The calculator service took too long to answer. Try again.' server: 'The calculator service had a problem. Try again in a moment.' rejected, unreadable and math share 'The calculator service sent an unexpected answer. Try again.'
- messages.errorHint: 'Enter a number or press AC to start over'.
- messages.operatorSymbols: Record<BinaryOperation, string>, with add '+', subtract U+2212, multiply U+00D7, divide U+00F7, power '^', percentage '% of'.
- Part 2 should add the key labels and aria-labels here, as new keys on the same object. The file ends with `as const`, and each table uses `satisfies`.

== calculator/state.ts ==
- Types: Digit ('0'..'9'); Action; CalculatorEvent; CalculatorState; CalculatorView; Operand; Pending.
- Action is the union accepted by press():
  - { type: 'digit'; digit: Digit }
  - { type: 'decimal' }
  - { type: 'toggleSign' }
  - { type: 'backspace' }
  - { type: 'clear' }
  - { type: 'operator'; operator: BinaryOperation }
  - { type: 'equals' }
  - { type: 'squareRoot' }
- CalculatorEvent is Action plus { type: 'succeeded'; id; result } and { type: 'failed'; id; error: CalculatorError }. Only the hook dispatches the last two.
- initialState: CalculatorState.
- reducer(state: CalculatorState, event: CalculatorEvent): CalculatorState.
- selectView(state: CalculatorState): CalculatorView.
- CalculatorView = { display: string; expression: string; status: 'ready'|'computing'|'error'; notice: string | null }.
  - display is the main value: typed text as typed, a formatted computed value, or the catalog math-error message.
  - expression is the line above it. It is '' when idle, so keep its height in CSS. In the error state it holds the hint.
  - status 'computing' is for aria-busy and the delayed busy indicator. 'error' is when display shows a math error.
  - notice is the ready-to-show transport text, or null. Render role=alert only when it is non-null.
- Behavior part 2 relies on: user events are ignored while computing, except clear. Any user event clears the notice. nextId survives clear.
- The key table in components/keys.ts should map each key to an Action. For example, key '5' is {type:'digit', digit:'5'}, '=' is {type:'equals'}, 'xʸ' is {type:'operator', operator:'power'}, '%' is {type:'operator', operator:'percentage'}, and AC and Escape/Delete are {type:'clear'}.

== calculator/useCalculator.ts ==
- useCalculator(client: CalculatorClient): { view: CalculatorView; press: (action: Action) => void }.
- press is stable across renders (useCallback).
- The request effect has deps [pending, client]. It aborts on cleanup and ignores results of aborted requests.
- A non-CalculatorError rejection becomes an 'unreadable' notice.

== calculator/format.ts ==
- roundResult(value: number): number and formatNumber(value: number): string.

== Test helpers ==
- test/setup.ts (in the vite.config.ts setupFiles) loads the jest-dom matchers and runs afterEach(cleanup).
- No reusable fake client was exported. The fake in calculator/useCalculator.test.tsx is local: a deferred client that records calls and lets the test resolve or reject each one, plus a `settle` helper that wraps act. Part 2's component fake client (results map such as { 'add 12 7': 19 }) is its own to write. It must implement CalculatorClient.calculate(request, {signal}) and reject with a CalculatorError for failures.
- renderHook's reactStrictMode option works for StrictMode wrapping.

== Tooling notes ==
- vite.config.ts uses defineConfig from 'vitest/config', with the /api proxy to http://localhost:8080 and coverage over src/** (excluding main.tsx, test files, test/).
- ESLint uses recommendedTypeChecked with projectService. Prettier is semi:false, singleQuote:true.
- tsconfig.app.json has strict:true and erasableSyntaxOnly, so a class cannot use constructor parameter properties.
- TS imports the contract JSON from ../../../contract/examples.json (resolveJsonModule is on by default with bundler resolution).
- `npm install` printed an 'allow-scripts' warning about pending lifecycle scripts. It does not affect lint, tests or build.

Make exactly these two commits, in order:
6. "feat(frontend): build the calculator interface": src/components/Calculator.tsx, Display.tsx, Keypad.tsx and keys.ts (the key definitions table), the stylesheet, App wiring with createCalculatorClient, an updated src/App.test.tsx asserting that App renders the calculator (this is the only test of part 1 you may change), and src/components/Calculator.test.tsx with the click flows, the error and notice flows and the busy state. Add the remaining strings and aria-labels to src/messages.ts.
7. "feat(frontend): support keyboard input": the window keydown handling from the spec's keyboard table, with tests that include Enter while a digit button has focus (it must apply exactly once) and that modifier-key shortcuts are left alone.

Constraints:
- Do not change part 1's logic files except to fix a defect you can demonstrate. Report each such change under "deviations" with the failing case.
- Styles: plain CSS with custom properties, a light and a dark theme, a system font stack and a restrained palette with one accent. Visible focus rings, targets of 48px or more, and no horizontal scroll at 320px. The main value never clips at 24 characters, and the expression line wraps instead of clipping. Motion only on key press, using transform and opacity, and off under prefers-reduced-motion. No gradients, glows, glassmorphism or emoji.
- You cannot open a browser here. A separate walkthrough will open the app and inspect screenshots in light and dark mode and at 320px, so make the CSS correct by construction and keep it small and readable.

Checks before every commit, run from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".

In "handoff", list the final file layout of frontend/src and anything the integration lane needs.
````

## Integration lane

Agent: Claude Sonnet 5.5, high effort.

````text
You are the integration lane of a take-home assignment: a full-stack calculator with a Go REST API (backend/) and a React + TypeScript frontend (frontend/). Two lanes built them on separate branches in git worktrees. You join them into one linear history on main, then add the Dockerfile, Makefile, CI workflow and README.

Repository: ~/Documents/Claude Code/fullstack-calculator (branch main). Worktrees: ~/Documents/Claude Code/fullstack-calculator.worktrees/backend (branch backend), ~/Documents/Claude Code/fullstack-calculator.worktrees/frontend (branch frontend).

The design spec is at ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md. It is the single source of truth: read the sections named below in full before writing code, and follow them exactly. Where the spec and your judgment disagree, follow the spec and note the disagreement under "deviations". Where the spec cannot be followed (a tool behaves differently than it says), make the smallest change that keeps its intent and report it.

Ground rules for this lane:
- The quality bar is a submission a senior Go/React engineer at a fintech would approve on first read: idiomatic, small focused files, tests that pin behavior, nothing decorative, nothing left over. Comments explain why, never what, and stay sparse. No emoji, no TODOs, no commented-out code, no console logs.
- Work only inside your lane's directory in your worktree. Never edit anything under contract/ (it is the frozen test oracle written by the architect); if your code and contract/examples.json disagree and the spec does not resolve it, stop and report the mismatch with evidence.
- Commits follow spec section 1: Conventional Commits, imperative subject of 72 characters or fewer, a body only when the why is not obvious, and the trailer "Co-Authored-By: Claude <your own model name, e.g. Sonnet 5.5> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push. Each commit must be atomic and green: run the checks this brief names before every commit, and commit only when they pass.
- You may amend or reset commits you made on this lane's branch (never pushed) to keep each commit atomic and green.
- Stop every process you start (servers, watchers) before you finish.
- Report honestly: list each check you ran with its real result. "blocked" with the exact error is better than a claim you did not verify.

Read spec sections 0, 1, 5 and 6 in full, and skim 2 to 4 so the README describes the real system. Read ~/.claude/docs/voice-without-ai.md before writing the README and follow it.

Lane handoffs:
- Backend: Final layout of backend/ (module github.com/J3r1ckSB/fullstack-calculator/backend, go 1.26, no dependencies, no go.sum):
backend/go.mod
backend/cmd/server/{main.go, config.go, config_test.go}
backend/internal/calculator/{calculator.go, calculator_test.go}
backend/internal/httpapi/{handler.go (Options, NewHandler, routes, static root), calculate.go (calculation handler, validation, domain-error mapping), decode.go (body decoding, classify), apierror.go, response.go (writeJSON, writeError), operations.go (registry with binary/unary adapters), middleware.go (logging, recovery, statusRecorder), contract_test.go, handler_test.go, middleware_test.go}

For integration:
- Run: cd backend && go run ./cmd/server (dev, default port 8080, matches the frontend proxy).
- Build: cd backend && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o server ./cmd/server
- Env vars: PORT (default 8080, integer 1..65535, otherwise the process exits 1 with an error on stderr). STATIC_DIR (optional, must be an existing directory; serves the built frontend for GET/HEAD on routes that match no API route).
- Logs are slog JSON on stdout. SIGINT/SIGTERM drain with a 5s shutdown timeout.
- Contract test path: backend/internal/httpapi reads ../../../contract/examples.json, so the backend/ and contract/ directories must stay siblings.
- Coverage: go test -race -coverprofile=coverage.out ./... then go tool cover -html=coverage.out -o coverage.html. Current per-package: cmd/server 31.7%, calculator 100.0%, httpapi 96.3%. backend/coverage.out and backend/coverage.html are already in the root .gitignore.
- CI and Makefile can use the four check commands exactly as listed in the brief; staticcheck@v0.8.2 downloads its own module at run time and needs network access on first use.
- Frontend part 1: All paths are under frontend/src/. Part 2 should create styles.css and import it in main.tsx. It should replace the placeholder App with <Calculator client={createCalculatorClient()} /> and update src/App.test.tsx, which currently asserts only the h1 'Calculator'.

== api/client.ts ==
Types and values it exports:
- Types: BinaryOperation ('add'|'subtract'|'multiply'|'divide'|'power'|'percentage'), UnaryOperation ('sqrt'), CalculationRequest, CalculatorClient { calculate(request, options?: {signal?}): Promise<number> }, CalculatorClientOptions, ErrorKind ('math'|'rejected'|'server'|'network'|'timeout'|'unreadable'), MathErrorCode.
- Functions: createCalculatorClient(options?: {baseUrl?, fetch?, timeoutMs?}): CalculatorClient; isMathErrorCode(code: unknown): code is MathErrorCode.
- class CalculatorError extends Error, with fields kind, code?, status?, cause. Constructor: new CalculatorError(kind: ErrorKind, message: string, details?: {code?: string; status?: number; cause?: unknown}).
- Component tests build a fake client with CalculatorError, for example new CalculatorError('network', 'x') or new CalculatorError('math', 'x', {code: 'division_by_zero'}).

== messages.ts ==
It exports one const object, `messages`:
- messages.mathErrors: Record<MathErrorCode, string>: "Can't divide by zero", 'No real square root', 'No real result', 'Result too large'.
- messages.notices: Record<ErrorKind, string>. network: "Can't reach the calculator service. Check that it is running, then try again." timeout: 'The calculator service took too long to answer. Try again.' server: 'The calculator service had a problem. Try again in a moment.' rejected, unreadable and math share 'The calculator service sent an unexpected answer. Try again.'
- messages.errorHint: 'Enter a number or press AC to start over'.
- messages.operatorSymbols: Record<BinaryOperation, string>, with add '+', subtract U+2212, multiply U+00D7, divide U+00F7, power '^', percentage '% of'.
- Part 2 should add the key labels and aria-labels here, as new keys on the same object. The file ends with `as const`, and each table uses `satisfies`.

== calculator/state.ts ==
- Types: Digit ('0'..'9'); Action; CalculatorEvent; CalculatorState; CalculatorView; Operand; Pending.
- Action is the union accepted by press():
  - { type: 'digit'; digit: Digit }
  - { type: 'decimal' }
  - { type: 'toggleSign' }
  - { type: 'backspace' }
  - { type: 'clear' }
  - { type: 'operator'; operator: BinaryOperation }
  - { type: 'equals' }
  - { type: 'squareRoot' }
- CalculatorEvent is Action plus { type: 'succeeded'; id; result } and { type: 'failed'; id; error: CalculatorError }. Only the hook dispatches the last two.
- initialState: CalculatorState.
- reducer(state: CalculatorState, event: CalculatorEvent): CalculatorState.
- selectView(state: CalculatorState): CalculatorView.
- CalculatorView = { display: string; expression: string; status: 'ready'|'computing'|'error'; notice: string | null }.
  - display is the main value: typed text as typed, a formatted computed value, or the catalog math-error message.
  - expression is the line above it. It is '' when idle, so keep its height in CSS. In the error state it holds the hint.
  - status 'computing' is for aria-busy and the delayed busy indicator. 'error' is when display shows a math error.
  - notice is the ready-to-show transport text, or null. Render role=alert only when it is non-null.
- Behavior part 2 relies on: user events are ignored while computing, except clear. Any user event clears the notice. nextId survives clear.
- The key table in components/keys.ts should map each key to an Action. For example, key '5' is {type:'digit', digit:'5'}, '=' is {type:'equals'}, 'xʸ' is {type:'operator', operator:'power'}, '%' is {type:'operator', operator:'percentage'}, and AC and Escape/Delete are {type:'clear'}.

== calculator/useCalculator.ts ==
- useCalculator(client: CalculatorClient): { view: CalculatorView; press: (action: Action) => void }.
- press is stable across renders (useCallback).
- The request effect has deps [pending, client]. It aborts on cleanup and ignores results of aborted requests.
- A non-CalculatorError rejection becomes an 'unreadable' notice.

== calculator/format.ts ==
- roundResult(value: number): number and formatNumber(value: number): string.

== Test helpers ==
- test/setup.ts (in the vite.config.ts setupFiles) loads the jest-dom matchers and runs afterEach(cleanup).
- No reusable fake client was exported. The fake in calculator/useCalculator.test.tsx is local: a deferred client that records calls and lets the test resolve or reject each one, plus a `settle` helper that wraps act. Part 2's component fake client (results map such as { 'add 12 7': 19 }) is its own to write. It must implement CalculatorClient.calculate(request, {signal}) and reject with a CalculatorError for failures.
- renderHook's reactStrictMode option works for StrictMode wrapping.

== Tooling notes ==
- vite.config.ts uses defineConfig from 'vitest/config', with the /api proxy to http://localhost:8080 and coverage over src/** (excluding main.tsx, test files, test/).
- ESLint uses recommendedTypeChecked with projectService. Prettier is semi:false, singleQuote:true.
- tsconfig.app.json has strict:true and erasableSyntaxOnly, so a class cannot use constructor parameter properties.
- TS imports the contract JSON from ../../../contract/examples.json (resolveJsonModule is on by default with bundler resolution).
- `npm install` printed an 'allow-scripts' warning about pending lifecycle scripts. It does not affect lint, tests or build.
- Frontend part 2: Final frontend/src layout:
- App.tsx (default export; one module-level createCalculatorClient(); renders <Calculator client/>), App.test.tsx, main.tsx (imports ./styles.css), messages.ts, styles.css
- api/client.ts, client.test.ts
- calculator/format.ts, format.test.ts, state.ts, state.test.ts, useCalculator.ts, useCalculator.test.tsx
- components/Calculator.tsx (named export; hook, window keydown effect, notice, h1), Display.tsx, Keypad.tsx, keys.ts (key table plus actionForShortcut), Calculator.test.tsx
- test/setup.ts

For the integration lane:
- The client defaults to baseUrl /api/v1, so the Vite dev proxy (/api to localhost:8080) and a same-origin Go static server both work with no config.
- The frontend does not depend on contract/ at runtime.
- The build output is frontend/dist, which the Dockerfile copies into the Go static directory.
- index.html and the favicon were untouched.

Follow-ups for the walkthrough (not changed):
- The transport-failure alert appears in the flow between the display and the keypad, so the keypad moves down by the banner height when it appears. A retry tap on the same key could land on a different key on small screens.
- Check these in a browser: 24-character values at 320px (the data-size buckets assume digits up to 0.6em wide in a 256px content box), the two-line expression reserve, and the focus ring in both themes.

Steps:
1. Linear history, with no merge commits. Both worktrees must be clean; if either is not, stop and report. Run "git worktree remove" on both worktree paths and remove the empty ~/Documents/Claude Code/fullstack-calculator.worktrees directory (a branch checked out in a worktree cannot be rebased from main). Then, in ~/Documents/Claude Code/fullstack-calculator: "git merge --ff-only backend", "git rebase main frontend", "git checkout main", "git merge --ff-only frontend", "git branch -d backend frontend". Confirm with "git log --oneline --graph" that the history is linear and that every commit message ends with a Co-Authored-By trailer.
2. On main, run every check for both layers. Backend, from backend/: gofmt -l, go vet, staticcheck v0.8.2, go test -race -cover. Frontend, from frontend/: npm ci, lint, format:check, typecheck, test, coverage, build. All must pass before you continue. If a lane's code fails, stop and report it; do not fix other lanes' code.
3. Commit "build: add a multi-stage Dockerfile serving the UI and the API", with .dockerignore, as spec section 5 says (the frontend stage needs contract/). Verify with Docker, which runs on this Mac through Colima: "docker build -t fullstack-calculator .", then "docker run -d --rm -p 18080:8080 --name fc-verify fullstack-calculator". Curl GET /healthz, POST /api/v1/add, POST /api/v1/divide by zero (expect 422) and GET / (expect the HTML with the title Calculator). Then "docker stop fc-verify". Report the image size from "docker images".
4. Commit "build: add a Makefile for common tasks" with the targets from spec section 5, "help" as the default. Run every target except the long-running dev-* ones. Start docker-run detached or in the background and stop it again.
5. Commit "ci: check both layers on GitHub Actions" as spec section 5 says. Look up the current major tag of each action with "gh api repos/actions/<name>/releases/latest --jq .tag_name". Validate the workflow with "go run github.com/rhysd/actionlint/cmd/actionlint@<latest tag>" (look it up the same way on rhysd/actionlint).
6. Commit "docs: add a README with setup, API usage and design decisions", following spec section 6 but leaving out the screenshot (section 2) and the "How this was built" pointer (section 10); the session adds both later with their files. Every command in the README must be one you ran successfully. The API examples are real curl commands with the real responses captured from the running server: start it with "go run ./cmd/server" from backend/ on port 8080, capture, then stop it. The coverage section pastes the real text output of both layers. Also verify the local development path the README describes: the backend on 8080 plus "npm run dev" in frontend/, a curl through the Vite proxy to http://localhost:5173/api/v1/add, and then stop both.

Finally run "git status" (clean) and "git log --oneline" and include both in "checks".
````
