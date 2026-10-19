# TICKET-108: Rebuild the landing page: hero with the well, four scenes, facts, final call

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** 106, 107
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (the page, decisions 5, 8, 10); accepted prototype `docs/specs/landing-redesign/prototypes/p17-page.html`

Revised 2026-10-18 with the spec: the loop section is gone, the hero carries the key visual, the grid leaves the page.

## What to build

Replace the sections of `site/src/pages/index.astro` with the spec's page:

- **Hero** on top of `GravityWell` (107): the new headline (_The deterministic centre of gravity for design token workflows, built for humans and **agents**._, the last word italic in `action.bg`; the `TokenCycle` component leaves the hero), the subline (_A toolset to lint, structure-check, transform and visually diff design tokens. Synced with Figma, shipped as pull requests._), the large `CommandChip` and the outline "Read the quick start". Copy left and the well right on desktop (`grid-template-columns: minmax(0,1fr) auto`), stacked with the well above on phones; the hero fits one phone screen; `overflow-x: clip`.
- **Four `Scene`s** with `TokenRows`, two `ExampleButton`s, `Checks` and the `Terminal` with real output (the agent scene), copy per the spec (scene 04 heading: _No hard-coded values, even from agents._).
- **`Facts`** and the **final call** ("Start with one command.", a large `CommandChip`) with `FloatingObjects` behind it.
- Remove the problem/how/workflow/agents/trust/cards sections, the loop section that was planned, `.grid-paper` and every `bg-grid` use on the page, the body's background image, the `#github`/`#workflow` anchors; the nav becomes How it works · Agents · Docs.

Copy per the spec; `landing/content.ts` keeps the commands and the real-run data (agent output, diff numbers from 105) so `landing.test.ts` can check the honesty rule (every chip's command in `COMMAND_NAMES`). Page-level CSS (`landing.css`) only places components; anything new is a component (106/107).

Checks before closing: no horizontal scroll at 390 px in both themes; cumulative layout shift 0 (the canvas is sized before first paint; the band height is set from the hero's box); page weight within budget (071 measured about 96 KB transferred; the well module should add under 8 KB gzipped); the frame budget of 107 holds on the real page; link validator green; the contrast test (110) green on the page; stories of the old sections removed from `stories.ts` and the reference snapshots re-recorded by name where the CLI output changes (`diff --list`); the British spelling pass over the page copy (centre, colour) recorded.

## Acceptance criteria

- [ ] The page matches the spec section by section; nothing numbered beyond the scene kickers; no grid anywhere on the page
- [ ] Honesty tests pass with the new copy; every shown output is real or labelled illustrative
- [ ] Phone, theme, layout-shift, weight, frame and contrast checks recorded in the ticket outcome
- [ ] Vercel preview reviewed by the maintainer before merge; all gates pass and the GitHub run is green
