# TICKET-041: Core: color utilities

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033
**Status:** done
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Move color parsing and comparison into `@dta/core` (public API), reusing the legacy tests as the behavioural reference. Contrast ratio currently lives in legacy `linter.ts`; it moves here too so lint and build can share it.

## Acceptance Criteria

- [x] `parseColor`, `toHex`, `colorsApproximatelyEqual` behave as legacy `color.ts` for every case in `src/color.test.ts` (ported through the public API)
- [x] `contrastRatio` behaves as legacy `linter.ts` (WCAG relative luminance); covered by tests including black/white = 21 and identical colors = 1
- [x] Invalid colors do not throw; they return a clear failure result the caller can turn into a diagnostic
- [x] 039 parity table: `color.ts` row updated; matching legacy file is deleted only if nothing in legacy still imports it (otherwise noted in 039)
- [x] All gates pass

## Implementation notes

- `packages/core/src/color.ts`; public API: `parseColor` (returns `{ ok, color } | { ok: false, error }`), `toHex`, `colorsApproximatelyEqual`, `contrastRatio`, types `Color`, `ParsedColor`. Names changed from legacy (`rgbToHex` → `toHex`, `colorApproximatelyEqual` → `colorsApproximatelyEqual`) because the API no longer mirrors Figma's types.
- Core defines its own `Color` type instead of importing `@figma/rest-api-spec`, so it has no Figma dependency.
- Tests are the legacy `color.test.ts` cases re-expressed plus contrast reference values (21:1, 1:1, #777 ≈ 4.48, #767676 ≈ 4.54).
- Legacy `color.ts` and `contrastRatio` in `linter.ts` stay for now: legacy `token_import`, `token_export` and `linter` still import them. They are deleted with those modules (see 039).
