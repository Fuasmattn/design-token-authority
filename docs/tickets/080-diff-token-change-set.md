# TICKET-080: `dta diff` tracer: token change set

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** M
**Blocked by:** 039
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 1, 7, 10)

## What to build

`dta diff --tokens-only --base <dir|ref>` reports added, removed and changed tokens per brand and mode with resolved values before and after (alias changes expand to the tokens they affect), as console, markdown or JSON. Base from a git ref is read without checking out. No browser yet.

## Acceptance criteria

- [ ] New internal package `@dta/visual-diff` (public API entry, tests, depends on `@dta/core`)
- [ ] Fixture pair: brand-ab plus a changed copy (one primitive, one alias, one spacing, one added and one removed token)
- [ ] Base as directory or git ref (default: merge base with the default branch); clear error outside a git repo
- [ ] Snapshot scenario `diff-tokens` (markdown) recorded with `pnpm snapshot:record` and reviewed
- [ ] All gates pass, and the GitHub run is green
