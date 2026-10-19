# TICKET-118: `dta init` writes `outputs.formats`

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** S
**Blocked by:** —
**Status:** open

## Problem

`dta init` asks which outputs a project wants, but writes keys that only move folders. Since TICKET-079 the build can choose formats (`outputs.formats`), so the wizard's answer can actually take effect.

## Acceptance criteria

- [ ] `dta init` writes `outputs.formats` from the wizard's answer; snapshots of `init` re-recorded by name
- [ ] Docs (Start, Configuration reference) show the key
- [ ] All gates pass, and the GitHub run is green
