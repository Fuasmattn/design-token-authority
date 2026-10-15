# TICKET-052: Build: Tailwind v4 output

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049, TICKET-051
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Port `formatters/tailwind-v4.ts` and emit `output/tailwind/tailwind.css` (shared) and `output/tailwind/<brand>/tailwind.css` (per brand, `resolvedValues`).

## Acceptance Criteria

- [ ] All Tailwind v4 files are byte-identical to the snapshots for brand-ab and daisyui
- [ ] The path-based, type/scope-based and fallback mapping rules are covered by tests through `buildOutputs` with crafted models (legacy `tailwind-v4.test.ts` cases re-expressed)
- [ ] The formatter is internal; the package index does not export it
- [ ] 039 parity table: `formatters/tailwind-v4.ts` row updated
- [ ] All gates pass, and the GitHub run is green
