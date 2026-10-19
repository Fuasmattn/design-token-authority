# TICKET-107: `GravityWell` and `FloatingObjects`: the key visual

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** L
**Blocked by:** 110, 106
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decisions 3, 4, 10); accepted prototype `docs/specs/landing-redesign/prototypes/p17-page.html`, renderer in `gen15.py` (`Well` factory), objects and the free particles in `gen16.py`

Replaces the earlier TICKET-107 (`LoopPath`, the two-lane loop diagram), dropped with the spec revision of 2026-10-18; the reference files `loop-path.html` and `loop-workbench-rejected.html` stay in the spec folder as rejected.

## What to build

Two design-system components under `site/src/components/ds`, each with a docs page and stories.

### `GravityWell`

The hero background: a `<canvas>` (`aria-hidden`) the size of the hero band, clipped, plus the 3D objects as DOM elements on two orbit rings. Port the prototype's renderer as a small TypeScript module (`site/src/scripts/well.ts`), not a rewrite:

- Surface z(r) = −K(1/r − 1/R_far); tilted view (default 64°) with perspective s = F/(F − z); the view blends to a flat 2D plane between 0.9 R and 2.2 R so rings become circles and spokes straighten before the mesh fades (0.95 R → 2.6 R).
- 28 logarithmic-spiral spokes turning once in 120 s; rings log-spaced (step ln 1.12) flowing inward at 0.085 log-units per second; cells painted opaque back to front in the page colour (no see-through); lines fade in at the edge, out at the throat, and darken from `well.line` to `well.throat`; the mouth ellipse in `well.mouth` with a `well.glow` rim; a wash of the page colour over the top 42 %.
- Geometry from props: `tilt`, `size` (S/L: board width, r1, r2, rmin per breakpoint as in the prototype's `SIZES`), `offset` (x %, y %); defaults tilt 64, S, x +8, y 0. The prototype's control bar is **not** shipped; the props exist for the docs page.
- Objects: `.pc` groups (static tilt) with a `.spin` child rotating inside the plane (60 s inner ring, 90 s outer counter-rotating, 140 s dust); cubes (six faces, `display:block`), spheres billboarded through a counter-spin and counter-tilt wrapper; the same set and angles as the prototype (inner: orange cube, blue sphere, ink cube; outer: orange sphere, blue cube, ink sphere, orange cube; 18 motes). Colours from the `well.object.*` tokens (110); sizes from the renderer through CSS variables (`--dy1/--s1`, `--dy2/--s2`, `--dyd/--sd`, `--tilt`, `--r1/--r2/--rd`).
- Theme: the renderer reads its colours from the computed tokens on `:root` and re-reads on theme change and `prefers-color-scheme` change.
- Motion: `requestAnimationFrame` loop; parallax on scroll (canvas 0.35, objects 0.18, `translateY`, passive listener, one frame per scroll event); device pixel ratio capped at 2. `prefers-reduced-motion`: a single frame at t = 0, objects at rest, no parallax, 0 running animations (measure as in 071). Page hidden (`visibilitychange`): pause.
- Phone: the hero stacks (well above the copy), the canvas is `overflow-x: clip` on the hero so the x offset never causes horizontal scroll; the stage is 210 px (S) / 240 px (L).
- Performance budget: one canvas, no per-frame allocation beyond the cell array (~2 k cells at desktop), under 4 ms a frame on a 2020 laptop; no layout thrash (the only DOM writes per frame are the CSS variables on `:root`). Record the numbers in the ticket outcome.

### `FloatingObjects`

The final section's decoration: a handful of objects (two cubes, two spheres, four motes from the same markup as the well's) positioned by percentage, each with its own drift (translate loop, 9–14 s, alternate), tumble (cubes, 38–52 s) and **scroll depth** (0.12–0.4): `translateY(d × depth)` where d is the section centre's distance from the viewport centre. No orbit rings, no mesh. Reduced motion: all still.

### Docs and stories

- Docs pages with the physics in two sentences each, the token list, and the motion rules (this is the design system's motion foundation; replaces the `LoopPath` motion rules that were planned).
- Stories: well at rest (reduced motion, both themes, 1280 and 390), well with position B and size L (docs only), floating objects at rest. `dta diff` renders the rest-state stories; motion is not diffed.

## Acceptance criteria

- [ ] `GravityWell` renders the prototype's default look (compare against `p17-page.html` at 1440 and 390, both themes) from tokens only — no colour literal in the module or the component
- [ ] 0 running animations and a still mesh under reduced motion; pause on hidden page; frame budget recorded
- [ ] `FloatingObjects` with the parallax; no horizontal scroll at 390 px
- [ ] Docs pages and stories; `dta diff --list` shows them; guards pass
- [ ] All gates pass plus the site job, and the GitHub run is green
