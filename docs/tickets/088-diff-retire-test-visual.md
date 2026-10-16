# TICKET-088: Retire `test:visual`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** XS
**Blocked by:** 082
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 13)

## What to build

The v1 Playwright suite and every pointer to it are gone; `dta diff` is the only visual tool.

## Acceptance criteria

- [ ] `test/visual/`, `test:visual` and `test:visual:update` deleted; root `@playwright/test` removed if unused
- [ ] `dta test:visual` no longer registered (CLI tests updated); migration note says to use `dta diff`
- [ ] 039 parity row of `test:visual`, CLI parity spec decision 10 and CLAUDE.md updated
- [ ] All gates pass, and the GitHub run is green
