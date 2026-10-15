# TICKET-038: Agent guardrails for the overhaul

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** XS
**Blocked by:** TICKET-033
**Status:** ready-for-agent
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

Guardrails so coding agents can work through overhaul tickets in a loop safely: CI fails when the frozen legacy source changes, and CLAUDE.md explains the new workflow.

## Acceptance Criteria

- [ ] CI fails if a PR modifies legacy source, unless explicitly labeled as an approved exception
- [ ] CI fails if a package imports another package's internals instead of its public API
- [ ] CLAUDE.md has a section on the overhaul: spec and ADR links, package rules, test seams and the CI gates every ticket must pass
