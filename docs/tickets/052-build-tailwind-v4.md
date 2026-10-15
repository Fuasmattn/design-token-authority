# TICKET-052: Build: Tailwind v4 output

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049, TICKET-051
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Port `formatters/tailwind-v4.ts` and emit `output/tailwind/tailwind.css` (shared) and `output/tailwind/<brand>/tailwind.css` (per brand, `resolvedValues`).

## Acceptance Criteria

- [x] All Tailwind v4 files are byte-identical to the snapshots for brand-ab and daisyui
- [x] The path-based, type/scope-based and fallback mapping rules are covered by tests through `buildOutputs` with crafted models (legacy `tailwind-v4.test.ts` cases re-expressed)
- [x] The formatter is internal; the package index does not export it
- [x] 039 parity table: `formatters/tailwind-v4.ts` row updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/build/src/formatters/tailwind-v4.ts` is the legacy formatter, moved over with types tightened (no `any`); registered as the Style Dictionary format `tailwind/v4` through the hooks. It is not exported from the package index.
- Shared file `output/tailwind/tailwind.css` comes from the base emit set; per-brand files `output/tailwind/<brand>/tailwind.css` come from the brand run with `resolvedValues: true` (resolved colors instead of `var()` references).
- Tests (`tailwind-v4.test.ts`): snapshots for brand-ab (shared plus both brands) and daisyui; the legacy formatter cases re-expressed through `buildOutputs` with crafted models. Legacy tests passed already-transformed values (`16px`); here the model carries raw numbers and Figma scopes, so the transforms are covered as well.
- 039: `formatters/tailwind-v4.ts` is covered here; the legacy file and its test are deleted with the legacy build command.
