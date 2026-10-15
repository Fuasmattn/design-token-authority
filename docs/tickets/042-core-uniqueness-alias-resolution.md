# TICKET-042: Core: name uniqueness and alias resolution with mode selection

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040
**Status:** ready-for-agent
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Enforce the 'variable names are unique across collections' invariant and resolve aliases through a mode selection (Figma-style), replacing legacy's first-file-wins lookup.

## Acceptance Criteria

- [ ] Duplicate token names across collections produce an error diagnostic (from parse or a dedicated check)
- [ ] `resolve(model, name, selection?)` returns the final value and the alias chain; `selection` maps collection → mode, default each collection's first mode
- [ ] Alias target is found by unique name; its value is read in the mode selected for the target's collection (covers Brand → Primitives and ScreenType → Brand cases on the fixtures)
- [ ] Cycles, dangling aliases and type mismatches (alias to a different `$type`) return diagnostics instead of throwing or looping
- [ ] Alias to a name that is a group (not a token) is a dangling diagnostic
- [ ] Tests only through the public API, using both fixtures
- [ ] All gates pass
