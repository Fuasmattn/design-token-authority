# TICKET-170: Gravity well: the objects fall into the funnel on scroll

**Phase:** 10 — Landing redesign
**Priority:** Low
**Effort:** S
**Status:** prototype (2026-10-26), for the maintainer to try
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 3: the key visual)

## Problem

The hero has a slight scroll parallax (mesh at 0.35, objects at 0.18). The maintainer wants the objects and the dust to move into the funnel while scrolling down, so the well does something with the scroll instead of merely drifting.

## What to build (prototype)

- Scroll progress `p`: 0 at the top, 1 once 90 % of the hero's height has scrolled by, smoothstepped; held at 1 beyond.
- The three orbit groups (inner, outer, dust) slide down the surface the mesh draws: each ring's radius goes from its orbit to 0.7 × the throat radius at `p` = 1, with depth and perspective from the well's own `z(r)` and `scale(r)`, so the objects stay on the surface and shrink as they go.
- A swirl in the orbit plane as they fall (inner +140°, outer −100°, dust +200° at `p` = 1): angular momentum on the way in. The dust fades to 0.3 opacity.
- Mesh and objects share the 0.35 parallax, so the objects stay in the funnel instead of lagging it.
- Reduced motion and `data-still`: unchanged (no scroll handling).

## Open questions for the maintainer

- Does the fall need to end lower (into the throat, objects vanishing) or hold above it as now?
- Speed: tie it to 90 % of the hero or to the full viewport height?
- Does the swirl help or distract?

## Acceptance criteria

- [ ] Maintainer tried the preview and decided: ship, tune, or drop
- [ ] If shipping: design-system docs for `GravityWell` describe the fall; `motion.e2e.test.ts` covers it
