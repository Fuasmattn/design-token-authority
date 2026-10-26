# TICKET-159: `playwright-core` 1.59 → 1.64

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md) (decision 4)

## Problem

`playwright-core` ships its own Chromium. A newer Chromium can render fonts, antialiasing or layout slightly differently, so `dta diff` may report changes that are not token changes. It is used by `@dta/cli` (`dta diff`, a peer dependency `>=1.59.0`), the site's e2e tests and the example workflows.

## What to build

- Bump the pinned dev version in `@dta/cli` and the site to 1.64.
- Decide the peer range: keep `>=1.59.0` if 1.59 still works, otherwise raise it and say so in the changelog and the docs.
- Run `dta diff` on the website with base and head both on 1.64 (no token change): it must report zero changed stories.
- Then base on 1.59, head on 1.64, to see what users see when the renderer moves under them; record the result.

## Acceptance criteria

- [ ] Safety check of the spec green, including both e2e jobs
- [ ] Same-version run: zero changed stories
- [ ] Mixed-version result recorded in the notes; if stories change, the docs explain that a renderer update can show up as a diff
- [ ] Example workflows (`actions/examples/`) and the guide name the right version

## Notes
