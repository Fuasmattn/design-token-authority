# TICKET-005: Standardize environment variable and CI secret names

**Phase:** 1 — Foundation (Housekeeping)
**Priority:** Medium
**Effort:** XS

## Summary

The local `.env` uses `PERSONAL_ACCESS_TOKEN` and `FILE_KEY`, while the GitHub Actions workflow uses `GH_ACTION_VARIABLES_SYNC_FIGMA_TOKEN`. Standardizing these reduces confusion when onboarding new projects or contributors.

## Background

Current inconsistency:
- Local (`.env`): `PERSONAL_ACCESS_TOKEN`, `FILE_KEY`
- GitHub Actions secret: `GH_ACTION_VARIABLES_SYNC_FIGMA_TOKEN`
- Source code (`figma_api.ts`, sync scripts): reads `PERSONAL_ACCESS_TOKEN`

This means: locally the code reads `PERSONAL_ACCESS_TOKEN`, but in CI the workflow maps `GH_ACTION_VARIABLES_SYNC_FIGMA_TOKEN` → `PERSONAL_ACCESS_TOKEN` via `env:` block. This intermediate mapping is easy to break.

## Acceptance Criteria

- [ ] Standardized names used everywhere: `FIGMA_PERSONAL_ACCESS_TOKEN` and `FIGMA_FILE_KEY`
- [ ] GitHub Actions secrets renamed (or mapping removed) to match
- [ ] `.env.example` uses the standardized names (see TICKET-001)
- [ ] All source files updated to read the new names
- [ ] `README` documents the required environment variables by their final names

## Proposed Standard Names

| Variable | Purpose |
|---|---|
| `FIGMA_PERSONAL_ACCESS_TOKEN` | Figma REST API authentication |
| `FIGMA_FILE_KEY` | Target Figma file identifier |

## Dependencies

- TICKET-001 (credentials cleanup) — do both in the same PR
