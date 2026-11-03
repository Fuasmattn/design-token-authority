# TICKET-183: Diff overlay readable on dark areas

**Phase:** 14 — Launch
**Priority:** Medium
**Effort:** S
**Status:** open (2026-11-02)
**Spec:** [visual-diff](../specs/visual-diff.md)
**Issue:** #65 (good first issue)

## Problem

The diff overlay is the diff image blended over the screenshot with `mix-blend-mode: multiply`. On light areas, changed pixels stand out in orange. On dark areas (the Graphite half of a story, any dark surface), the overlay turns all bright pixels orange, changed or not: in #59's `structure-table--brand-ab@1280`, every label in the dark half looks changed while only the "Brands" line moved.

## What to build

- An overlay that marks only the changed pixels, on light and dark areas alike. For example, a mask built from the diff image (changed pixels opaque in one colour, the rest transparent), drawn with normal blending; or another approach that meets the criteria below.
- The marking colour reaches at least 3:1 against both the light and the dark story backgrounds.
- Same in the design system's Diff card (`site/src/components/ds/DiffCard.astro`).

## Acceptance criteria

- [ ] On a story with a light and a dark half, only changed pixels are marked in both halves (check with #59's `structure-table--brand-ab@1280`)
- [ ] Unchanged areas look the same with the overlay on and off
- [ ] Report and Diff card match; the overlay sentence in the pull request guide still holds
- [ ] Gates green

## Notes

- The overlay CSS is in `packages/visual-diff/src/report/html.ts` (`.shot.overlay`). The diff PNG comes from pixelmatch (`compare.ts`); changing how it is drawn there would change every report's diff image, so prefer a change in the report.
