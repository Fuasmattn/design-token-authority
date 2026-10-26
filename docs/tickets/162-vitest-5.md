# TICKET-162: Vitest 4 → 5

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** in review (2026-10-26), branch `162-vitest-5`
**Spec:** [maintenance](../specs/maintenance.md)

## What to build

- Bump `vitest` and `@vitest/coverage-v8` together to 5.x.
- Follow the migration guide for the workspace config (`vitest.config.ts`, one project per package plus `site` and `scripts/guardrails`), the snapshot runner (`snapshot:check`) and the e2e projects.
- No test is skipped, loosened or deleted to make the upgrade pass.

## Acceptance criteria

- [x] Same number of test files and tests before and after (compare the summaries)
- [x] Safety check of the spec green, including `snapshot:check` and both e2e jobs
- [x] `pnpm test:coverage` still works

## Notes

Outcome (2026-10-26). `vitest` and `@vitest/coverage-v8` 4.1.12 → 5.0.5 in the root, the eight packages and the site; no config or test changed.

- Same counts before and after: 123 test files passed, 1 skipped; 1830 tests passed, 5 skipped. Nothing loosened, nothing lost.
- Vitest 5 clears mocks before each test and fails unawaited `.resolves` / `.rejects`: the suite had neither problem.
- Config discovery no longer walks up: not an issue here, every invocation runs from a folder with its own `vitest.config.ts` (root, `site/`) or from the root with `--project`. `snapshot:check`, `test:contrast`, the `dta diff` e2e and the create-dta project all ran as before.
- Coverage: 90.99 % statements overall, same report shape.
- Requires Node.js 22.12+ and Vite 6.4+: the repository is on Node 24 and Vite 8.
