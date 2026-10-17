# TICKET-106: Design-system components for the redesigned landing page

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** 105
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decisions 1, 2, 6)

## What to build

Under `site/src/components/ds`, each with a docs page in `design-system/components/` and at least one story (phone width too where the layout changes):

- **`Scene`**: kicker (number and title), heading, one paragraph, a command line, and a slot for the embedded example; alternates sides on desktop, stacks on phones; spacing per the spec (quiet surface, `--space-36` between scenes).
- **`ExampleCard`**: the Orbit Burger card. Props: `state: 'main' | 'change'` (switches the example token set), optional label ("main", "this change" in signal colour). The burger drawing and orbit rings in CSS, no image. Sizes: default and small.
- **`BeforeAfter`**: two `ExampleCard`s side by side with the notes under them (token, change, share of the differences), reading from a small data object so the numbers come from the recorded run (105).
- **`TokenRows`**: a short list of token rows (swatch, name, value), edited rows marked in signal colour.
- **`Checks`**: the check list (lint passed, diff pending) and the approve action, flat on the surface.
- Retire `DiffCard` from the landing page (keep its docs page and story until TICKET-109).

Rules: token variables only, no borders except where the spec names one, no shadows except the risen state of 107 and the focus ring; the guards in `components.test.ts` and `stories.test.ts` must pass.

## Acceptance criteria

- [ ] Five components with docs pages and stories; `dta diff --list` shows the new stories
- [ ] Phone width checked (390 px, no horizontal scroll) for each
- [ ] All gates pass plus the site job, and the GitHub run is green
