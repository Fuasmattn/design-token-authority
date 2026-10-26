# TICKET-139: Two playground e2e tests that fail now and then in CI

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** done (2026-10-26)

## Problem

The CI job "site" failed once on 610bae6 (run 39890734627, attempt 1) and passed on a rerun. Two tests in `site/playground.e2e.test.ts` failed:

- **"keeps the tab bar at the top of a phone screen while the view scrolls"**: `expected 298 to be less than 24`. The tab bar stayed at its natural position after `scrollTo(0, 700)`.
- **"selects a token on the graph …"**: after "Show in graph" and Escape, focus was not on the token's row (`document.activeElement.dataset.node` was `undefined`).

## Cause

Both tests acted before a deferred Preact effect ran. Preact runs effects after the next frame, so on a slow runner the test can be faster.

- **Tab bar (the test).** "Load example" moves focus to the source bar's status in an effect, and `focus()` scrolls the status into view. When that focus lands after the test's scroll, the page is back at the top. The page behaves as intended (the status is announced and in view); the test scrolled too early.
- **Escape after "Show in graph" (the page).** A selection made in another view has no opener; the playground finds the row once it is on screen and hands it to the detail panel with one more render. Closing the panel before that render left focus in the closed panel, so it fell to the page. A visitor would rarely be that fast, but keyboard users lost their place.

Reproduced on purpose: with the hand-over render removed, the graph test fails with exactly the CI error; with the fix it passes. A CPU slowed down 6× and 10× (Chrome DevTools throttling) did not reproduce either failure by itself.

## Fix

- The tab bar test waits for the status to have focus before it scrolls.
- `close` in `site/src/playground/Playground.tsx`: when focus is still in the panel or on the page, it goes to the opener if one was found, or else to the row or finding on screen now.

## Acceptance criteria

- [x] Both tests wait for or survive the deferred effect, and the graph test passes with the hand-over render removed
- [ ] The CI job "site" green on the push (and no reruns needed for these two over the next pushes)

## Third case (2026-10-24)

The "site" job failed on `5472d7e` (a docs-only commit): "at %i px the detail panel opens from a row … Escape returns it" timed out waiting for the dialog. Same race as the tab bar test: the test focused the row and pressed Enter while "Load example"'s effect had not yet moved focus to the source bar's status; when it landed, Enter went to the status. The test now waits for the status to have focus before it focuses the row. It was the only test that focuses and types right after "Load example" (the others click).
