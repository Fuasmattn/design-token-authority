# TICKET-053: Build: Tailwind v3 output

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049, TICKET-051
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Port `formatters/tailwind-v3.ts` and emit `output/tailwind/tailwind.tokens.ts` (shared) and `output/tailwind/<brand>/tailwind.tokens.ts` (per brand).

## Acceptance Criteria

- [x] All Tailwind v3 files are byte-identical to the snapshots for brand-ab and daisyui
- [x] Legacy `tailwind-v3.test.ts` cases re-expressed through `buildOutputs` with crafted models
- [x] The formatter is internal; the package index does not export it
- [x] 039 parity table: `formatters/tailwind-v3.ts` row updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/build/src/formatters/tailwind-v3.ts` is the legacy formatter with tightened types, registered as the format `tailwind/v3`; not exported from the index. Shared file `output/tailwind/tailwind.tokens.ts` from the base emit set, per-brand `output/tailwind/<brand>/tailwind.tokens.ts` with `resolvedValues: true`.
- `tailwind-v3.test.ts`: snapshots for brand-ab (shared and both brands) and daisyui, plus the legacy formatter cases through `buildOutputs`. Shared test helpers (fixture models, snapshot reader, small model builder) moved to `src/test-helpers.ts`, used by both Tailwind test files.
- 039: `formatters/tailwind-v3.ts` row set to build side done.
