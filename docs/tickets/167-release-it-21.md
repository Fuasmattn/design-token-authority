# TICKET-167: release-it 19 → 21 and conventional-changelog 10 → 12

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** done (2026-10-26, #50)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

release-it runs the Release workflow (versions, changelog, tag, npm publish with trusted publishing, `.release-it.json`). A broken release is only noticed when publishing. The `basic-ftp` advisory ignored in `pnpm-workspace.yaml` comes in through release-it; release-it 21 still pulls `basic-ftp` 5 (via `proxy-agent` → `get-uri`), so the ignore stays for now.

## What to build

- Bump `release-it` and `@release-it/conventional-changelog` together; adapt `.release-it.json` to any renamed options.
- Dry run: `pnpm release-it --dry-run --ci` (no tag, no publish) and compare the planned version, changelog entry and steps with the last real release.

## Acceptance criteria

- [x] Dry run plans the same steps as before; changelog entry formatted like the existing ones
- [x] `pnpm audit` result unchanged; the ignore comment updated with the checked versions
- [x] Safety check of the spec green (release tooling is dev-only; the browser e2e jobs were not re-run for it)
- [x] The next real release run is watched by the maintainer

## Notes

Outcome (2026-10-26). `release-it` 19.2.4 → 21.1.1, `@release-it/conventional-changelog` 10.0.6 → 12.0.2. `.release-it.json` needed no change.

**Dry run, 19 against 21** (`release-it minor --dry-run --ci`, hooks, GitHub release and npm off, so no 12-minute test run inside): with the previous release tagged, as it always is in the repository, the plan (`2.4.1 → 2.5.0`), the changelog entry (Features, Bug Fixes, Documentation; chore hidden) and the steps (changelog, commit, annotated tag, push) are **identical**. One wording change in the new changelog plugin: a merge commit's `#32` is written as "references #32" instead of "closes #32", which is the more accurate word for a merge. A first dry run without the tag showed the previous `chore: release` commit leaking into the changelog on 21; that only happens when the previous release is not tagged (a shallow clone), never in the Release workflow. Worth knowing if someone runs `release:dry` in a fresh shallow checkout.

**Audit.** release-it 21 pulls `undici` 7.29.1, which carries three advisories (two moderate, one high, all fixed in 7.30.1); `pnpm audit` and the release hook's `pnpm audit --prod` would fail. Raised with an override `undici@>=7 <7.30.1: ^7.30.1`, following the TICKET-140 convention. The audit is back to the one known ignored advisory (`basic-ftp`, still reached through release-it > proxy-agent > get-uri; the ignore stays, comment unchanged since the chain is the same).

**Overrides dropped** because release-it 21's tree no longer contains them at all: `handlebars`, `lodash`, `undici@6`. The others (`defu`, `basic-ftp`, `ip-address`, `qs`, the site and coverage ones) still resolve and stay.

The next real release run is the maintainer's to watch (last acceptance item).

**First real run (2.4.2, 2026-10-27):** release-it 21 published both packages, then its push to `main` was refused: #51 had merged while the run was going. Not a release-it problem. Finished by hand: the release commit through #52, then the maintainer tagged `v2.4.2` and published the GitHub release. Lesson: merge nothing while the Release workflow runs; a re-run would fail, because npm refuses a second publish of the same version.
