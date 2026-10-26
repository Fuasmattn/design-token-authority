# TICKET-163: commander 14 → 15

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

commander parses every `dta` command (`packages/cli/src/run.ts`). A change in option parsing, help output or exit codes reaches every user, and the generated Commands reference is built from `--help`.

## What to build

- Bump in `@dta/cli` and the root package (bundled into the npm package).
- Read the release notes for changes to option parsing, help formatting, exit codes and error messages.

## Acceptance criteria

- [ ] `dta --help` and every subcommand's `--help` byte-identical before and after (diff them)
- [ ] Exit codes unchanged (the Exit codes reference and its tests)
- [ ] Generated Commands reference unchanged after `pnpm site:build`
- [ ] Safety check of the spec green; no snapshot re-recorded

## Notes
