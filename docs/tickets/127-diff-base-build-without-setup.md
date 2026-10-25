# TICKET-127: Base build without `diff.setup`

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** done (2026-10-24)
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (settled question 2)

## What to build

Today the base is built in a fresh worktree (`createBaseWorktree` in `packages/cli/src/io/worktree.ts`) with nothing installed, so without `diff.setup` the base build fails, and the run carries on with every story counted as "added".

- When `diff.setup` is not set and the lockfile is byte-identical between base and head, reuse the head's installed packages in the worktree.
- When the lockfile differs, or the reuse fails, install with the command the lockfile implies (`npm ci`, `pnpm install --frozen-lockfile`, …; detection from TICKET-126).
- `diff.setup` stays as an override and always wins.
- A base build that fails stops the run with an error that names the command and its output, instead of counting every story as added.

## Acceptance criteria

- [x] The Storybook trial from TICKET-089 runs with no `setup` key
- [x] Tests: lockfile unchanged (reuse), lockfile changed (install), `setup` set (override), base build fails (error, no report of "all added")
- [x] The time saved with an unchanged lockfile is measured once and noted here
- [x] Docs: the `setup` key is described as optional
- [x] All gates pass, and the GitHub run is green

## Notes

- `buildBase` in `packages/cli/src/io/base-build.ts`. `diff.setup` wins. Without it: the nearest lockfile from the project folder up to the repository root; byte-identical at base and head → the head's `node_modules` folders are linked into the worktree; otherwise the clean install from TICKET-126 runs where the lockfile is. A build that fails with linked packages is retried after a clean install. A base that still does not build stops the run (`baseBuildFailed`: the command, its output, the fix).
- Changed behaviour: before, a base that did not build counted every story as added. A base without a stories file (before the site had one) still counts them as added.
- The Storybook trial (a real Storybook 10 `@storybook/html-vite` project, rebuilt for this ticket in a scratch folder) runs with no `setup` key: "Reusing the head's node_modules", 1 story explained by the brand token.
- Time, measured once on that trial (90 packages): the whole run takes 38 s with reuse and 39 s with a clean install; `npm ci` itself takes 2 s with a warm npm cache and 4 s cold. On a small dependency tree the saving is small; it grows with the tree.
- Docs: `setup` is described as optional (config reference via `.describe()`, Storybook guide).
- **Review (fixed):** the base no longer links the head's whole `node_modules`: it gets a real `node_modules` folder whose packages link to the head's, workspace packages (links into the repository) link to the base's own copy, and caches (`.cache`, `.vite`) are not shared, so the base renders its own code and does not write into the head's folders (test: a workspace package at base and head).

## Review (2026-10-24)

- Reuse, install, `setup` override and a failing base build are tested (`base-build.test.ts`); a failed base build stops with `diffProblems.baseBuildFailed`. The setup key is optional in the config reference and the Storybook guide. CI green on 3bdd228 (`diff-e2e` builds a Storybook fixture's base without `setup`).
- The Storybook trial from TICKET-089 without `setup` (Progress above) confirmed by the maintainer on 2026-10-24.
- Follow-ups in TICKET-148: one lockfile list for detection and the base build.
