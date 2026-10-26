# TICKET-164: preact 10 → 11

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** M
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

The site's interactive components (`site/src/components/ds/*.tsx`) and the playground run on preact through `@astrojs/preact`. A major can change hooks, compat behaviour or hydration, and the playground has a first-load budget (TICKET-124).

## What to build

- Bump `preact` with a matching `@astrojs/preact` (check it supports preact 11 first; if not, wait and note it here).
- Follow the preact 11 migration notes for the components and the playground.

## Acceptance criteria

- [ ] Safety check of the spec green, including the site's e2e and contrast tests
- [ ] `dta diff` on the website: zero changed stories
- [ ] Playground first-load budget still met (TICKET-124 test)
- [ ] Vercel preview checked by the maintainer at 1280 and 390 px, light and dark

## Notes
