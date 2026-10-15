# TICKET-035: Capture legacy snapshots

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-034
**Status:** in review
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A repeatable script that runs the legacy pipeline (`build`, `lint`, `graph` console and HTML) on each fixture project and stores every written file and the stdout as snapshots. The snapshots become the parity reference for the rewrite.

## Acceptance Criteria

- [x] One command regenerates all snapshots from the legacy pipeline
- [x] Snapshots are committed and organized per fixture and per command
- [x] Output is deterministic: running the script twice produces no diff (timestamps, absolute paths and similar are normalized)
- [x] Known legacy quirks discovered while capturing are listed in `test/snapshots/README.md`, not fixed
