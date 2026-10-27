# How this was built

The assignment allows any AI tooling and asks for the prompts used. This page answers both.

I built this with Claude Code, orchestrated by KVRA Orquesta, the agent setup I built and maintain for my team. My direct input was the assignment text plus a short instruction: use the best engineering practices possible, keep the repository clean, write commits that make sense, no filler.

The orchestrator brought several decisions back to me:

- installing Go and a Docker runtime on my machine;
- the repository name;
- which reviews to run.

The prompts the agents worked from are in [`prompts/`](prompts/), verbatim.

## Steps

1. **Design spec.** Claude Opus 5.5 turned the assignment into a spec before any code existed: the HTTP contract first, then the backend, the frontend, packaging and the README outline. See [`prompts/01-design-spec.md`](prompts/01-design-spec.md).
2. **Plan check.** Claude Sonnet 5.5, in a fresh context, checked the spec. It ran small experiments instead of trusting it: Go's JSON decoder errors, `ServeMux` pattern conflicts, JavaScript number formatting, and the current Vite template. It found 13 issues, all fixed in the spec before the build. For example:
   - a Dockerfile that would not have built;
   - an oversized request that would have been answered 400 instead of 413;
   - floating-point error that would have carried from one calculation into the next.

   See [`prompts/02-plan-check.md`](prompts/02-plan-check.md).

3. **Contract.** Opus wrote [`contract/examples.json`](../contract/examples.json) before either layer existed, so both test suites check against examples neither implementation produced.
4. **Build.** Claude Sonnet 5.5 agents worked in separate git worktrees: one for the backend and two, in sequence, for the frontend. Each committed after its own checks passed. An integration agent then rebased the branches into one linear history and added the Dockerfile, Makefile, CI and README. Every command and API example in the README was run against the real server. See [`prompts/03-build.md`](prompts/03-build.md).
5. **Review.** Three Claude Opus 5.5 reviewers (correctness, robustness, intent) and one Claude Sonnet 5.5 reviewer read the whole repository independently. Each critical or major finding was verified by a separate Opus context before it counted. Result: no critical findings, and four confirmed major ones:
   - the card's width followed its content;
   - long numbers wrapped at 320 px;
   - the client used `AbortSignal.any`, which Safari versions still in use lack;
   - an unreadable request body was answered 500 with its cause lost.
6. **Walkthrough.** An Opus agent opened the production Docker image in a real browser and used the calculator as a person would: light and dark themes, 320 px, keyboard input, and the server stopped mid-session. It found the same layout problems from the user's side, plus the keypad moving vertically as values changed size. See [`prompts/04-review-and-walkthrough.md`](prompts/04-review-and-walkthrough.md).
7. **Fixes.** One agent per defect, again in separate worktrees, each with a test or a real-browser measurement that fails without the fix. The layout fix was measured in headless Chrome at 320, 375 and 1280 px across every display state. A second walkthrough then checked the fixed screens. It found one problem the fix introduced: on a 320×640 screen, the connection notice pushed the bottom key row off the screen. That was fixed and measured the same way. See [`prompts/05-fixes.md`](prompts/05-fixes.md).

The `Co-Authored-By` trailer on each commit names the model that wrote it.
