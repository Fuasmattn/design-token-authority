# TICKET-167: release-it 19 → 21 and conventional-changelog 10 → 12

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

release-it runs the Release workflow (versions, changelog, tag, npm publish with trusted publishing, `.release-it.json`). A broken release is only noticed when publishing. The `basic-ftp` advisory ignored in `pnpm-workspace.yaml` comes in through release-it; release-it 21 still pulls `basic-ftp` 5 (via `proxy-agent` → `get-uri`), so the ignore stays for now.

## What to build

- Bump `release-it` and `@release-it/conventional-changelog` together; adapt `.release-it.json` to any renamed options.
- Dry run: `pnpm release-it --dry-run --ci` (no tag, no publish) and compare the planned version, changelog entry and steps with the last real release.

## Acceptance criteria

- [ ] Dry run plans the same steps as before; changelog entry formatted like the existing ones
- [ ] `pnpm audit` result unchanged; the ignore comment updated with the checked versions
- [ ] Safety check of the spec green
- [ ] The next real release run is watched by the maintainer

## Notes
