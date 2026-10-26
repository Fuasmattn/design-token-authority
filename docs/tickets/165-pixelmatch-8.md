# TICKET-165: pixelmatch 7 → 8

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

pixelmatch decides whether two screenshots differ in `dta diff` (`packages/visual-diff/src/compare.ts`). A change to its defaults (threshold, antialiasing detection) changes which stories count as changed for every user.

## What to build

- Bump in `@dta/visual-diff` and the root package (bundled).
- Read the release notes; set any default that changed explicitly to the old value, so results do not move.

## Acceptance criteria

- [ ] `compare.test.ts` green without changing expected pixel counts
- [ ] `dta diff` on the website: same changed stories and same pixel counts as before for one real change (compare `result.json`)
- [ ] Safety check of the spec green

## Notes
