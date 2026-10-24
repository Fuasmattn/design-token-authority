# TICKET-045: Figma: export variables to the token model

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040, TICKET-044
**Status:** done
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

`variablesToModel(response, options?)`: convert a validated local-variables response (from `parseVariablesResponse`) into a `@dta/core` token model, replacing legacy `token_export.ts`.

## Acceptance Criteria

- [x] Every collection, mode, variable and per-mode value of `test/recordings/brand-ab/variables-local.json` becomes the same model as `parseTokenFiles` produces from `test/fixtures/brand-ab/tokens` (compared semantically, ignoring empty descriptions), so serializing it gives the fixture files
- [x] Collection and mode order follow Figma; variable names split on `/` into path segments; aliases become `{Group.Token}` dot references; colors become hex via core
- [x] Remote variables are skipped; an alias to an unknown variable id, an unsupported value shape or an unknown resolved type each produce a diagnostic and skip only that value
- [x] `options.existing` reuses the sources of an existing model so untouched files serialize byte-identical
- [x] Output file shape matches legacy (`$description` always, `com.figma` with `hiddenFromPublishing`, `scopes`, `codeSyntax`)
- [x] Tests only through the public API; legacy `token_export.test.ts` cases re-expressed
- [x] 039 parity table: `token_export.ts` row updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/figma/src/export.ts`; public API `variablesToModel(response, { existing? })` → `{ model, diagnostics }`.
- Diagnostic codes (all leave out only the affected value): `unresolved-alias`, `invalid-value`, `missing-value` (warnings), `duplicate-mode-name` (error). A collection without local variables yields nothing, like legacy.
- With `existing`, serializing the exported recording reproduces all six fixture files byte for byte; changing one color in Figma changes only `Primitives.Value.json`.
- Small core change made for this: `serializeTokenFiles` now treats an empty description as no description when deciding whether metadata changed (Figma reports `''`), so untouched entries are not rewritten. New tokens still get `$description: ''`, the legacy shape.
- Mode and collection order follow Figma; token order follows the variable order in the response.
- Legacy `token_export.test.ts` cases (remote skipped, token files, hex colors, metadata, alias dot form) are re-expressed through the public API.
- 039 parity table: `token_export.ts` is covered here; the file is deleted with its last legacy importer (`pull`).
