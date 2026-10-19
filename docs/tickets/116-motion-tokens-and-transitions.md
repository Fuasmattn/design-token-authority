# TICKET-116: Motion tokens, a motion rule against change blindness, and playground transitions

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground) and the design system
**Priority:** High
**Effort:** M
**Blocked by:** 079 (same files; start after it lands)
**Status:** open
**Spec:** [playground](../specs/playground.md) (decision 15); design system principle 7 ("Deterministic motion")

## Problem

The playground changes state abruptly: the drop area is replaced by the source bar, tabs swap content, the panel or sheet appears, lint groups open, counts change. When something changes without motion, people miss what changed (change blindness), and the page feels jumpy. The maintainer wants transitions on the playground and a common rule for the whole design system (2026-10-19).

The design system has no motion tokens: components use ad-hoc literals (`0.15s ease`, `0.2s ease`, `0.35s cubic-bezier(0.2, 0.8, 0.2, 1)`, `0.6s …`, `cubic-bezier(0.4, 0, 0.2, 1)`), which the "token variables only" rule should not allow.

## What to build

1. **Motion tokens in `site/tokens`**, built with `dta build` like the rest: a short duration scale (e.g. `motion.duration.instant | fast | base | slow`, roughly 0 / 120 / 200 / 320 ms) and two or three easings (`motion.ease.standard` for moves, `enter` for things appearing, `exit` for things leaving). Check how DTA's own build emits them first: durations must come out with `ms` and easings as `cubic-bezier(…)` strings. If the build cannot express that correctly today, the fix goes into `@dta/build` (with a CLI snapshot change recorded by name) or the tokens use a type the build already handles correctly; record the choice.
2. **A motion rule in the design system** (rewrite principle 7 and add a "Motion" page under `design-system/`): every state change a person should notice is transitioned, never instant: things that appear grow or fade in from where they come from, things that leave go back there, content that changes in place crossfades, a value that changes is briefly highlighted (`action.subtle`), and layout shifts animate instead of jumping. Motion stays short and functional (no bounce, no decoration beyond the landing page's well). `prefers-reduced-motion`: positions do not move; changes become instant or a short crossfade, and the highlight of changed values stays (it is information, not motion). Include do/don't examples and the token table.
3. **Apply it to the playground** (all states from 077, 115, 079):
   - input → workspace: the drop area collapses into the source bar (View Transitions API where supported via `document.startViewTransition`, a plain crossfade otherwise); results appear with a short staggered fade, not all at once
   - tab change: the panel content crossfades; the tab indicator moves to the new tab
   - side panel slides in from the right, bottom sheet from the bottom, both back on close; the backdrop fades
   - lint groups and other disclosures animate their height (`interpolate-size` / grid-rows trick, no JS measuring if avoidable)
   - selected rows, the summary counts and the Lint tab count highlight briefly when they change (e.g. after "Replace files")
   - errors for invalid input fade in where they appear
4. **Use the tokens everywhere:** replace the literal durations and easings in `site/src/components/ds` with the motion tokens (the well's long orbit periods stay their own `well-*` values); extend `components.test.ts` so a new literal duration or easing in a component fails.

## Acceptance criteria

- [ ] Motion tokens built with `dta build`, correct CSS output (`ms`, `cubic-bezier`), documented with the other tokens
- [ ] Principle 7 rewritten and a Motion page with the rule, reduced-motion behaviour, do/don't and the tokens
- [ ] Playground transitions as listed, all on the tokens; stories show them where a still frame can (e.g. a panel mid-state is not needed, the end states are)
- [ ] `prefers-reduced-motion`: e2e check that nothing moves (positions) and changed-value highlights still appear
- [ ] No literal durations/easings left in `site/src/components/ds` (test)
- [ ] Layout shift stays 0 on the playground and landing page; AAA contrast unchanged; no horizontal scroll at 390 px
- [ ] All gates pass plus the site job, and the GitHub run is green
