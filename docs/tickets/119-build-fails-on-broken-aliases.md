# TICKET-119: `dta build` must not write broken CSS for dangling or circular aliases

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** open

## Problem

Found with the "Example with problems" fixture (TICKET-113, 2026-10-19): `dta build` on `test/fixtures/brand-ab-problems` writes `--Muted: var(--Muted);` for a circular alias and leaves `{Colors.Foundation.Orange.550}` unresolved in the output for a dangling one, with only a warning and exit code 0. The files look fine and break in the browser. The new build snapshot records this behaviour as it is.

## What to build

Dangling and circular aliases are build errors: `dta build` reports them as diagnostics (same wording as `dta lint`), writes no broken declarations, and exits non-zero; the playground's Outputs tab shows the errors instead of files (it already does for build errors). Decide whether the build stops entirely or skips only the affected tokens with an error exit; record it.

## Acceptance criteria

- [ ] `dta build` on `brand-ab-problems` exits non-zero with the two alias errors; no `var(--X)` self-references or `{…}` left in any output
- [ ] Build snapshot of `brand-ab-problems` re-recorded by name; all other snapshots unchanged
- [ ] Playground Outputs tab shows the errors for the example with problems (e2e)
- [ ] All gates pass, and the GitHub run is green
