# TICKET-181: Press and hold "Show before" to compare

**Phase:** 14 — Launch
**Priority:** Low
**Effort:** S
**Status:** open (2026-11-02)
**Spec:** [visual-diff](../specs/visual-diff.md)
**Issue:** #63 (good first issue)

## Problem

Comparing before and after in a `dta diff` report takes two clicks per look: "Show before" on, then off again. Small changes, such as a radius going from 10 to 12, are easiest to see by flicking back and forth quickly, and two clicks per flick is slow.

## What to build

- Pressing and holding "Show before" (mouse, touch or pen; longer than about 200 ms) shows the before image while held and returns to after on release. A short click keeps today's behaviour: it toggles and stays.
- Keyboard stays as it is (Enter and Space toggle).
- The same behaviour in the design system's Diff card (`site/src/components/ds/DiffCard.astro`), which mirrors the report's script.
- Docs: one sentence each in the "Reading the report" section of the pull request guide and on the Diff card page.

## Acceptance criteria

- [ ] Holding shows before and releasing shows after; a short click still toggles (`html.test.ts` checks the script wiring, an e2e or story test checks the behaviour)
- [ ] Works with mouse and touch; no text selection or context menu while holding
- [ ] Report and Diff card behave the same; docs updated
- [ ] Gates green

## Notes

- The toggle lives in `packages/visual-diff/src/report/html.ts` (search for `data-toggle`). Pointer events (`pointerdown`, `pointerup`, `pointercancel`) cover mouse, touch and pen.
