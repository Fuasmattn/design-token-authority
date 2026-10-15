# TICKET-036: New CLI skeleton and golden-file runner

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033, TICKET-035
**Status:** ready-for-agent
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A minimal `@dta/cli` that loads and validates `dta.config.ts` (with `defineConfig`, JSON fallback) and dispatches commands, plus the CLI-seam test: it runs new-CLI commands against each fixture project and compares written files and stdout with the goldens. Commands not yet ported are on an explicit pending list so CI stays green.

## Acceptance Criteria

- [ ] `@dta/cli` runs locally from the workspace; it is not published and does not claim the `dta` binary
- [ ] Config is loaded from TypeScript or JSON and validated with clear error messages
- [ ] The golden runner compares files and stdout per fixture and command, with readable diffs on failure
- [ ] A pending list marks unported commands; removing an entry makes that command's goldens mandatory
- [ ] Intentional output changes are made by updating goldens in the same PR
