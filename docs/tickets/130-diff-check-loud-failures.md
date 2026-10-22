# TICKET-130: `dta diff --check` and loud failures

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decision 7)

## What to build

- **`dta diff --check`** verifies, without rendering: the `diff` section, a browser (`playwright-core` and Chromium, or `DTA_BROWSER_PATH`), enough git history for the merge base, the base branch, and that the stories source lists at least one story. It prints one line per check and one fix per problem; exit 1 when a check fails.
- **No silent fallback in CI:** with `CI=true`, a missing browser is an error (today `BrowserUnavailableError` in `packages/cli/src/io/browser.ts` falls back to token changes only). Locally the fallback stays, with a visible warning.
- **Errors name the fix:** every `dta diff` error says what is missing, the concrete fix (a config key, a command) and links to the matching section on the website.

## Acceptance criteria

- [ ] Each check has a test for pass and fail, and each failure a hint
- [ ] `CI=true` without a browser exits with an error; locally it warns and continues
- [ ] Every error message in `diff.ts` and `packages/cli/src/io/*` used by diff has a fix and a docs link (a test lists them)
- [ ] Docs: the diff guide starts troubleshooting with `dta diff --check`
- [ ] All gates pass, and the GitHub run is green
