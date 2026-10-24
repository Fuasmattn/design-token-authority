# TICKET-097: Nav: burger button and full-screen menu on phones

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** S
**Blocked by:** 095
**Status:** done

## Background

Maintainer feedback on the first version of `Nav` (095): the menu button should be a plain burger without an outline unless hovered or focused, the menu on phones should take the whole screen and move in with the site's motion, and the theme switch belongs inside the navigation. Tablets keep the row: there are only four links.

## What to build

- `Nav` takes extra controls in its default slot (the theme switch); they follow the links in the row and sit at the bottom of the phone menu.
- Below 760px: a 44px burger (border only on hover and focus) that turns into a cross; a fixed full-screen sheet on grid paper. Opening: the sheet wipes down, a redline draws under the header, the numbered links rise one after another. Closing is faster and without the stagger. Reduced motion: no transitions.
- While open: no page scrolling behind the menu, focus moves to the first link and stays inside the menu, Escape and a link close it, and growing the screen past 760px closes it.

## Acceptance criteria

- [x] The landing page header is the logo plus `Nav` with the theme switch in it
- [x] Checked in Chromium at 390px (open, focus trap, Escape, link, scroll lock, both themes), 820px and 1280px (row)
- [x] Docs page and stories updated; all gates pass plus the site job, and the GitHub run is green
