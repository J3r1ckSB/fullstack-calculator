# 5. Fixes

One lane per confirmed defect, in separate worktrees, followed by an integration lane that rebased them onto `main` and refreshed the README.

Each agent also received Claude Code's own system prompt and my global working rules, which are not reproduced here. Paths under my home directory are shortened to `~`. Everything else is verbatim.

## Layout fix

Agent: Claude Sonnet 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/fix-layout (branch fix-layout). Lane directory: frontend/. Run "npm ci" in frontend/ first.

This repository is a take-home assignment (a full-stack calculator: a Go REST API in backend/, a React + TypeScript keypad UI in frontend/) that a hiring team will read and run. A code review and a walkthrough of the running app found the defect below. The design spec is ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md; read the sections named below. The quality bar is code a senior engineer approves on first read: the smallest correct change, idiomatic, with a test that would fail without the fix.

Rules:
- Work only in your worktree and only on the files your fix needs. Never touch contract/.
- Never edit or delete a test you did not write in this brief unless this brief names it. If an existing test asserts the old, wrong behavior, update only the assertion that the fix changes and say so in "deviations".
- One commit, Conventional Commits style. Use the subject given below, add a body only if the why is not obvious, and end with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Run the checks named below before committing, and commit only when they pass. Stop every process you start.
- Report each check you ran with its real result. "blocked" with the exact error beats an unverified claim.

Read spec section 4, UI and Styles.

The defect was confirmed by three reviewers and by a person-like walkthrough with measurements:
1. The card's width rule never applies. frontend/src/styles.css gives ".calculator" the rule "flex: 0 1 22.5rem", but the body's only flex child is <div id="root"> (index.html), not the card. The card therefore shrink-wraps its content: it is 248px at "0", 291px with 12 digits and about 414px with the transport notice. The keypad widens, narrows and moves sideways on every keypress; a click aimed at a key can land on empty page; and on phones the card does not fill the width.
2. The main value's line height follows its font size, and the card is vertically centered. When the value steps down a size (around the 9th and 13th digit, or on an error message), the keypad moves up or down by 6-16px.
3. At a 320px viewport the main value wraps onto two lines. "888888888888" (12 digits) and "-888888888888888" (16 characters) both wrap; the text box there is 248px, not the 256px the CSS comment assumes, and system-ui tabular digits are about 0.616em wide. The bucket thresholds in frontend/src/components/Display.tsx (sizeFor) and the font sizes in styles.css are sized wrong, and "overflow-wrap: anywhere" on .value lets the number split.

Fix all three so that:
- The card has one width that never depends on its content: 22.5rem on wide screens, and the full width minus 16px gutters on phones. Use "width: min(100%, 22.5rem)" on the card, or make #root the sized flex item; pick the simpler one.
- The main value always renders on exactly one line at a constant height, so the keypad never moves while typing, on results or on math-error messages. Use "white-space: nowrap", a fixed line box, and font sizes that fit the real text box. Prefer sizes that scale with the display's width (a container query on the display, with cqi units capped at today's rem sizes), so the fit holds at every width rather than only at 320px. Keep the length-bucket idea, or replace it if container units make it unnecessary.
- The longest strings fit on one line at 320, 375 and 1280px: "888888888888", "-888888888888888", "-0.00000123456789012346", "-1.7976931348623157e+308" and every math-error message in src/messages.ts.
- Only the transport notice appearing or disappearing may move the keypad. Anchor the card so that a taller card does not shift its own top: for example, align it to the top with a viewport-relative top margin instead of centering it vertically.
- Light and dark themes, focus rings, 48px targets and motion stay as they are.

Verify in a real browser, not jsdom: the walkthrough's measurements came from a real layout, and jsdom does no layout. Google Chrome and Brave are installed in /Applications. Build the app ("npm run build") and serve dist with "npx vite preview --port 4174 --strictPort". Then drive headless Chrome over the DevTools Protocol from a small Node script kept outside the repository; Node 26 has a global WebSocket, so nothing needs installing. Inject states by setting the output element's text and its data attribute, or by dispatching key presses. At widths 320, 375 and 1280, measure:
- the card width;
- the keypad's top position;
- whether the value's height equals one line and scrollWidth <= clientWidth;
- document.documentElement.scrollWidth === innerWidth.
Do this for: empty, 9 digits, 12 digits, 15 digits plus a sign, the four long strings above, and each error message. Put the measurement table in "checks". The card width and the keypad top must be identical across all of these states at each width.

Checks before committing, run from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".
Commit subject: "fix(frontend): keep the calculator a fixed size while values change".
````

## Client signal fix

Agent: Claude Haiku 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/fix-client (branch fix-client). Lane directory: frontend/. Run "npm ci" in frontend/ first.

This repository is a take-home assignment (a full-stack calculator: a Go REST API in backend/, a React + TypeScript keypad UI in frontend/) that a hiring team will read and run. A code review and a walkthrough of the running app found the defect below. The design spec is ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md; read the sections named below. The quality bar is code a senior engineer approves on first read: the smallest correct change, idiomatic, with a test that would fail without the fix.

Rules:
- Work only in your worktree and only on the files your fix needs. Never touch contract/.
- Never edit or delete a test you did not write in this brief unless this brief names it. If an existing test asserts the old, wrong behavior, update only the assertion that the fix changes and say so in "deviations".
- One commit, Conventional Commits style. Use the subject given below, add a body only if the why is not obvious, and end with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Run the checks named below before committing, and commit only when they pass. Stop every process you start.
- Report each check you ran with its real result. "blocked" with the exact error beats an unverified claim.

Read spec section 4, API client.

The defect (confirmed): frontend/src/api/client.ts, in calculate(), calls "AbortSignal.any([signal, timeout.signal])" inside the try block. Vite's default build target includes Safari 16.4-17.3, Chrome 111-115 and Firefox 114-123, none of which has AbortSignal.any. iOS 16 is the last release for the iPhone 8 and X. On those browsers the TypeError is thrown before fetch runs, the catch block reports it as kind "network", and every calculation shows "Can't reach the calculator service" while the service is fine.

Fix:
- Stop using AbortSignal.any. Build one internal AbortController per call.
- If the caller passed a signal, forward it: when it aborts, abort the internal controller with the caller's reason. Register the listener with { once: true } and remove it in "finally". If the caller's signal is already aborted, throw its reason without calling fetch.
- The timeout aborts the same controller. Track that the timeout fired with a local flag, rather than inspecting a second signal, so the catch block can tell a timeout from a caller abort.
- Do this setup before the try block, so a programming error during setup is never mislabeled as a network failure.
- Keep the behavior otherwise identical:
  - a caller abort rethrows the caller's abort error as is;
  - a timeout throws CalculatorError kind "timeout";
  - a CalculatorError from reading the response passes through;
  - anything else that fetch throws is kind "network", with the cause kept.

Tests in frontend/src/api/client.test.ts, added to the existing ones:
- With AbortSignal.any removed for the duration of the test (save it, set it to undefined, restore it in a finally or afterEach), a successful contract example still resolves, and the caller-abort and timeout cases still behave as before.
- A caller signal that is already aborted rejects without calling fetch.
- The abort listener is removed after the call, for example by checking that aborting the caller's signal after a completed call has no effect on anything.

Checks before committing, run from frontend/: "npm run lint", "npm run format:check", "npm run typecheck", "npm test", "npm run build".
Commit subject: "fix(frontend): combine abort signals without AbortSignal.any".
````

## Backend body-read fix

Agent: Claude Haiku 5.5, high effort.

````text
Worktree: ~/Documents/Claude Code/fullstack-calculator.worktrees/fix-backend (branch fix-backend). Lane directory: backend/.

This repository is a take-home assignment (a full-stack calculator: a Go REST API in backend/, a React + TypeScript keypad UI in frontend/) that a hiring team will read and run. A code review and a walkthrough of the running app found the defect below. The design spec is ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md; read the sections named below. The quality bar is code a senior engineer approves on first read: the smallest correct change, idiomatic, with a test that would fail without the fix.

Rules:
- Work only in your worktree and only on the files your fix needs. Never touch contract/.
- Never edit or delete a test you did not write in this brief unless this brief names it. If an existing test asserts the old, wrong behavior, update only the assertion that the fix changes and say so in "deviations".
- One commit, Conventional Commits style. Use the subject given below, add a body only if the why is not obvious, and end with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Run the checks named below before committing, and commit only when they pass. Stop every process you start.
- Report each check you ran with its real result. "blocked" with the exact error beats an unverified claim.

Read spec sections 2.2 and 3.

The defect (confirmed by running the server): backend/internal/httpapi/decode.go, classify(), ends with "return internalError()". Any body-read error that is not one of the JSON or size-cap cases becomes a 500 internal_error, and the original error is discarded. This covers a client that resets mid-body, the 10s ReadTimeout, and malformed chunked framing. So a client's broken request is answered and logged as a server fault at ERROR level, with no cause anywhere; malformed chunked framing returns 500 where a 400 is right. domainError() in calculate.go has the same cause-dropping fallback for an unexpected error from the calculator package.

Fix:
1. In classify, the final fallback means the body could not be read: encoding/json returns reader errors unchanged. Map it to 400 invalid_request with the message "request body could not be read", and keep the underlying error as the cause.
2. Give apiError an unexported cause field, used only for logging and never written to the response.
3. Log the cause where the error response is written, through the handler's slog logger (Options.Logger):
   - for a 400 that carries a cause, at Warn;
   - for any 500 (the domainError fallback, and the recovered-panic path if it goes through the same writer), at Error.
   - Use the attributes method, path and error.
   Keep the access-log line as it is.
4. The domainError fallback stays a 500 internal_error, but it now carries and logs its cause.

Keep the change small and idiomatic. Do not restructure the package.

Tests in backend/internal/httpapi:
- A request whose body reader fails (testing/iotest.ErrReader wrapped as the body, with Content-Type application/json) gets 400 invalid_request "request body could not be read", and the logger received a Warn record whose error attribute holds the reader's error. Capture logs with a slog handler writing to a buffer.
- domainError with an error that matches no domain error returns 500 internal_error and keeps the cause.
- All 30 contract examples still pass.

Add one row to the README's error table? No: the integration lane updates README.md. Do not edit it.

Checks before committing, run from backend/: "gofmt -l ." prints nothing, "go vet ./...", "go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...", "go test -race -cover ./...".
Commit subject: "fix(backend): answer unreadable request bodies with 400 and log the cause".
````

## Integration lane

Agent: Claude Sonnet 5.5, high effort.

````text
You are the integration lane after a round of review fixes on a take-home assignment: a full-stack calculator, with a Go API in backend/ and a React + TypeScript UI in frontend/.

Repository: ~/Documents/Claude Code/fullstack-calculator (branch main, at 978ab47). Three fix branches were each committed in its own worktree under ~/Documents/Claude Code/fullstack-calculator.worktrees: fix-layout, fix-client and fix-backend. They touch disjoint files.

This repository is a take-home assignment (a full-stack calculator: a Go REST API in backend/, a React + TypeScript keypad UI in frontend/) that a hiring team will read and run. A code review and a walkthrough of the running app found the defect below. The design spec is ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md; read the sections named below. The quality bar is code a senior engineer approves on first read: the smallest correct change, idiomatic, with a test that would fail without the fix.

Rules:
- Work only in your worktree and only on the files your fix needs. Never touch contract/.
- Never edit or delete a test you did not write in this brief unless this brief names it. If an existing test asserts the old, wrong behavior, update only the assertion that the fix changes and say so in "deviations".
- One commit, Conventional Commits style. Use the subject given below, add a body only if the why is not obvious, and end with the trailer "Co-Authored-By: Claude <your own model name> <noreply@anthropic.com>" after a blank line. Use the existing git identity; never change git config; never push.
- Run the checks named below before committing, and commit only when they pass. Stop every process you start.
- Report each check you ran with its real result. "blocked" with the exact error beats an unverified claim.

Lane reports, for context: [{"lane":"fix-layout","status":"done","commits":[{"sha":"8f07795","subject":"fix(frontend): keep the calculator a fixed size while values change"}],"deviations":"No test was added, and the brief asks for one that fails without the fix. jsdom does no layout, so a jsdom test of this fix would either pass before the fix or only match strings in styles.css. The real-browser measurement table above is the verification instead. No existing test was edited. The sizeFor thresholds in Display.tsx (8/12/16/20) are unchanged, because container units now do the fitting. Only the comment on sizeFor changed. In styles.css the bucket font sizes are now `min(<old rem size>, N cqi)` with N = 19, 12.5, 9.5, 7.5 and 6.2. The 0.65em-per-character assumption in the comment was checked in Chrome with system-ui, not with other fonts. I put the width rule on `#root` (`width: min(100%, 22.5rem)`) because the percentage on `.calculator` would be circular against a shrink-wrapped #root. I added `margin-top: 8dvh` on #root and `align-items: flex-start` on body. The 8dvh value is a layout choice, not a measurement. Chrome and the preview server were both stopped; the scratch script and Chrome profiles are outside the repo."},{"lane":"fix-client","status":"done","commits":[{"sha":"270f0dc","subject":"fix(frontend): combine abort signals without AbortSignal.any"}],"deviations":"1) Test additions only; no existing test was edited, and \"beforeEach\" was added to the vitest import. 2) The new tests are in a new describe('caller signal') at the end of client.test.ts. The \"without AbortSignal.any\" block saves and restores the method with Reflect.get/Reflect.set, because destructuring AbortSignal.any tripped @typescript-eslint/unbound-method. 3) \"A successful contract example\" is covered by one it.each over the 9 contract 200 examples the client can produce, reusing the file's clientCanProduce helper. 4) One short code comment was added above the controller (\"AbortSignal.any is missing in some browsers Vite still builds for.\") to record the why. 5) Setup order: the already-aborted check runs first, then the controller, timer and listener, all before the try block. 6) Process incident, now resolved: during the scratch check against HEAD client.ts, a failed cp left the original file in place for a moment. I restored the fixed file from a saved copy, confirmed it byte-identical with cmp, and re-ran all checks on the final content before committing. The commit contains only the fixed client.ts and the updated client.test.ts. 7) Nothing pushed; no background processes were started; dist/ is ignored by git."},{"lane":"fix-backend","status":"done","commits":[{"sha":"f66432ac7f5f00b8ef20f353459a452044ab4117","subject":"fix(backend): answer unreadable request bodies with 400 and log the cause"}],"deviations":"1) Commit amended once: the first commit (b4a9e81) lacked the Co-Authored-By trailer, so I amended it to f66432a. The commit is local, unpushed, and mine. Checks were run on the identical tree before the commit.\n2) Logging is done in apiError.write(w, r, logger) and only when the error carries a cause: a 400 with a cause logs at Warn, a 5xx at Error, with attributes method, path and error. The recovered-panic path calls internalError(nil).write(...) and logs nothing extra, because recovery already logs \"panic recovered\" at Error with the stack. This is the brief's conditional \"if it goes through the same writer\", chosen to avoid a duplicate Error record; a cause-less 500 is therefore not logged by write.\n3) To pass the logger into calculate without re-indenting the whole function, calculate(w, r, logger) takes the logger as a parameter, and NewHandler registers it through a small closure. No factory was introduced.\n4) classify's new fallback is the only 400 that carries a cause; the other classify and validate 400s keep their existing messages and carry no cause.\n5) No test covers the Error-level record for the domainError fallback; the brief did not ask for one. The new domainError test checks that the cause is kept (errors.Is) and the 500 body.\n6) Not touched: contract/, README.md, and any existing test assertion (no assertion needed changing).\n7) Not run: nothing was skipped among the named checks. No processes were started.\""}]

Steps:
1. Linear history, with no merge commits. Each worktree must be clean; if one is not, stop and report it.
   - For each worktree: "git worktree remove <path>". Then remove the empty ~/Documents/Claude Code/fullstack-calculator.worktrees directory.
   - In ~/Documents/Claude Code/fullstack-calculator: "git merge --ff-only fix-layout", then "git rebase main fix-client", "git checkout main", "git merge --ff-only fix-client".
   - Then "git rebase main fix-backend", "git checkout main", "git merge --ff-only fix-backend".
   - Then "git branch -d fix-layout fix-client fix-backend".
   - Confirm with "git log --oneline --graph" that the history is linear.
2. Run every check on main.
   - Backend, from backend/: gofmt -l, go vet, staticcheck v0.8.2, go test -race -cover.
   - Frontend, from frontend/: npm ci, lint, format:check, typecheck, test, coverage, build.
   - Run "make lint" and "make test" as well.
   - If anything fails, stop and report it; do not fix the lanes' code.
3. Rebuild and smoke-test the image.
   - Run "docker rm -f fc-walk" (an old container may be running), then "docker build -t fullstack-calculator .", then "docker run -d --rm -p 18080:8080 --name fc-walk fullstack-calculator".
   - Curl /healthz and POST /api/v1/add. Leave this container running: a walkthrough uses it next.
4. Refresh README.md in one commit, subject "docs: refresh the README after the review fixes". Read ~/.claude/docs/voice-without-ai.md first and follow it.
   (a) In the error table's 400 row, add that the body could not be read (for example a connection that drops mid-body).
   (b) Replace both coverage blocks with the real output of the current code, captured from "go test -race -cover ./..." and "npm run coverage". Keep the explanation of why cmd/server is low only if it is still true.
   (c) Rewrite the sentence "Frontend. Vitest leaves files at 100% on every metric out of the table." in plain words. Check the actual reporter config in vite.config.ts and describe what it really does: whether fully covered files are hidden, and why.
   (d) Re-read the whole README against the code and fix any statement the fixes made untrue, and nothing else. Every command you touch must be one you ran.
5. Finally run "git status" (clean) and "git log --oneline -8", and put both in "checks".
````
