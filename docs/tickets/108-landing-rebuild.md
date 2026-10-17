# TICKET-108: Rebuild the landing page: hero, loop, four scenes, facts, final call

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** 106, 107
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (the page, decision 5)

## What to build

Replace the sections of `site/src/pages/index.astro` with the spec's page: hero (unchanged headline, subline, two actions; no hero visual), the loop section (`LoopPath`), four `Scene`s with their examples (`TokenRows`, `BeforeAfter`, `Checks`, the agent terminal with real output), the facts row, the final call to action on the same surface. Remove the problem/how/workflow/agents/trust/cards sections, the `.grid-paper` hero backdrop and the `#github`/`#workflow` anchors; the nav becomes The loop · One change · Agents · Docs.

Copy per the spec; `landing/content.ts` keeps the commands and the real-run data (agent output, diff numbers from 105) so `landing.test.ts` can check the honesty rule. Page-level CSS (`landing.css`) only places components; anything new is a component (106/107).

Checks before closing: no horizontal scroll at 390 px in both themes; cumulative layout shift 0; page weight within the current budget (071 measured about 96 KB transferred); link validator green; stories of the old sections removed from `stories.ts` and the reference snapshots re-recorded by name where the CLI output changes (`diff --list`).

## Acceptance criteria

- [ ] The page matches the spec section by section; nothing numbered beyond the scene kickers
- [ ] Honesty tests pass with the new copy; every shown output is real or labelled illustrative
- [ ] Phone, theme, layout-shift and weight checks recorded in the ticket outcome
- [ ] Vercel preview reviewed by the maintainer before merge; all gates pass and the GitHub run is green
