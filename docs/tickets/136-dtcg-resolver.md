# TICKET-136: Resolver documents

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** 133, 135
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 7, 12; slice 5)

## What to build

- Reader for `*.resolver.json` (version `2025.10`): `sets`, `modifiers` (`contexts`, `default`), `resolutionOrder` with `$ref` to root sets and modifiers or inline items (`name`, `type`); sources as inline tokens or `$ref` to files relative to the resolver; sibling keys next to `$ref` replace shallowly; `$defs` ignored.
- Validation with the report's error list (missing `resolutionOrder`, zero contexts, `default` not a context, modifier referenced from a set or modifier, pointer into `resolutionOrder`, unresolvable or circular references).
- Mapping onto the model: sets → single-mode collections, modifiers → multi-mode collections with one mode per context and `default` as default mode; overridden tokens move into the modifier's collection with a value per context.
- Inputs: `brands` selects the brand modifier's contexts; a new `modifiers` config key selects others; unknown keys, unknown contexts and missing required modifiers are errors.
- Discovery: exactly one `*.resolver.json` in `tokens.dir` is used automatically, `tokens.resolver` in the config wins, several without it are an error listing them; files outside the resolver's sets are a warning.
- Until TICKET-137: a token overridden by two modifiers is a clear error naming both.

## Acceptance criteria

- [ ] Package tests for every error condition and for the report's example resolver
- [ ] A resolver fixture with one modifier: `lint`, `build`, `graph`, `token get` recorded by name
- [ ] Config reference generated with the new keys
- [ ] All gates pass, and the GitHub run is green
