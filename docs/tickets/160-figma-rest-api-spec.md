# TICKET-160: `@figma/rest-api-spec` 0.37 → 0.46

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

The Figma API types are nine 0.x versions behind; 0.x minors can rename or tighten types. They are used in `@dta/figma` (client, planning, prune) and the Figma fake in `@dta/testkit`.

## What to build

- Bump in `@dta/figma` and `@dta/testkit`, then fix type errors at the source.
- Read the changelog for the variables endpoints (`/v1/files/:key/variables/local`, `POST .../variables`): new fields, new variable types, new scopes.
- The Zod schemas in `@dta/figma` (`schemas.ts`) stay the runtime check; where the types and the schemas disagree, the schemas follow what Figma returns in `test/recordings/`.
- New scopes or variable types Figma added: list them in the notes; supporting them is a separate ticket.

## Acceptance criteria

- [ ] Typecheck green without `any` or casts added to silence errors
- [ ] Safety check of the spec green; recordings and snapshots unchanged
- [ ] Notes list relevant API additions

## Notes
