# TICKET-164: preact 10 → 11

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** M
**Status:** done (2026-10-26, #50)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

The site's interactive components (`site/src/components/ds/*.tsx`) and the playground run on preact through `@astrojs/preact`. A major can change hooks, compat behaviour or hydration, and the playground has a first-load budget (TICKET-124).

## What to build

- Bump `preact` with a matching `@astrojs/preact` (check it supports preact 11 first; if not, wait and note it here).
- Follow the preact 11 migration notes for the components and the playground.

## Acceptance criteria

- [x] Safety check of the spec green, including the site's e2e and contrast tests
- [x] `dta diff` on the website: zero changed stories (self-diff, and preact 10 → 11 across versions)
- [x] Playground first-load budget still met (TICKET-124 test)
- [ ] Vercel preview checked by the maintainer at 1280 and 390 px, light and dark

## Notes

Outcome (2026-10-26). `preact` 10.29.8 → 11.0.2 with `@astrojs/preact` 6.1.1 (the first version whose peer range allows 11; 6.0.5 on main does not, so this depends on TICKET-156 or carries the same bump). `preact-render-to-string` 6.8 and `@prefresh` already accept 11.

**Audit against the 11 upgrade guide.** The site imports only `preact` and `preact/hooks` (no `preact/compat`), so the compat moves (`defaultProps`, automatic `px` on numeric styles) do not apply; no numeric style values anyway. No `ref` on a function component (refs are forwarded by default now). The one thing 11 objected to, found by `astro check`: `useRef()` now requires an initial value; two timer-handle refs (`CopyButton`, `CliHandoff`) become `useRef<… | undefined>(undefined)`, same behaviour (`clearTimeout(undefined)` is a no-op). `useEffect` cleanup now runs after paint: the playground e2e tests, which open and close tabs and panels, all pass.

**Proof that nothing looks different.** With TICKET-172's fix applied on both sides (so the Workflow flake cannot muddy it): `dta diff` of this branch against itself, 125 stories, 0 changed; and against main on preact 10, **125 stories, 0 changed**. Every story renders pixel-identical on 11. The playground budget test (TICKET-124) passes.
