# TICKET-130: `dta diff --check` and loud failures

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** done (2026-10-24)
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decision 7)

## What to build

- **`dta diff --check`** verifies, without rendering: the `diff` section, a browser (`playwright-core` and Chromium, or `DTA_BROWSER_PATH`), enough git history for the merge base, the base branch, and that the stories source lists at least one story. It prints one line per check and one fix per problem; exit 1 when a check fails.
- **No silent fallback in CI:** with `CI=true`, a missing browser is an error (today `BrowserUnavailableError` in `packages/cli/src/io/browser.ts` falls back to token changes only). Locally the fallback stays, with a visible warning.
- **Errors name the fix:** every `dta diff` error says what is missing, the concrete fix (a config key, a command) and links to the matching section on the website.

## Acceptance criteria

- [x] Each check has a test for pass and fail, and each failure a hint
- [x] `CI=true` without a browser exits with an error; locally it warns and continues
- [x] Every error message in `diff.ts` and `packages/cli/src/io/*` used by diff has a fix and a docs link (a test lists them)
- [x] Docs: the diff guide starts troubleshooting with `dta diff --check`
- [x] All gates pass, and the GitHub run is green

## Notes

- `packages/cli/src/diff-problems.ts`: every way `dta diff` stops, as message, fix and docs page (with the section named). `dta diff` reports failures only through it; a test checks each problem has a fix and an existing docs page and section, and that `diff.ts` writes no failure by hand.
- Docs links point at the page sources in the repository until the website has a domain (TICKET-075): one constant, `DOCS_ROOT`.
- `dta diff --check`: config, browser (DTA_BROWSER_PATH, or playwright-core and its Chromium; nothing is started), git history (repository, not shallow), base (default branch and merge base, or `--base` / `diff.base`), stories (the built output lists at least one). One line per check, the fix and docs under each failure, exit 1 when one fails.
- With `CI` set (not `false`/`0`), a missing browser stops `dta diff` with the fix; locally it warns and shows token changes only.
- Docs: the diff guide's Troubleshooting starts with `dta diff --check` (with a table of the checks).
- **Review (fixed):** `dta diff --check` looks for playwright-core from the project first (what `dta init --diff` installs), as init does.

## Review (2026-10-24)

- `dta diff --check` has a pass and a fail test per check, each failure with `Fix:` and `Docs:`; `CI=true` without a browser exits 1, locally it warns and continues (also run by hand); `diff-problems.test.ts` lists every problem with its fix and docs page; the diff guide's troubleshooting starts with `--check`. CI green on 3bdd228.
- Follow-ups in TICKET-148: docs links to the website instead of GitHub sources, the no-browser fix said once.
