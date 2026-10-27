# 4. Review and walkthrough

## Code review

Four reviewers read the whole repository independently: Claude Opus 5.5 at xhigh effort with a correctness, a robustness and an intent lens, and Claude Sonnet 5.5 at xhigh effort with an open lens. Each critical or major finding was then verified by a separate Claude Opus 5.5 context before it counted. The reviewers' own prompts come from the review workflow in my setup. The part written for this project is the context below.

````text
Take-home assignment for a fintech hiring process (Sezzle), to be read and run by their engineers. The assignment, verbatim in substance: build a full-stack calculator with a React frontend (TypeScript preferred) and a backend microservice (Go preferred); add, subtract, multiply, divide, optionally exponentiation, square root and percentage; an intuitive UI with input validation, error handling and responsive design; a REST API that validates input, handles edge cases (division by zero, invalid data) and returns JSON; clean, idiomatic code; unit tests for both layers and a coverage report; a README with setup, how to run each layer, API examples and design decisions; optionally a Dockerfile running both. Spend about 2-4 hours, and prioritize correctness, clarity and maintainability over extra features. [Here the original quoted my own two-line instruction, in Spanish. In short: the best engineering practices possible, a clean repository, commits that make sense, no filler, and a very good, clean result.] What was built: the design spec at ~/.claude/task-plans/fullstack-calculator/2026-10-26-spec.md (read it: it is the intended behavior). It covers a frozen HTTP contract in contract/examples.json (30 examples) that both test suites run against; a Go standard-library API (POST /api/v1/{operation}, 400 for a malformed request, 422 for math errors, a 4 KiB body cap, a JSON error envelope, slog logging, graceful shutdown, optional static serving of the built UI); and a React keypad calculator (immediate left-to-right evaluation, results rounded to 15 significant digits, a pure reducer plus a hook running requests, a typed API client with error kinds that keep their cause, keyboard support, a copy catalog, light and dark themes). It also covers a distroless multi-stage Dockerfile, a Makefile, GitHub Actions CI and the README. The whole repository is new: review every file in the range as a hiring reviewer would, including whether the README's claims and commands match the code, and whether the git history (16 commits, Conventional Commits) is clean. Constraints: no invented features beyond the spec; visible UI defects count as major; README text must be factual, with no filler or AI-sounding prose.
````

Robustness focus added for this run:

````text
Within the robustness lens, also check the HTTP boundary defensively: request size and timeouts, static file serving, response headers, and error responses that could leak internals.
````

Each agent also received Claude Code's own system prompt and my global working rules, which are not reproduced here. Paths under my home directory are shortened to `~`. Everything else is verbatim.

## Walkthrough

Agent: Claude Opus 5.5, medium effort, driving a real browser.

````text
Walk through a web calculator as a person would, and report every defect someone would see. This is an acceptance check before a candidate submits a take-home assignment to a hiring team, who will open this app and click around. Do not edit any files.

## The app
A full-stack calculator: a React + TypeScript keypad UI that sends each arithmetic step to a Go REST API. It is running from its production Docker image at http://localhost:18080 (container name `fc-walk`). The source is at `~/Documents/Claude Code/fullstack-calculator` (read `frontend/src` if you need to understand intended behavior).

Intended behavior:
- **Keypad layout**, 4 columns:

  ```
  AC ⌫ ± ÷
  √ xʸ % ×
  7 8 9 −
  4 5 6 +
  1 2 3 =
  0 . =
  ```

  0 spans two columns, and `=` is one button spanning the last two rows.
- **Evaluation**: immediate, left to right, like a basic calculator: `2 + 3 × 4 =` gives 20.
- **Display**:
  - An expression line shows the running expression: `12 ×` while waiting, `12 × 4 =` after equals, `15 % of 80 =` for percentage, and `√(16)` after a square root.
  - Results are rounded to 15 significant digits. Entry is limited to 15 digits.
  - The main value must never clip or overflow, even at 24 characters. The expression line wraps rather than clips.
- **Math errors** (for example `1 ÷ 0 =` or `√` of a negative number) show a plain-language message in the display. The expression line shows a hint, and a digit starts over.
- **Transport failures** (server down) show an alert banner telling the person what to do. The previous state is kept, so pressing the key again retries.
- **Keyboard**: digits, `.` or `,`, `+ - * / ^ %`, Enter or `=`, Backspace, and Escape or Delete for AC. Shortcuts with Ctrl, Cmd or Alt are left alone.
- **Busy indicator**: appears only if a request takes longer than 250 ms.
- **Themes**: light and dark follow the OS setting.

## How to walk
Use the built-in browser tools (`mcp__Claude_Browser__*`; load them in one ToolSearch call with the query `mcp__Claude_Browser__` and `max_results` 64).
- Open http://localhost:18080 with `preview_start` (url).
- Look at screenshots yourself; do not trust the DOM alone.

Walk all of the following:
1. **Layouts.** The first screen, in light and in dark (`resize_window` `colorScheme`), at desktop size, the mobile preset (375 px), and a custom 320×640. At 320 px, check for horizontal scroll with `javascript_tool`: compare `document.documentElement.scrollWidth` to `innerWidth`.
2. **Click flows**, checking the display and the expression line after each step:
   - `1 2 + 7 =`
   - `2 + 3 × 4 =`
   - `0 . 1 + 0 . 2 =`, then `− 0 . 3 =` (should show 0)
   - `2 xʸ 1 0 =`
   - `1 6 √`
   - `9 + 1 6 √ =`
   - `1 5 % 8 0 =`
   - ± on a typed number and on a result
   - backspace
   - a second decimal point (ignored)
   - 15+ digits (capped)
   - `1 ÷ 3 =`
   - `9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 × 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 =` (a long result: check that nothing clips, at 320 px too)
   - a tiny result such as `0 . 0 0 0 0 0 1 2 3 4 5 6 7 8 9 ÷ 1 0 0 =`
   - changing the operator before typing the second number
   - pressing `=` twice
3. **Errors**:
   - `1 ÷ 0 =`, then type a digit.
   - `9 ± √`.
   - `1 0 xʸ 4 0 0 =` (out of range).
   - `0 xʸ 1 ± =`.
4. **Keyboard**: type `12+7` then Enter; Escape; Backspace. Click a digit button, then press Enter: the digit must not be entered twice. Also type `/` and confirm it does not open the browser's find bar.
5. **Server down**:
   - Run `docker stop fc-walk` (Bash is allowed for exactly this), press `2 + 3 =`, and look at the banner and the display.
   - Restart the server with `docker run -d --rm -p 18080:8080 --name fc-walk fullstack-calculator`, wait a second, press `=` again and confirm the retry works.
   - Leave the container running when you finish.
6. **Console and network**: check for console errors and failed requests (`read_console_messages`, `read_network_requests`).
7. **Polish**: focus rings visible when tabbing through keys, sensible tab order, readable contrast in both themes, alignment, and nothing that looks unfinished or templated.

## What to report
Report only what a person would see or hit:
- clipped, overlapping or illegible text;
- wrong or confusing results or expression lines;
- internal codes or jargon on screen;
- states with no clear next action;
- keys that misfire;
- layout breaks at small widths;
- dark-mode problems;
- console errors.

For each finding give:
- severity: major for any visible defect or wrong behavior, minor only for pure polish;
- where it happens (screen size, theme, the exact key sequence);
- what you saw versus what was expected;
- the screenshot moment it comes from;
- the likely source file, if you looked.

End with a list of what you walked that was fine, so the coverage is visible, and an overall one-line verdict. Before you finish, reset the browser viewport to the desktop preset.
````

## Re-walk after the fixes

Agent: Claude Opus 5.5, medium effort, driving a real browser.

````text
Re-walk the screens of a web calculator affected by a layout fix, as a person would, and report anything someone would see. Do not edit files.

## The app
A React keypad calculator served with its Go API from a Docker container at http://localhost:18080 (container `fc-walk`). The source is at `~/Documents/Claude Code/fullstack-calculator`.

## What was fixed
An earlier walkthrough found three problems:
1. The card's width followed its content (248 px at "0", wider with long numbers or the notice), so keys moved under the pointer.
2. The keypad moved up or down when the main value changed font size.
3. At 320 px, 12-digit numbers wrapped onto two lines.

The fix gives the card a fixed width: 22.5rem, or the full width minus 16 px gutters on phones. It also anchors the card near the top, keeps the value on one line at a constant height, and sizes the value font with container query units.

## Walk
Use the built-in browser tools (`mcp__Claude_Browser__*`; load them in one ToolSearch call with the query `mcp__Claude_Browser__` and `max_results` 64). Open http://localhost:18080 with `preview_start` (url). Look at the screenshots yourself. Measure with `javascript_tool`: the card's bounding rect, the keypad's top, the value's height, and its scrollWidth against its clientWidth.

Run every check below at widths 320×640, 375 (the mobile preset) and the desktop preset, in light mode, and repeat the 320 pass in dark mode:
- **Initial `0`.** Record the card width and the keypad top.
- **Long values.** Type `888888888888` (12 digits), then AC. Type 15 digits and press ±. Run `999999999999999 × 999999999999999 =`. Run `0.00000123456789 ÷ 100 =`, or any sequence that yields a long tiny result. For each, confirm the value is on one line, nothing is clipped, and the card width and keypad top did not change.
- **Math errors.** Run `1 ÷ 0 =`, `9 ± √` and `1 0 xʸ 4 0 0 =`. Confirm the message fits on one line, the hint is readable, and the card and keypad did not move.
- **Server down.**
  - Run `docker stop fc-walk` (Bash is allowed for exactly this), press `2 + 3 =`, and check the notice banner. The card width must stay the same; the keypad may move down to make room for the banner, and that is the one allowed movement.
  - Restart with `docker run -d --rm -p 18080:8080 --name fc-walk fullstack-calculator`, wait a second, press `=`, and confirm 5.
  - Leave the container running.
- **Look and feel.** Judge the page as a whole at desktop size. Is the card's vertical position sensible (not stuck to the top edge, not odd-looking)? Check focus rings, both themes, and anything that looks unfinished.

## Report
- Findings only for what a person would see: clipping, wrapping, movement, overlap, illegible text, odd placement.
- Each finding gets a severity (major for any visible defect, minor for pure polish), the width, theme and key sequence, and what you saw versus what was expected.
- Then a short table of the card width and keypad top per width across the states you walked.
- Then a one-line verdict.

Before you finish, reset the viewport to the desktop preset.
````
