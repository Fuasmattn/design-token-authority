# TICKET-168: Workflow section renders the same picture every time

**Phase:** 13 — Maintenance
**Priority:** High
**Effort:** XS
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md); [landing-redesign](../specs/landing-redesign.md) (decision 12)

## Problem

`dta diff` fails on every pull request since TICKET-155: `workflow--default` at 1280 and 390 px shows about 200 changed pixels with no token change, and the same commit rendered twice differs the same way (found in TICKET-156). The Workflow component (`site/src/components/ds/Workflow.astro`) places its eight dust motes with `Math.random()` (start position, speed, sway, phase) and picks the token's colour and size at random. Under `prefers-reduced-motion`, which `dta diff` and the stories use, the motes are drawn once at those random positions, so the finished picture is never the same twice. The status check is red for no reason and teaches people to label past it.

## What to build

- Replace `Math.random()` in the component with a small seeded generator (for example a mulberry32 with a fixed seed), so the motes, the token colour and the size are the same on every load. The scatter still looks natural; it is just the same scatter each time.
- Keep the run itself as it is: the animation timing is driven by the token's position, not by random numbers.
- No new design-system component, no token change.

## Acceptance criteria

- [ ] `dta diff --base HEAD` on the website: 0 changed stories (rendering one commit twice)
- [ ] `workflow--default` stories look the same as before to the eye at both widths (the maintainer checks the Vercel preview)
- [ ] `motion.e2e` and `frame.e2e` green; safety check of the spec green
- [ ] The `dta diff` check on this pull request passes without the approval label

## Notes
