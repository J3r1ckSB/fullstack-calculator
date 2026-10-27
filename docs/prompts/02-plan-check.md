# 2. Plan check

A second model, in a fresh context and before any code existed, checked the spec. It ran small experiments rather than reasoning from memory. It returned 13 issues, and all were folded into the spec.

Each agent also received Claude Code's own system prompt and my global working rules, which are not reproduced here. Paths under my home directory are shortened to `~`. Everything else is verbatim.

## Plan check

Agent: Claude Sonnet 5.5, xhigh effort, read-only.

````text
Plan-check mode. Give a fresh, independent read of a design spec before a team of coding agents builds it.

## Context
A candidate is submitting a take-home assignment to a fintech's hiring team. The assignment: a full-stack calculator with a React frontend (TypeScript preferred) and a Go backend REST microservice. Requirements:
- Operations: add, subtract, multiply, divide; optionally exponentiation, square root and percentage.
- Frontend: input validation, error handling, responsive design.
- Backend: validation, edge cases (division by zero, invalid data), JSON responses.
- Unit tests and a coverage report for both layers.
- A README with setup, how to run, API examples and design decisions.
- An optional Dockerfile.
- The company suggests about 2–4 hours of work, says to prioritize correctness, clarity and maintainability over extra features, and allows any AI tooling.

The candidate asked for a very clean result: best engineering practices, a clean repository, meaningful commits, zero filler.

The full spec is at `~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md`. Read all of it.

## Build plan
1. A setup agent creates the git repo, the root files and the contract file `contract/examples.json`, transcribed from spec §2.3. It makes two commits, then creates two git worktrees (`backend` and `frontend` branches).
2. Two parallel lanes, each committing step by step in its own worktree:
   - Backend lane: one agent, three commits (domain, HTTP API with contract test, entrypoint).
   - Frontend lane: two agents in sequence. The first does the scaffold, API client, formatting, reducer and hook. The second does the UI, keyboard input and integration tests.
3. An integration agent fast-forwards and rebases both branches into a linear `main`, then adds the Dockerfile, Makefile, CI and README. It verifies `docker build` and run using Colima on this Mac.
4. After the build, a multi-reviewer code review and a visual walkthrough of the UI, then fixes.

## Environment
Go 1.27.3 and Node 26.5.1 are installed. You may run small experiments in `/private/tmp/claude-501/-Users-j3r1ck-Documents-Claude-Code/d076d1e2-bd32-4429-b8a8-412327240a78/scratchpad/plancheck/`; create it and run code there with `go run` or `node`. Prefer checking a behavior over reasoning about it, especially:
- Go 1.27's `encoding/json` v1 error types and values for the decode cases in spec §3: an empty body, `[1,2]`, `{"a":"1"}`, `1e400`, an unknown field, trailing data via `dec.Token()`, and `UnmarshalTypeError.Field` and `.Value` contents.
- Whether the Go 1.22+ `ServeMux` pattern set in spec §3 registers without a conflict panic and routes each contract example as intended (`POST /api/v1/{operation}`, `/api/v1/{operation}`, `GET /healthz`, `/api/`, `/`).
- `math.Pow`, `math.Sqrt` and -0 behaviors the spec relies on, and the percentage overflow fallback.
- The JavaScript `formatNumber` expectations in spec §4.

## What to check
Look for material problems only:
- **Correctness errors in the contract or the specified behaviors.** Wrong expected values, messages that cannot be produced as specified, ordering bugs in the handler checks, reducer rules that contradict each other or leave a dead state, keyboard double-firing.
- **Hidden gaps** that would make a senior reviewer mark the submission down.
- **Over-engineering** that hurts the "2–4 hours, clarity over features" brief. Name what to cut and why.
- **Build-plan risks.** Worktree and rebase pitfalls, a lane that cannot verify its commits (for example, the frontend lane's tests import `../../../contract/examples.json` from a worktree), and dependencies between lanes the plan misses.
- **Anything a hiring reviewer at a Go and React fintech would expect that is missing.**

Skip style nits and personal preferences.

## Output
Reply with:
- A verdict line: `ready`, `ready-with-fixes` or `not-ready`.
- A numbered list of material issues. For each:
  - severity (critical / major / minor-but-cheap);
  - the spec section;
  - what is wrong, with evidence (your experiment's output where you ran one);
  - the concrete fix as a replacement rule or value.

Keep it under about 1,200 words. Do not edit the spec or create any file outside the scratch directory.
````
