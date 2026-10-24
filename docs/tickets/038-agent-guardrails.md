# TICKET-038: Agent guardrails for the overhaul

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** XS
**Blocked by:** TICKET-033
**Status:** done (in review)
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

Guardrails so coding agents can work through overhaul tickets in a loop safely: CI fails when the frozen legacy source changes, and CLAUDE.md explains the new workflow.

## Acceptance Criteria

- [x] CI fails if a PR modifies legacy source, unless explicitly labeled as an approved exception
- [x] CI fails if a package imports another package's internals instead of its public API
- [x] CLAUDE.md has a section on the overhaul: spec and ADR links, package rules, test seams and the CI gates every ticket must pass

## Implementation notes

- `scripts/guardrails/legacy-frozen.ts` + `.github/workflows/guardrails.yml` (pull requests): diffs against the PR base and fails if anything under `src/` changed, unless the PR has the `legacy-exception` label. The workflow also re-runs when labels change.
- `scripts/guardrails/package-boundaries.ts` (`pnpm run guardrails:boundaries`, also in `test.yml`): fails on `@dta/x/...` deep imports and on relative imports that leave a package. Comments are ignored; the guardrail's own tests are excluded because they contain sample violations.
- Both checks are covered by tests in `scripts/guardrails/guardrails.test.ts` (own `guardrails` Vitest project).
- CLAUDE.md has a new "Token Engine Overhaul" section: rules, test seams, gates.
- To enforce the label gate, mark the "Guardrails / legacy-frozen" check as required in the branch protection settings (GitHub setting, not code).
