# TICKET-046: Figma: plan a push (payload and structured changes)

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** L
**Blocked by:** TICKET-042, TICKET-045
**Status:** ready-for-agent
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

`planPush(model, response)`: compare the token model with Figma's current local variables and return the POST payload plus a structured list of changes, replacing the payload generation in `token_import.ts`. Nothing is sent here.

## Acceptance Criteria

- [ ] Returns `{ payload, changes, diagnostics }`; for the unchanged BrandA/BrandB model against its recording there are no changes and no payload
- [ ] Change kinds: create collection, create mode, create variable, update value, update metadata (description, scopes, `hiddenFromPublishing`, `codeSyntax`); each change names collection, mode (where relevant), variable name and the old and new values
- [ ] An edited color produces exactly one update-value change and a payload equal to what legacy sends for the same edit (alpha omitted when 1, as in the TICKET-037 test)
- [ ] A new variable, a new mode and a new collection use temporary ids and the initial-mode rules legacy applies; aliases to variables created in the same payload resolve through those temp ids
- [ ] **Never deletes:** a property-style test shows variables and modes present in Figma but missing from the model produce no operation at all
- [ ] Colors compare approximately (no spurious updates from float noise)
- [ ] Duplicate variable names across collections are an error diagnostic and block the payload; unknown alias targets are a diagnostic (Figma would return 400)
- [ ] Tests only through the public API; legacy `token_import.test.ts` cases re-expressed
- [ ] 039 parity table: `token_import.ts` and `push` rows updated
- [ ] All gates pass, and the GitHub run is green
