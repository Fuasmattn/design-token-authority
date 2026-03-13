# TICKET-001: Remove committed credentials and secure .env handling

**Phase:** 1 — Foundation (Immediate Fix)
**Priority:** Critical
**Effort:** XS

## Summary

The `.env` file containing a live Figma Personal Access Token and file key is committed to the repository. This must be fixed before any other work.

## Background

The current `.env` file contains:
```
FILE_KEY=<live value>
PERSONAL_ACCESS_TOKEN=<live value>
```

Even on a private repository, committing secrets is a bad practice — it leaks credentials into git history, CI logs, and any future forks. The token should be considered compromised and rotated.

## Acceptance Criteria

- [ ] `.env` is added to `.gitignore`
- [ ] An `.env.example` file is committed with placeholder values and comments explaining each variable
- [ ] The live Figma PAT is rotated in Figma (Settings → Personal Access Tokens)
- [ ] `README` documents how to set up local credentials (copy `.env.example` → `.env`, fill in values)
- [ ] CI workflows consistently use the GitHub secret `FIGMA_PERSONAL_ACCESS_TOKEN` (see TICKET-005)

## Implementation Notes

`.env.example`:
```env
# Figma file key — found in the Figma file URL: figma.com/file/<FILE_KEY>/...
FIGMA_FILE_KEY=

# Figma Personal Access Token — generate at figma.com > Settings > Personal access tokens
FIGMA_PERSONAL_ACCESS_TOKEN=
```

`.gitignore` addition:
```
.env
.env.local
```

## Dependencies

- TICKET-005 (standardize secret names) — do both together to avoid a second round of changes
