# TICKET-145: `dta init --diff`: no second `dta build` when the build script runs it

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** Low
**Effort:** XS
**Blocked by:** —
**Status:** in review
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md)

## What to build

Found in TICKET-142's test repository: the `build` script was `dta build && node build.mjs`, and `dta init --diff` proposed `build: npx dta build && npm run build`, so the tokens are built twice in every base and head build. `proposeSection` in `packages/cli/src/init/diff-setup.ts` always puts `<run dta> build &&` in front of the detected build (also for Storybook builds). Leave it out when the script that the detected command runs already calls `dta build` (or `design-token-authority build`).

## Acceptance criteria

- [x] Detection records whether the build script (and the Storybook build script) runs `dta build`; `proposeSection` then proposes the build command alone
- [x] Unchanged when the script does not build the tokens: `<run dta> build && <build>` as today
- [x] Re-running init on a project with the old proposal: the generated key follows (it was written by init), a key changed by hand is kept
- [x] Tests in `io/detect.test.ts` and `commands/init-diff.test.ts`; all gates pass

## Notes

- A script that calls another script (`"build": "npm run tokens && vite build"`) is not followed; only the script text itself is checked. Harmless when missed: the tokens are built twice, as today.

## Done (2026-10-24)

- `detectProject` sets `buildRunsDta` when the detected build script (or the Storybook build script) runs `dta build` (also through npx, pnpm exec, yarn, bunx, or as `design-token-authority build`); `proposeSection` then proposes the script alone.
- Tests: the script patterns in `detect.test.ts`; in `init-diff.test.ts` a project whose Storybook script gets `dta build` moves from `npx dta build && npm run build-storybook` to `npm run build-storybook` on a re-run (a key init wrote follows the project).
- Quick start: one sentence on why `build` starts with `dta build`, and when it does not.
