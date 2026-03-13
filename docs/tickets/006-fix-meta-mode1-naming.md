# TICKET-006: Fix default mode name in meta token collection

**Phase:** 1 — Foundation (Housekeeping)
**Priority:** Low
**Effort:** XS

## Summary

The file `meta.Mode1.json` uses `Mode1` — Figma's default, auto-assigned mode name. This indicates the mode was never explicitly named in Figma, which is a token hygiene issue and will cause problems with autodiscovery (TICKET-011).

## Background

The filename convention is `{Collection}.{Mode}.json`. Mode names are derived directly from Figma. `Mode1` is what Figma assigns automatically when a collection is created and the mode isn't renamed. It carries no semantic meaning.

This is the exact type of naming drift that token linting (TICKET-010) should catch automatically.

## Acceptance Criteria

- [ ] The `meta` collection's mode is renamed to something meaningful in Figma (e.g. `Default`, `Global`, or `Base`)
- [ ] The token file is re-exported and renamed accordingly (e.g. `meta.Default.json`)
- [ ] All alias references that point into this file remain valid after the rename

## Notes

This is a one-line Figma UI change but requires a re-export and a PR to update the token file. A good candidate to batch with the next routine `sync-figma-to-tokens` run.

## Dependencies

- None (but will be caught automatically once TICKET-010 linting is in place)
