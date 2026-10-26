# TICKET-162: Vitest 4 → 5

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## What to build

- Bump `vitest` and `@vitest/coverage-v8` together to 5.x.
- Follow the migration guide for the workspace config (`vitest.config.ts`, one project per package plus `site` and `scripts/guardrails`), the snapshot runner (`snapshot:check`) and the e2e projects.
- No test is skipped, loosened or deleted to make the upgrade pass.

## Acceptance criteria

- [ ] Same number of test files and tests before and after (compare the summaries)
- [ ] Safety check of the spec green, including `snapshot:check` and both e2e jobs
- [ ] `pnpm test:coverage` still works

## Notes
