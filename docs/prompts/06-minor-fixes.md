# 6. Minor fixes

The review's unverified minor findings and the walkthrough's small ones, one lane per area in separate worktrees, followed by an integration lane that rebased them onto `main`. The styles lane stopped and reported that its contrast target could not be met against the equals key's own fill; the same brief was then given to a stronger model, which kept the target that can be met, against the card surface the ring sits on.

Each agent also received Claude Code's own system prompt and my global working rules, which are not reproduced here. Paths under my home directory are shortened to `~`, and the session's temporary directory to `<scratch>`. Everything else is verbatim.

## Static files

Agent: Claude Haiku 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/minor-static (branch minor-static). Lane directory: backend/.

This repository is a take-home assignment that a hiring team will read and run: a full-stack calculator with a Go REST API in backend/ and a React + TypeScript keypad UI in frontend/. A review flagged the minor issue(s) below. The fix is already decided; apply it exactly and keep the change as small as the code allows.

Rules:
- First confirm each issue against the code. If one is not real, change nothing for it and report status "not-real" with the evidence.
- Work only in your worktree, and only on the files named below. Never touch contract/ or README.md.
- Never edit or delete a test you did not write in this brief, unless this brief names it.
- Commits use the Conventional Commits subjects given below, and you run the checks named below before each commit. End every commit message with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Stop every process you start. Report each check with its real result.

Issue: backend/internal/httpapi/handler.go serves STATIC_DIR with a bare http.FileServer(http.Dir(dir)). Any directory without an index.html therefore returns an auto-generated HTML listing of its files; in the shipped image, GET /assets/ lists the built bundles.

Fix: wrap the http.FileSystem passed to http.FileServer so that opening a directory with no index.html fails with fs.ErrNotExist. The file server then answers 404. Directories that do have an index.html (the root "/") keep working, and so do plain files. Keep it a small unexported type in handler.go, with a one-line comment saying why.

Test, in the package's existing static-serving test file (add tests; do not change the existing ones). With a temporary STATIC_DIR containing index.html and assets/app.js:
- GET /assets/ returns 404 and its body does not contain "app.js";
- GET /assets/app.js returns 200;
- GET / still serves index.html.

Checks before committing, from backend/: "gofmt -l ." prints nothing, "go vet ./...", "go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...", "go test -race -cover ./...".
Commit subject: "fix(backend): stop listing directories of the static files".
````

## Client and Node versions

Agent: Claude Haiku 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/minor-client (branch minor-client). Lane directory: frontend/. Run "npm ci" in frontend/ first.

This repository is a take-home assignment that a hiring team will read and run: a full-stack calculator with a Go REST API in backend/ and a React + TypeScript keypad UI in frontend/. A review flagged the minor issue(s) below. The fix is already decided; apply it exactly and keep the change as small as the code allows.

Rules:
- First confirm each issue against the code. If one is not real, change nothing for it and report status "not-real" with the evidence.
- Work only in your worktree, and only on the files named below. Never touch contract/ or README.md.
- Never edit or delete a test you did not write in this brief, unless this brief names it.
- Commits use the Conventional Commits subjects given below, and you run the checks named below before each commit. End every commit message with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Stop every process you start. Report each check with its real result.

There are two issues, with one commit each.

Issue 1: frontend/src/api/client.ts, readResult. Any status of 500 or above becomes kind "server" ("The calculator service had a problem"). In the documented development setup the Vite proxy sits in front of the API. When the backend is down, the proxy answers 502 with an empty text/plain body, so the person is told the service had a problem instead of "Can't reach the calculator service. Check that it is running, then try again."
Fix: a 502, 503 or 504 response whose body is not the API's JSON error envelope was produced by a proxy or gateway in front of the service, which means the service could not be reached. Throw CalculatorError kind "network", keeping the status on the error. Any other 5xx stays kind "server", and so does a 502-504 that carries the API's own error envelope. Add a short why-comment.
Tests, added to frontend/src/api/client.test.ts:
- 502 with an empty text/plain body → kind "network", status 502;
- 504 with an HTML body → kind "network";
- 503 with a well-formed {"error":{"code":"internal_error","message":"internal server error"}} JSON body → kind "server";
- the existing test for a 500 with a non-JSON body stays green unchanged.
Commit subject: "fix(frontend): treat a gateway error as an unreachable service".

Issue 2: frontend/package.json "engines.node" is "^20.19.0 || >=22.12.0", which may claim support for Node versions the installed toolchain rejects.
Fix: read the "engines.node" field of each installed toolchain package that declares one: node_modules/vite, vitest, @vitest/coverage-v8, jsdom, @vitejs/plugin-react, eslint and typescript-eslint. Set the project's field to the narrowest range that satisfies all of them, and put each package's range in "checks". If the current value already equals that intersection, the issue is not real: change nothing for it and say so.
Commit subject: "chore(frontend): declare the Node versions the toolchain supports".

Checks before each commit, from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".
````

## Styles

Agent: Claude Haiku 5.5, high effort; then Claude Sonnet 5.5, high effort, with the same brief.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/minor-styles (branch minor-styles). Lane directory: frontend/. Run "npm ci" in frontend/ first.

This repository is a take-home assignment that a hiring team will read and run: a full-stack calculator with a Go REST API in backend/ and a React + TypeScript keypad UI in frontend/. A review flagged the minor issue(s) below. The fix is already decided; apply it exactly and keep the change as small as the code allows.

Rules:
- First confirm each issue against the code. If one is not real, change nothing for it and report status "not-real" with the evidence.
- Work only in your worktree, and only on the files named below. Never touch contract/ or README.md.
- Never edit or delete a test you did not write in this brief, unless this brief names it.
- Commits use the Conventional Commits subjects given below, and you run the checks named below before each commit. End every commit message with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Stop every process you start. Report each check with its real result.

There are two issues in frontend/src/styles.css, with one commit each.

Issue 1: the keyboard focus ring on the "=" key is the same color as the key itself (".key:focus-visible" uses var(--focus); the equals key's fill is the same blue in light mode, #1d4ed8, and nearly the same in dark mode). Only the 2px gap shows, so it reads as a thicker border, not a focus ring. The ring on the other keys is clear.
Fix: give the equals key's focus outline a color that contrasts at least 3:1 with both the equals key's fill and the card surface, in both themes. Use the existing text color custom property, var(--text), unless your contrast computation shows it fails, in which case report the numbers and pick another existing token. Compute the ratios with a short script (an example is <scratch>/contrast.mjs) and put them in "checks".
Commit subject: "fix(frontend): make the focus ring visible on the equals key".

Issue 2: at a 320px viewport, the error hint "Enter a number or press AC to start over" wraps with the single word "over" on its second line.
Fix: add "text-wrap: balance" to the expression line rule (.expression), so wrapped lines come out even. Browsers without support simply wrap as before.
Verify in headless Google Chrome (/Applications/Google Chrome.app) at 320x640 against "npx vite preview --port 4176 --strictPort" after "npm run build": set the expression element's text to the hint, then measure the line boxes, for example with a Range over its text node and getClientRects. Confirm that each line holds more than one word. <scratch>/heights/h.mjs shows how to drive Chrome over the DevTools Protocol with Node's built-in WebSocket. Keep your script outside the repository.
Commit subject: "fix(frontend): balance the wrapped expression line".

Checks before each commit, from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".
````

## Minus sign

Agent: Claude Haiku 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/minor-minus (branch minor-minus). Lane directory: frontend/. Run "npm ci" in frontend/ first.

This repository is a take-home assignment that a hiring team will read and run: a full-stack calculator with a Go REST API in backend/ and a React + TypeScript keypad UI in frontend/. A review flagged the minor issue(s) below. The fix is already decided; apply it exactly and keep the change as small as the code allows.

Rules:
- First confirm each issue against the code. If one is not real, change nothing for it and report status "not-real" with the evidence.
- Work only in your worktree, and only on the files named below. Never touch contract/ or README.md.
- Never edit or delete a test you did not write in this brief, unless this brief names it.
- Commits use the Conventional Commits subjects given below, and you run the checks named below before each commit. End every commit message with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Stop every process you start. Report each check with its real result.

Issue: negative numbers on screen use the ASCII hyphen-minus ("-12", "1.2e-8"), while the subtract key and the expression line's operator use the minus sign U+2212 ("−"). A typed negative such as "-123456789012345" looks inconsistent next to the "−" key.

Fix:
- Add one small exported function to frontend/src/calculator/format.ts that returns a number's on-screen text with every ASCII hyphen-minus replaced by U+2212. Name it for what it does, for example toDisplayMinus.
- The view selectors in frontend/src/calculator/state.ts apply it to every number they put on screen: the typed operand text, formatted results, the accumulator, the numbers in the expression line, and the √(x) label. They do not apply it to catalog messages or hints.
- Values sent to the API and values stored in state stay unchanged (ASCII, numeric). Only the view text changes.
- Add tests for the new function in format.test.ts: "-12" → "−12", "1.2e-8" → "1.2e−8", "5" → "5".
- Add a state.test.ts case showing that ± on a typed number displays "−".

Existing assertions that expect a hyphen-minus in displayed text will now fail. You may update exactly those assertions, and nothing else in them, in frontend/src/calculator/state.test.ts, frontend/src/calculator/useCalculator.test.tsx and frontend/src/components/Calculator.test.tsx. List each changed assertion in "deviations". If a test types a hyphen through the keyboard, its input stays the same; only the expected displayed text changes.

Checks before committing, from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".
Commit subject: "fix(frontend): show negative numbers with a true minus sign".
````

## Integration lane

Agent: Claude Haiku 5.5, high effort.

````text
You are the integration lane after a round of minor fixes on a take-home assignment: a full-stack calculator with a Go API in backend/ and a React + TypeScript UI in frontend/.

Repository: ~/Documents/Claude Code/fullstack-calculator (branch main). Fix branches, each in its own worktree under ~/Documents/Claude Code/fullstack-calculator.worktrees: minor-static, minor-client, minor-styles, minor-minus. Some may have no commits if their issue was not real.

This repository is a take-home assignment that a hiring team will read and run: a full-stack calculator with a Go REST API in backend/ and a React + TypeScript keypad UI in frontend/. A review flagged the minor issue(s) below. The fix is already decided; apply it exactly and keep the change as small as the code allows.

Rules:
- First confirm each issue against the code. If one is not real, change nothing for it and report status "not-real" with the evidence.
- Work only in your worktree, and only on the files named below. Never touch contract/ or README.md.
- Never edit or delete a test you did not write in this brief, unless this brief names it.
- Commits use the Conventional Commits subjects given below, and you run the checks named below before each commit. End every commit message with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Stop every process you start. Report each check with its real result.

Lane reports: [{"lane":"minor-static","status":"done","commits":[{"sha":"7e995aa4490d2481417a533e66e8ef738f1f0494","subject":"fix(backend): stop listing directories of the static files"}]},{"lane":"minor-client","status":"done","commits":[{"sha":"12b3ef1","subject":"fix(frontend): treat a gateway error as an unreachable service"},{"sha":"7b5e81b","subject":"chore(frontend): declare the Node versions the toolchain supports"}]},{"lane":"minor-styles","status":"done","commits":[{"sha":"8e252d3","subject":"fix(frontend): balance the wrapped expression line"},{"sha":"18918f2","subject":"fix(frontend): make the focus ring visible on the equals key"}]},{"lane":"minor-minus","status":"done","commits":[{"sha":"5b045c2","subject":"fix(frontend): show negative numbers with a true minus sign"}]}]

Steps:
1. Every worktree must be clean; if one is not, stop and report it.
   - "git worktree remove" each worktree, then remove the empty ~/Documents/Claude Code/fullstack-calculator.worktrees directory.
   - For each branch in this order (minor-static, minor-client, minor-styles, minor-minus): "git rebase main <branch>", then "git checkout main", then "git merge --ff-only <branch>".
   - Then delete the four branches with "git branch -d".
   - Confirm with "git log --oneline --graph -12" that the history is linear.
   - minor-client, minor-styles and minor-minus all touch frontend/. If a rebase stops on a conflict, abort it, stop and report; do not resolve it yourself.
2. On main, run "make lint" and "make test", and check that both exit 0 ("echo $?" right after each, not through a pipe). Then run "npm run build" in frontend/. If anything fails, stop and report it.
3. Rebuild the image with "docker build -t fullstack-calculator ." from ~/Documents/Claude Code/fullstack-calculator. Then replace the user's running container: "docker rm -f fullstack-calculator", then "docker run -d --rm -p 8080:8080 --name fullstack-calculator fullstack-calculator". Curl http://localhost:8080/healthz and POST /api/v1/add (Content-Type: application/json, {"a":2,"b":3}). Also curl http://localhost:8080/assets/ and expect 404 if minor-static landed. Leave this container running: the user is testing with it.
4. Run "git status" (clean) and "git log --oneline -8", and put both in "checks".
````
