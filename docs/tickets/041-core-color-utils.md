# TICKET-041: Core: color utilities

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033
**Status:** ready-for-agent
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Move color parsing and comparison into `@dta/core` (public API), reusing the legacy tests as the behavioural reference. Contrast ratio currently lives in legacy `linter.ts`; it moves here too so lint and build can share it.

## Acceptance Criteria

- [ ] `parseColor`, `toHex`, `colorsApproximatelyEqual` behave as legacy `color.ts` for every case in `src/color.test.ts` (ported through the public API)
- [ ] `contrastRatio` behaves as legacy `linter.ts` (WCAG relative luminance); covered by tests including black/white = 21 and identical colors = 1
- [ ] Invalid colors do not throw; they return a clear failure result the caller can turn into a diagnostic
- [ ] 039 parity table: `color.ts` row updated; matching legacy file is deleted only if nothing in legacy still imports it (otherwise noted in 039)
- [ ] All gates pass
