# TICKET-071: Landing page from the "J · Drafting Table" mockup

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** L
**Blocked by:** 070
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 7)

## What to build

The site's home page implements the J · Drafting Table mockup: hero with pitch and `npx dta init` command button, problem, workflow rail, the interactive "See it" review demo with the drag-to-compare slider, Try / Govern / Delegate, Why trust it, Learn/Docs/Playground cards and footer, in light and Graphite, down to 390 px.

## Acceptance criteria

- [ ] Sections and copy follow the mockup; placeholder copy and demo numbers are visibly marked as examples
- [ ] Commands that do not exist yet (`dta check`, `dta diff`, `dta skill add`) are shown as "coming" or replaced by shipped commands; nothing on the page claims a feature that is not released
- [ ] Interactive parts (review demo tabs, slider, theme toggle) work by keyboard and pointer; motion stops under reduced motion
- [ ] Responsive per the "J refined — phone 390" artboard; no horizontal scroll at 390 px
- [ ] Lighthouse-style budget: no layout shift from fonts (font-display and size-adjust), page weight noted in the ticket
- [ ] All gates pass plus the site job, and the GitHub run is green

## Implementation notes

- Hero visual: the J review demo; the robot/mascot explorations on the canvas are not part of this ticket (spec open question 4).
