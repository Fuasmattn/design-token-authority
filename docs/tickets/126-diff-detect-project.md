# TICKET-126: Detect the project for `dta diff` setup

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decisions 2, 3)

## What to build

One detection function that `dta init` (TICKET-131) and `dta diff --check` (TICKET-130) share. It reads the project and returns what it found, each result with where it came from:

- **Storybook:** a `.storybook/` folder, a `build-storybook` script, its output folder (`storybook-static` by default, or `-o` in the script)
- **Package manager:** from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`), falling back to `packageManager` in `package.json`
- **Node version:** `.nvmrc`, `.node-version`, then `engines.node`
- **Build command:** the Storybook build script, otherwise `build`
- **Git:** remote host (GitHub or other) and default branch, with the same lookup `dta diff` uses for its base

## Acceptance criteria

- [ ] Each result carries its source ("pnpm, from pnpm-lock.yaml"); a result that was not found says so, it is never guessed
- [ ] Tests on small fixture folders: npm, pnpm, Storybook, no Storybook, no lockfile, no git remote
- [ ] Detection reads files only: no network, no installs
- [ ] All gates pass, and the GitHub run is green

## Notes

- Lives in `@dta/cli` (it reads the project, not tokens). The default-branch lookup is reused from `packages/cli/src/io/diff-base.ts`, not copied.
