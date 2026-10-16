# TICKET-085: Review report in the Drafting Table design

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** M
**Blocked by:** 084
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 9, 10)

## What to build

`dta diff` writes `report/index.html`: grouped by token change with representative samples and a contact sheet, unexplained changes one by one, each with baseline, candidate, diff overlay and drag-to-compare slider, redline labels naming tokens; plus `summary.md` and PNGs. Static, opens from disk.

## Acceptance criteria

- [ ] Uses the Drafting Table tokens built by DTA (same source as the website)
- [ ] Portable: one self-contained folder, relative links only, works from disk or any static host; keyboard-accessible slider; light and Graphite
- [ ] `summary.md` fits a PR comment (table per story × viewport, ratios, cause)
- [ ] Report rendering tested from a fixed result
- [ ] All gates pass, and the GitHub run is green
