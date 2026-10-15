# TICKET-045: Figma: export variables to the token model

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040, TICKET-044
**Status:** ready-for-agent
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

`variablesToModel(response, options?)`: convert a validated local-variables response (from `parseVariablesResponse`) into a `@dta/core` token model, replacing legacy `token_export.ts`.

## Acceptance Criteria

- [ ] Every collection, mode, variable and per-mode value of `test/recordings/brand-ab/variables-local.json` becomes the same model as `parseTokenFiles` produces from `test/fixtures/brand-ab/tokens` (compared semantically, ignoring empty descriptions), so serializing it gives the fixture files
- [ ] Collection and mode order follow Figma; variable names split on `/` into path segments; aliases become `{Group.Token}` dot references; colors become hex via core
- [ ] Remote variables are skipped; an alias to an unknown variable id, an unsupported value shape or an unknown resolved type each produce a diagnostic and skip only that value
- [ ] `options.existing` reuses the sources of an existing model so untouched files serialize byte-identical
- [ ] Output file shape matches legacy (`$description` always, `com.figma` with `hiddenFromPublishing`, `scopes`, `codeSyntax`)
- [ ] Tests only through the public API; legacy `token_export.test.ts` cases re-expressed
- [ ] 039 parity table: `token_export.ts` row updated
- [ ] All gates pass, and the GitHub run is green
