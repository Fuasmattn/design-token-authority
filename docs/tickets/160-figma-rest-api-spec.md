# TICKET-160: `@figma/rest-api-spec` 0.37 → 0.46

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** done (2026-10-26, #50)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

The Figma API types are nine 0.x versions behind; 0.x minors can rename or tighten types. They are used in `@dta/figma` (client, planning, prune) and the Figma fake in `@dta/testkit`.

## What to build

- Bump in `@dta/figma` and `@dta/testkit`, then fix type errors at the source.
- Read the changelog for the variables endpoints (`/v1/files/:key/variables/local`, `POST .../variables`): new fields, new variable types, new scopes.
- The Zod schemas in `@dta/figma` (`schemas.ts`) stay the runtime check; where the types and the schemas disagree, the schemas follow what Figma returns in `test/recordings/`.
- New scopes or variable types Figma added: list them in the notes; supporting them is a separate ticket.

## Acceptance criteria

- [x] Typecheck green without `any` or casts added to silence errors
- [x] Safety check of the spec green; recordings and snapshots unchanged
- [x] Notes list relevant API additions

## Notes

Outcome (2026-10-26). `@figma/rest-api-spec` 0.37.0 → 0.46.0 in `@dta/figma` and `@dta/testkit`.

**What changed in the variables API** (compared the generated types): no new fields on `LocalVariable` or the collections; one new scope, `COLOR_OPACITY`; one new value shape, `VariableComposedColor`, a colour whose opacity is authored apart as an alias or a number (`{ color, opacity }`). Everything else DTA reads is unchanged.

**What the compiler found.** The compile-time guard in `client.test.ts` ("whatever the official type allows, our schema accepts") failed on the new value shape, then `planning.ts` and `prune.ts` narrowed the union and would have passed a composed colour to `toHex`. Fixed at the source, no casts:

- `schemas.ts`: `ComposedColor` accepted in `VariableValue`, so a file that uses the feature still pulls.
- `export.ts`: a composed colour is left out with the warning `composed-color`, naming the feature; the other modes of the variable convert as before (test added).
- `planning.ts`: `NewValue` excludes composed colours (DTA never pushes one); one in Figma always counts as a change; shown as "(composed colour)".
- `prune.ts`: shown as "(composed colour)".
- Scopes are `z.array(z.string())`, so `COLOR_OPACITY` passes through to `$extensions['com.figma'].scopes` untouched.

Modelling composed colours properly is TICKET-171 (a feature: not planned until the maintainer says so). Recordings and snapshots unchanged.
