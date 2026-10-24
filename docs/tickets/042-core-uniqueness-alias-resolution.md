# TICKET-042: Core: name uniqueness and alias resolution with mode selection

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040
**Status:** done
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Enforce the 'variable names are unique across collections' invariant and resolve aliases through a mode selection (Figma-style), replacing legacy's first-file-wins lookup.

## Acceptance Criteria

- [x] Duplicate token names across collections produce an error diagnostic (dedicated `checkUniqueNames(model)`; callers combine it with parse diagnostics)
- [x] `resolve(model, name, selection?)` returns the final value and the alias chain; `selection` maps collection → mode, default each collection's first mode
- [x] Alias target is found by unique name; its value is read in the mode selected for the target's collection (covers Brand → Primitives and ScreenType → Brand cases on the fixtures)
- [x] Cycles, dangling aliases and type mismatches (alias to a different `$type`) return diagnostics instead of throwing or looping
- [x] Alias to a name that is a group (not a token) is a dangling diagnostic
- [x] Tests only through the public API, using both fixtures
- [x] All gates pass

## Implementation notes

- `packages/core/src/resolve.ts`; public API: `checkUniqueNames`, `resolve`, types `ModeSelection`, `ResolveResult`, `ResolveStep`.
- `resolve` returns `{ ok: true, value, type, chain }` or `{ ok: false, diagnostics, chain }`. Diagnostic codes: `unknown-token`, `dangling-alias`, `circular-alias`, `alias-type-mismatch`, `missing-value`, `unknown-mode`, `duplicate-name` (from the check).
- Alias targets are matched on the dot form of the name, so segments that contain dots (e.g. `size.4.5`) resolve.
- Resolution is iterative (a 2000-link chain is fine) and cycle-safe.
- Both fixtures have no duplicate names.
- 039: the alias-resolution part of `token_import.ts` is covered here; the Figma payload part stays with `@dta/figma`.
