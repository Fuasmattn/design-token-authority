# TICKET-092: `color-contrast` per mode, through aliases

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** open

## What to build

`color-contrast` checks every configured pair in every mode (each brand, light and dark), with aliases resolved. Today it compares raw hex tokens only and the last mode read wins (a v1 quirk pinned by the parity tests, documented on the Lint rules page, 072).

## Acceptance criteria

- [ ] Pairs resolve through aliases in each mode of the collection that defines them; a violation names the mode
- [ ] The v1 quirk test is replaced by the new behaviour; the `lint` snapshot of `brand-ab` re-recorded if its output changes, reviewed
- [ ] Lint rules page updated; all gates pass, and the GitHub run is green
