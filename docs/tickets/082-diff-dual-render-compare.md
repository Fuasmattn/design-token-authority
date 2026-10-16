# TICKET-082: Render base and head in one run and compare

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** L
**Blocked by:** 081
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 2, 5, 6)

## What to build

`dta diff` builds the project at the base (temporary worktree) and at the head with the configured command, serves both, captures every story × viewport in Chromium and computes a pixel diff with ratios and diff images. Deterministic settings; Playwright is an optional peer dependency; a Dockerfile runs it anywhere.

## Acceptance criteria

- [ ] Base build in a temporary worktree, cleaned up afterwards (also on failure)
- [ ] Capture with fixed viewport, device scale 1, animations off, reduced motion, fonts from the site, network idle
- [ ] `compareImages` tested on synthetic PNGs (identical, one pixel off, thresholds)
- [ ] Missing browser → clear install hint, `--tokens-only` still works
- [ ] End-to-end CI job in the container on a small fixture site at two commits (one token change, one component change)
- [ ] All gates pass, and the GitHub run is green
