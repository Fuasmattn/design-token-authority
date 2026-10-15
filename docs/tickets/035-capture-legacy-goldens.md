# TICKET-035: Capture legacy golden outputs

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-034
**Status:** ready-for-agent
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A repeatable script that runs the legacy pipeline (`build`, `lint`, `graph` console and HTML) on each fixture project and stores every written file and the stdout as golden files. The goldens become the parity reference for the rewrite.

## Acceptance Criteria

- [ ] One command regenerates all goldens from the legacy pipeline
- [ ] Goldens are committed and organized per fixture and per command
- [ ] Output is deterministic: running the script twice produces no diff (timestamps, absolute paths and similar are normalized)
- [ ] Known legacy quirks discovered while capturing are listed in the ticket or spec notes, not fixed
