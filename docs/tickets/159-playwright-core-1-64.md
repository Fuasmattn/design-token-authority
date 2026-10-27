# TICKET-159: `playwright-core` 1.59 → 1.64

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** done (2026-10-26, #40)
**Spec:** [maintenance](../specs/maintenance.md) (decision 4)

## Problem

`playwright-core` ships its own Chromium. A newer Chromium can render fonts, antialiasing or layout slightly differently, so `dta diff` may report changes that are not token changes. It is used by `@dta/cli` (`dta diff`, a peer dependency `>=1.59.0`), the site's e2e tests and the example workflows.

## What to build

- Bump the pinned dev version in `@dta/cli` and the site to 1.64.
- Decide the peer range: keep `>=1.59.0` if 1.59 still works, otherwise raise it and say so in the changelog and the docs.
- Run `dta diff` on the website with base and head both on 1.64 (no token change): it must report zero changed stories.
- Then base on 1.59, head on 1.64, to see what users see when the renderer moves under them; record the result.

## Acceptance criteria

- [x] Safety check of the spec green, including both e2e jobs (locally against one Chromium; see Notes)
- [x] Same-version run: zero changed stories (`dta diff --base HEAD` locally; and on the pull request's CI the `diff-e2e` job, which renders two commits of a fixture site with the downloaded Chromium 156 and compares real screenshots, passed)
- [ ] Mixed-version result recorded in the notes; if stories change, the docs explain that a renderer update can show up as a diff
- [x] Example workflows (`actions/examples/`) and the guide name the right version (none pin a number: `init --diff` and the examples install `latest`)

## Notes

Outcome (2026-10-26):

- Dev pins `@dta/cli` and `site`: 1.59.1 → 1.64.1. The bundled Chromium moves from 147 (build 1217) to 156 (build 1248).
- **Peer range stays `>=1.59.0`.** Typecheck and every test pass on the 1.64 API without a code change, so nothing DTA calls moved; users on 1.59 are not forced to update.
- **What the local check could and could not prove.** The sandbox cannot download browsers, so all local runs (unit, site e2e, `dta diff` e2e, `dta diff --base HEAD` on the website) used one preinstalled Chromium (build 1243) through `DTA_BROWSER_PATH`. That proves API compatibility and that same-browser runs are stable. It does not compare Chromium 147 with 156. That comparison is what the pull request's CI does: the `diff-e2e` job renders real screenshots with the downloaded 1.64 browser, and the site's `dta diff` check compares the branch (1.64) against main (1.59). Record its result here before merging: 0 changed stories means the renderer move is invisible; changed stories mean users will see a one-time diff when they update, and the guide gets a line about it.
- **CI of the pull request (run 40401260261): green**, including `diff-e2e` with the downloaded 1.64 Chromium (156), so the same-version path holds on the real browser too. Still open: the mixed-version comparison, which is the site's `dta diff` check on the pull request (this branch on 156 against main on 147); it runs once the maintainer touches the pull request.
