# TICKET-053: Build: Tailwind v3 output

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049, TICKET-051
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Port `formatters/tailwind-v3.ts` and emit `output/tailwind/tailwind.tokens.ts` (shared) and `output/tailwind/<brand>/tailwind.tokens.ts` (per brand).

## Acceptance Criteria

- [ ] All Tailwind v3 files are byte-identical to the snapshots for brand-ab and daisyui
- [ ] Legacy `tailwind-v3.test.ts` cases re-expressed through `buildOutputs` with crafted models
- [ ] The formatter is internal; the package index does not export it
- [ ] 039 parity table: `formatters/tailwind-v3.ts` row updated
- [ ] All gates pass, and the GitHub run is green
