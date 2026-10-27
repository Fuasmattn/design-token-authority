# TICKET-165: pixelmatch 7 → 8

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** done (2026-10-26, #50)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

pixelmatch decides whether two screenshots differ in `dta diff` (`packages/visual-diff/src/compare.ts`). A change to its defaults (threshold, antialiasing detection) changes which stories count as changed for every user.

## What to build

- Bump in `@dta/visual-diff` and the root package (bundled).
- Read the release notes; set any default that changed explicitly to the old value, so results do not move.

## Acceptance criteria

- [x] `compare.test.ts` green without changing expected pixel counts
- [x] `dta diff` on the website: same changed stories and same pixel counts as before for one real change (compare `result.json`)
- [x] Safety check of the spec green

## Notes

Outcome (2026-10-26). `pixelmatch` 7.2.0 → 8.0.0 in `@dta/visual-diff` and the root (bundled).

**What changed in 8.** Same options, same defaults (`threshold` 0.1, `includeAA` false, `alpha` 0.1), but the colour distance behind `threshold` moved from YIQ to a perceptual OKLab HyAB distance (1 is black against white). DTA sets `threshold`, `diffColor`, `aaColor` and `alpha` explicitly and only relies on the `includeAA` default, which is unchanged.

**Measured on a real diff** (the Workflow dust change before TICKET-172, 215 differing pixels at 1280): at DTA's default `colorThreshold` 0, pixelmatch 7 and 8 count **the same 215 pixels**; at 0.05, 0.1 and 0.2 they differ by 1–3 pixels (198/201, 186/188, 165/168). So the default is unaffected, and a user who set a non-zero `diff.colorThreshold` gets a slightly different (perceptual) tolerance. The config description now names the scale; it flows into the generated Configuration reference and the JSON schema at site build.

`compare.test.ts` green with its expected pixel counts unchanged; the `dta diff` e2e (real screenshots) green; `dist/index.d.ts` identical.

Also seen during this run, unrelated to pixelmatch: `motion.e2e` "without layout shift" failed once with a cumulative layout shift of 0.001 while the machine was busy, then passed 3 of 3 in isolation. A timing-sensitive `toBe(0)` on CLS; noted in TICKET-158.
