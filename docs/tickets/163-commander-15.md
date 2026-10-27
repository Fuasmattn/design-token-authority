# TICKET-163: commander 14 → 15

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** in review (2026-10-26), branch `163-commander-15`
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

commander parses every `dta` command (`packages/cli/src/run.ts`). A change in option parsing, help output or exit codes reaches every user, and the generated Commands reference is built from `--help`.

## What to build

- Bump in `@dta/cli` and the root package (bundled into the npm package).
- Read the release notes for changes to option parsing, help formatting, exit codes and error messages.

## Acceptance criteria

- [x] `dta --help` and every subcommand's `--help` byte-identical before and after (diff them)
- [x] Exit codes unchanged (the Exit codes reference and its tests)
- [x] Generated Commands reference unchanged after `pnpm site:build`
- [x] Safety check of the spec green; no snapshot re-recorded

## Notes

Outcome (2026-10-26). `commander` 14.0.3 → 15.0.0 in `@dta/cli` and the root (bundled into the npm package).

- 19 `--help` outputs (root and every command and subcommand) captured on 14 and on 15: byte-identical. Exit codes for an unknown command and an unknown option: 1 before and after; the error text unchanged.
- 15's breaking changes checked against the code: it is ESM-only (DTA's CLI is ESM and the bundle builds; the packed CLI runs in the create-dta test); it needs Node 22.12+ (DTA needs 24); a lone `--no-*` option no longer implies a default when the positive form exists too (DTA defines no `--no-*` option). Error messages now name excess command arguments: no snapshot changed, so no scenario hits it.
- CLI snapshots (real parsing on every command on the fixtures) unchanged; the generated Commands reference unchanged after `site:build`.
