# TICKET-173: Dependabot's npm job fails on every run

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** XS
**Status:** in review (2026-10-27), branch `173-dependabot-holds`
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

Every npm run of Dependabot has failed since 2026-10-24 (the last green one was at `fa76efe`, the first red one at `9ebb0d2`). Dependabot marks the whole job failed when a single update is not possible, so a failure that is "expected" hides a real one, and nobody looks at the red runs any more. The GitHub Actions runs pass.

The run of 2026-10-27 (`15a7b7b`) lists three dependencies with `update_not_possible`:

1. `@figma/rest-api-spec`: the root `package.json` still asks for `^0.37.0`; TICKET-160 bumped `figma` and `testkit` to `^0.46.0` and missed it, so the lockfile carries both versions.
2. `typescript`: the site stays on 6.0.3 because `@astrojs/check` 0.9.12 allows `^5 || ^6` only (TICKET-161). Dependabot tries 7.
3. `astro`: held at 7.3.5 because 7.4 fetches each lazy playground tab's CSS twice (TICKET-156). Dependabot tries 7.4.2.

## What to build

- Root `package.json`: `@figma/rest-api-spec` `^0.46.0`; the lockfile drops 0.37.0.
- `.github/dependabot.yml`: ignore TypeScript majors (each major gets a ticket anyway) and `astro` 7.4.x, each with its reason and when to drop it.

## Acceptance criteria

- [x] Lockfile has one `@figma/rest-api-spec` (0.46.0)
- [x] Both holds in `dependabot.yml`, with the ticket that explains them
- [ ] The next weekly npm run of Dependabot is green (maintainer checks once)

## Notes

The log needs a login; the maintainer pasted its result table (2026-10-27). The `@types/node` ignore was already there. Astro 7.4.2 is out and may fix the double fetch; try it with the TICKET-124 budget test before dropping the `astro` ignore.
