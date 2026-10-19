# TICKET-076: Run the `@dta/*` packages in the browser

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** M
**Blocked by:** 069
**Status:** open
**Spec:** [playground](../specs/playground.md) (decisions 1, 9, 11)

## What to build

The package APIs the playground needs (`@dta/core`, `@dta/figma` import/detect, `@dta/lint`, `@dta/build`) run in a browser bundle without Node built-ins, proven by tests in a browser environment. Where a package touched Node APIs, it gets a pure entry point or an injectable file system, not a playground copy.

## Acceptance criteria

- [ ] Browser-environment tests call each needed public API on the brand-ab fixture
- [ ] Bundle size of each package noted; `@dta/build` (Style Dictionary) loads lazily if heavy
- [ ] No change to CLI behaviour: all snapshots unchanged
- [ ] All gates pass, and the GitHub run is green

## Notes

- Pre-check 2026-10-19: no Node built-ins in the packages' source outside `lint/src/test-helpers.ts` and `build/src/test-helpers.ts` (not exported); `@dta/build` formats in memory. Expect the work to be the browser test setup, entry points/exports for bundling (the packages export `./src/index.ts` today) and the size numbers, so the effort may be closer to S.
- Lazy loading of `@dta/build` is decided (spec decision 9), whatever its size.
