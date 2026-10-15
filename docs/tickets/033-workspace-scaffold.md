# TICKET-033: pnpm workspace scaffold

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** S
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md) · ADRs 0001, 0002

## What to build

A pnpm workspace next to the frozen legacy code, with a first `@dta/core` package that exposes one small public function and tests it through that public API. CI runs the quality gates across the whole workspace, and everything that works today keeps working.

## Acceptance Criteria

- [ ] Repo uses pnpm workspaces; `packages/*` is a workspace glob
- [ ] `@dta/core` exists, ESM only, Node 24+, and exposes exactly one public entry point
- [ ] One test exercises `@dta/core` through its public entry point only
- [ ] CI runs typecheck, Vitest and Prettier for the workspace on every push
- [ ] Legacy tests and legacy `dta` commands still pass unchanged
- [ ] Changesets is set up in fixed mode for `@dta/*` packages; no package is published
