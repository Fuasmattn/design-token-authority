# TICKET-126: Detect the project for `dta diff` setup

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** done (2026-10-24)
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decisions 2, 3)

## What to build

One detection function that `dta init` (TICKET-131) and `dta diff --check` (TICKET-130) share. It reads the project and returns what it found, each result with where it came from:

- **Storybook:** a `.storybook/` folder, a `build-storybook` script, its output folder (`storybook-static` by default, or `-o` in the script)
- **Package manager:** from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`), falling back to `packageManager` in `package.json`
- **Node version:** `.nvmrc`, `.node-version`, then `engines.node`
- **Build command:** the Storybook build script, otherwise `build`
- **Git:** remote host (GitHub or other) and default branch, with the same lookup `dta diff` uses for its base

## Acceptance criteria

- [x] Each result carries its source ("pnpm, from pnpm-lock.yaml"); a result that was not found says so, it is never guessed
- [x] Tests on small fixture folders: npm, pnpm, Storybook, no Storybook, no lockfile, no git remote
- [x] Detection reads files only: no network, no installs
- [x] All gates pass, and the GitHub run is green

## Notes

- Lives in `@dta/cli` (it reads the project, not tokens). The default-branch lookup is reused from `packages/cli/src/io/diff-base.ts`, not copied.

## Notes

- `detectProject(cwd)` in `packages/cli/src/io/detect.ts`: each result is `{ value, source }`, or `{ value: null, source: why not }`; `describeFound` prints "npm, from package-lock.json". Also the clean install command per lockfile (`npm ci`, `pnpm install --frozen-lockfile`, `yarn install --immutable` with a `.yarnrc.yml`, else `--frozen-lockfile`, `bun install --frozen-lockfile`).
- Storybook: a script named `build-storybook` or running `storybook build` (its `-o` / `--output-dir`), else a `.storybook/` folder. Build: that script, else `build`, run with the package manager.
- Git: host from the `origin` URL, default branch through `defaultBranch` of `io/diff-base.ts` (now exported, with `gitOutput`), so `dta diff` and detection agree. No network.
- Tests: npm with Storybook, pnpm without, Storybook script named otherwise, packageManager fallback and nothing found, git host and branch, Yarn 2+.
- **Review (fixed):** a workspace package finds the lockfile, `.nvmrc` / `.node-version` and `packageManager` at the repository root (it looked only in the project folder, so pnpm monorepos got npm); Storybook is found by a script named `build-storybook` or one that runs `storybook build` (also `npx storybook@8 build`, `sb build`), not by a script that only names another (`chromatic --build-script-name build-storybook`).

## Review (2026-10-24)

- Every criterion checked against the code: each result is `{ value, source }`, a missing one says why (`packages/cli/src/io/detect.ts`, `describeFound`); fixture tests for npm, pnpm, Storybook, no Storybook, no lockfile and no git remote (`detect.test.ts`); detection uses only `fs` and local git commands. CI green on 3bdd228.
