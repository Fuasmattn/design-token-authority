# TICKET-088: Retire `test:visual`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** XS
**Blocked by:** 082
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 13)

## What to build

The v1 Playwright suite and every pointer to it are gone; `dta diff` is the only visual tool.

## Acceptance criteria

- [x] `test/visual/`, `test:visual` and `test:visual:update` deleted; root `@playwright/test` removed if unused
- [x] `dta test:visual` no longer registered (CLI tests updated); migration note says to use `dta diff`
- [x] 039 parity row of `test:visual`, CLI parity spec decision 10 and CLAUDE.md updated
- [x] All gates pass, and the GitHub run is green

## Notes

- Deleted `test/visual/` (spec, Playwright config, fixtures, baselines), the root scripts `test:visual` and `test:visual:update`, the root `@playwright/test` dev dependency (nothing else used it; `dta diff` uses `playwright-core` from `@dta/cli`) and the two `test/visual/` lines in `.gitignore`.
- `dta test:visual` is no longer registered: it now fails as an unknown command (exit 1); `cli.test.ts` checks that. The `test:visual` banner style in `ui.ts` is gone too.
- Migration note (`docs/migration/v1-to-v2.md`), the 039 parity row, CLI parity spec decision 10 and CLAUDE.md updated.
