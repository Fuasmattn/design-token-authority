# TICKET-080: `dta diff` tracer: token change set

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** M
**Blocked by:** 039
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 1, 7, 10)

## What to build

`dta diff --tokens-only --base <dir|ref>` reports added, removed and changed tokens per brand and mode with resolved values before and after (alias changes expand to the tokens they affect), as console, markdown or JSON. Base from a git ref is read without checking out. No browser yet.

## Acceptance criteria

- [x] New internal package `@dta/visual-diff` (public API entry, tests, depends on `@dta/core`)
- [x] Fixture pair: brand-ab plus a changed copy (one primitive, one alias, one spacing, one added and one removed token)
- [x] Base as directory or git ref (default: merge base with the default branch); clear error outside a git repo
- [x] Snapshot scenario `diff-tokens` (markdown) recorded with `pnpm snapshot:record` and reviewed
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `dta diff` reads the head from the working tree (uncommitted edits count) and the base from a directory or a git ref via `git ls-tree --full-tree` / `git show`, so nothing is checked out; it works from a sub-folder of the repository.
- The base uses the head config's `tokens.dir`; a base with a different tokens folder is not supported yet.
- Without `--tokens-only` the console says that visual comparison is not available yet; markdown and JSON are plain (no terminal frame) so they can go straight into a PR comment.
- Exit codes: 0, or 1 with `--fail-on-change` when anything changed; 1 for an unreadable base or unknown format; 2 for an invalid config (as everywhere).
