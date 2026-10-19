# TICKET-117: Make `outputs.css.prefix` work (or remove it)

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** M
**Blocked by:** —
**Status:** open

## Problem

The config schema has `outputs.css.prefix`, but `dta build` ignores it (found in TICKET-079, 2026-10-19). A key that does nothing is a broken promise; the playground does not offer it for that reason.

## What to build

Either implement the prefix end to end (CSS and Tailwind v4 variable names, and everything that reads them: `dta diff` attribution, `dta audit`, `dta token get`), with snapshot changes recorded by name, or remove the key from the schema with a clear config error. Then offer it in the playground's output options (079) if implemented.

## Acceptance criteria

- [ ] Prefix implemented across build and the commands that read variable names, or removed with a migration note
- [ ] Playground option added if implemented; generated config carries it
- [ ] All gates pass, and the GitHub run is green
