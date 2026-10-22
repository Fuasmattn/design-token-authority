# TICKET-127: Base build without `diff.setup`

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (settled question 2)

## What to build

Today the base is built in a fresh worktree (`createBaseWorktree` in `packages/cli/src/io/worktree.ts`) with nothing installed, so without `diff.setup` the base build fails, and the run carries on with every story counted as "added".

- When `diff.setup` is not set and the lockfile is byte-identical between base and head, reuse the head's installed packages in the worktree.
- When the lockfile differs, or the reuse fails, install with the command the lockfile implies (`npm ci`, `pnpm install --frozen-lockfile`, …; detection from TICKET-126).
- `diff.setup` stays as an override and always wins.
- A base build that fails stops the run with an error that names the command and its output, instead of counting every story as added.

## Acceptance criteria

- [ ] The Storybook trial from TICKET-089 runs with no `setup` key
- [ ] Tests: lockfile unchanged (reuse), lockfile changed (install), `setup` set (override), base build fails (error, no report of "all added")
- [ ] The time saved with an unchanged lockfile is measured once and noted here
- [ ] Docs: the `setup` key is described as optional
- [ ] All gates pass, and the GitHub run is green
