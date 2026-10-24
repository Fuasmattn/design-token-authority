# TICKET-046: Figma: plan a push (payload and structured changes)

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** L
**Blocked by:** TICKET-042, TICKET-045
**Status:** done
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

`planPush(model, response)`: compare the token model with Figma's current local variables and return the POST payload plus a structured list of changes, replacing the payload generation in `token_import.ts`. Nothing is sent here.

## Acceptance Criteria

- [x] Returns `{ payload, changes, diagnostics }`; for the unchanged BrandA/BrandB model against its recording there are no changes and no payload
- [x] Change kinds: create collection, create mode, create variable, update value, update metadata (description, scopes, `hiddenFromPublishing`, `codeSyntax`); each change names collection, mode (where relevant), variable name and the old and new values
- [x] An edited color produces exactly one update-value change and a payload equal to what legacy sends for the same edit (alpha omitted when 1, as in the TICKET-037 test)
- [x] A new variable, a new mode and a new collection use temporary ids and the initial-mode rules legacy applies; aliases to variables created in the same payload resolve through those temp ids
- [x] **Never deletes:** a property-style test shows variables and modes present in Figma but missing from the model produce no operation at all
- [x] Colors compare approximately (no spurious updates from float noise)
- [x] Duplicate variable names across collections are an error diagnostic and block the payload; unknown alias targets are a diagnostic (Figma would return 400)
- [x] Tests only through the public API; legacy `token_import.test.ts` cases re-expressed
- [x] 039 parity table: `token_import.ts` and `push` rows updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/figma/src/planning.ts`; public API `planPush(model, response)` → `{ payload, changes, diagnostics }`. `payload` is `null` when there is nothing to do or an error diagnostic blocks it; `changes` is then empty for errors.
- Change kinds: `create-collection`, `create-mode`, `create-variable`, `update-value` (`from` is undefined for new variables/modes, `to` is the token-file value), `update-metadata` (`fields` lists description, scopes, hiddenFromPublishing, codeSyntax).
- Error diagnostics: `duplicate-name` (from core `checkUniqueNames`), `duplicate-collection` (Figma file), `unknown-alias-target`, `invalid-color`, `invalid-value`, `type-mismatch` (Figma cannot change a type), `remote-variable`. Legacy threw for some of these; the plan reports them instead. `invalid-metadata` (malformed `com.figma` extension) is a warning.
- Payload rules match legacy: name as temporary id, initial mode renamed for new collections, a variable is created once across modes, only properties the token defines are sent, colors compare approximately, alpha omitted when 1.
- Aliases resolve across all collections: model first, then Figma-only variables, so a model that is a subset of Figma still resolves.
- Never deletes: tests show subsets of the Figma state (fewer tokens, modes or collections) plan nothing.
- Legacy `token_import.test.ts` cases (initial sync, in-place update, no-ops, remote variable, alias to remote variable, duplicate collections) are re-expressed through the public API. Parsing token files is `@dta/core`, so `readJsonFiles` cases are covered there.
- 039 parity table: `token_import.ts` is covered here; the file is deleted with its last legacy importer (`push`).
