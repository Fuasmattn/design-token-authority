# TICKET-107: `LoopPath`: the two-lane loop diagram, flat or risen

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** 106
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decisions 3, 4); reference `docs/specs/landing-redesign/loop-path.html`

## What to build

A design-system component `LoopPath` that renders the loop as data: an ordered list of stations, each with `side: 'design' | 'product' | 'pr'`, a label, a dot colour (token) and, for pull-request stations, a status line. The component lays them out on two lanes with the pull requests between, draws the connecting path (SVG, segments as separate paths so each can draw in), and animates:

- **Flat or risen:** labels are plain text on the surface at rest; the station the capsule rests at lifts 3 px with the soft double shadow (two shadow tokens: dark lower-right, light upper-left; add them to `site/tokens` as the design system's only non-focus shadows). No other state.
- **Path draws ahead:** each segment strokes in just before the capsule travels it; the segment returning to the design lane uses the signal colour.
- **Capsule:** signal-coloured dot with a faint halo, travelling by `offset-path` (CSS) with holds at each station (about 6 % of a 14 s cycle each), ease-in-out on arrival. Docks on the station's dot, not its centre.
- **Pull-request status** text comes to full strength as its card rises.
- `prefers-reduced-motion`: full path drawn, all stations flat, no capsule. Hover pauses.
- Phone width: stations stack in order (design, PR, product, …) with the path drawn vertically, or the diagram switches to a vertical layout; no horizontal scroll.

Docs page with the motion rules written down (this is the design system's motion foundation for the landing page); stories: resting state (for `dta diff`, with motion off) and phone width.

## Acceptance criteria

- [ ] Component renders from data; the landing page's seven stations are a data file, not markup
- [ ] Motion as specified; 0 running animations under reduced motion (measured, as in 071)
- [ ] Shadow tokens added to `site/tokens`, `pnpm report:tokens` run, guards pass
- [ ] All gates pass plus the site job, and the GitHub run is green
