# TICKET-067: Remove `@dta/docs` and the generated token docs page

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** S
**Blocked by:** 039
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 1)

## What to build

`dta build` no longer writes `output/docs/index.html`. A config that still has `outputs.docs` fails to load with a message saying the key was removed in v2 and can be deleted. `init` no longer opens a docs page, `clean` no longer lists `output/docs` as a default. The package is gone.

## Acceptance criteria

- [ ] `packages/docs` deleted; `@dta/cli` no longer depends on it; lockfile updated
- [ ] `brand-ab/build` and `daisyui/build` re-recorded with `pnpm snapshot:record --scenario …`; the diff contains only the docs file and its summary line; every other scenario unchanged
- [ ] `outputs.docs` → exit 2 with the targeted message (CLI test); fixture configs drop the key
- [ ] `init` ends without opening a file; `clean` defaults are `output/css`, `output/js`, `output/tailwind` (tests updated)
- [ ] Migration note, README, CLAUDE.md package list and the 039 row of the docs generator ("dropped: Epic 7 spec, decision 1") updated
- [ ] All gates pass, and the GitHub run is green
