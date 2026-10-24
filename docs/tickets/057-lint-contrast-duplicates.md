# TICKET-057: Lint: color-contrast and no-duplicate-values rules

**Phase:** 8 — Token Engine Overhaul, Epic 5 (@dta/lint)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-055
**Status:** done
**Spec:** [lint-package](../specs/lint-package.md)

## What to build

Add the two value-based configurable rules, keeping the legacy semantics (spec decision 8).

## Acceptance Criteria

- [x] `color-contrast`: pairs `[foreground, background]` of token names (dot or slash form) compared with core `contrastRatio` against `minRatio` (default 4.5); only raw hex values are compared; pairs whose tokens are missing or aliased are skipped; message `Contrast ratio 2.10:1 between "a" (#…) and "b" (#…) is below 4.5:1`
- [x] `no-duplicate-values`: non-alias tokens grouped by `type:value` across all collections and modes; every member except the first is reported with the ids of the others, as in legacy
- [x] Unparseable colours are skipped without throwing; `minRatio` and `pairs` are validated by the config schema
- [x] Legacy test cases for both rules re-expressed through `lintTokens`; the legacy quirks (aliases skipped, any-mode lookup) have explicit tests so a later change is a conscious one
- [x] 039 parity table updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Legacy quirks are pinned by explicit tests: contrast compares raw hex only, looks tokens up by in-file name in any mode (last mode wins); duplicates group non-alias tokens by `type:value` across all collections and modes.
- Invalid `minRatio`/`pairs` are caught by the config schema as `invalid-config` diagnostics.
