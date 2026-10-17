# TICKET-109: `dta diff` report: before/after with the change outlined, instead of thumbnails

**Phase:** 10 — Landing redesign (follows Epic 8)
**Priority:** Medium
**Effort:** M
**Blocked by:** 108 (the presentation is settled there)
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 7); [visual-diff](./visual-diff.md)

## What to build

The report's per-story row currently shows three thumbnails (baseline, candidate, diff heat map) that a reviewer has to decode. Replace it with the landing page's presentation: the story rendered before and after at a readable size, the changed region outlined in the signal colour on the "after" render, and the token callout placed on the change ("Colors.Brand.Primary · Nova 500 → 600") when a token explains it; the heat map stays available behind a toggle for unexplained differences. Same tokens and components as the website (the report is styled from the DTA Drafting Table); the `DiffCard` component is reworked or replaced accordingly, with its docs page and story updated.

## Acceptance criteria

- [ ] Report rows show before/after with the outline and callout; unexplained differences still show the diff overlay
- [ ] `dta diff` end-to-end test and the report HTML tests updated; design-system guards pass
- [ ] All gates pass, and the GitHub run is green
