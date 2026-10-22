# TICKET-138: Figma push for the new types

**Phase:** 12 — DTCG 2025.10
**Priority:** Medium
**Effort:** M
**Blocked by:** 134
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decision 11; slice 7)

## What to build

- `planPush` maps what Figma variables can hold: colour (any space converted to sRGB, warning when clipped), `number`, `dimension` in `px` as a number, `string`, `boolean`, `fontFamily` as a string where it is one family.
- Everything else (other units, `duration`, `cubicBezier`, composites) is skipped with one `not-pushable` warning per token, listed in the push report.
- `dta pull` keeps writing per-mode files.

## Acceptance criteria

- [ ] Push planning tests against the Figma fake for each mapped and each skipped type
- [ ] Push report scenario recorded by name
- [ ] Figma guide documents what is pushed and what is skipped
- [ ] All gates pass, and the GitHub run is green
