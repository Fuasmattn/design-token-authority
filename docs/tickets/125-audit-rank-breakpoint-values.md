# TICKET-125: `dta audit` and `dta token find` rank breakpoint-only matches lower

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** S
**Blocked by:** 091
**Status:** in review

## Problem

Since 091, breakpoint tokens are built, so value lookups see them. On `brand-ab`, a hard-coded `16px` now makes `dta audit` suggest `Spacing.Gap` instead of `Dimensions.spacing.4`. But `Spacing.Gap` is 16px only in its Desktop mode, from 1024 px up; on phones it is smaller. Replacing `16px` with `var(--spacing-gap)` would change the page below 1024 px. The ranking (`findTokensByValue` in `packages/core/src/query.ts`, used by `dta audit`, `dta token find` and the agent skill) prefers built tokens with deeper alias chains and does not know about breakpoints (found in TICKET-091, see its Outcome).

## What to build

Proposal: a match is ranked by **where it holds**.

1. Tokens that have the value in every mode of the breakpoint collection (or are not in it) come first, as today.
2. Tokens that have the value only in the **default** breakpoint mode come next.
3. Tokens that have the value only in **non-default** breakpoint modes come last. `dta audit` never suggests them as the fix; `dta token find` still lists them, labelled with the mode and its media query (e.g. `Desktop (min-width: 1024px)`), so a person can still find them.

Within each group the existing ranking applies. Brand modes are not affected (a brand value is a fact of the chosen brand, not of the screen width).

## Acceptance criteria

- [x] Ranking as above in `@dta/core` (the breakpoint collection and default mode come from the `breakpoints` config, passed in as options; core stays config-free)
- [x] `brand-ab`: `16px` suggests `Dimensions.spacing.4` again; `dta token find 16px` lists `Spacing.Gap` last with its media query; `audit*` and `token-find*` snapshots re-recorded by name and reviewed
- [x] Without `breakpoints` in the config, output is unchanged
- [ ] Docs (Commands reference via `--help` text, the agents guide if it shows audit output) updated with real output; all gates pass, and the GitHub run is green

## Outcome

- `@dta/core`: `breakpointReach(model, name, holds, { collection, default })` reads the token at every breakpoint in every combination of the other collections its chain goes through, so each brand is judged on its own (a value one brand has at every width does not cover another brand that has it only on tablets; found in review). `every`: each brand that has the value has it at every breakpoint, also when the chain does not go through the breakpoint collection; `default`: each has it at least at the default; `other`: otherwise. A `default` that is not a mode of the collection turns the ranking off (`dta build` already warns about it) instead of dropping every match. `findTokensByValue(model, query, { breakpoints })` ranks by it before the alias depth and marks the matches with `breakpoint: 'default' | 'other'`. Core reads no config: the CLI passes `breakpoints.collection` and `breakpoints.default`.
- `dta token find`: the same ranking before "built first"; a mode with a media query is shown with it (`Desktop (min-width: 1024px)`), and the note under the list gives the order and says why those come last. JSON: the optional `breakpoint` field, in the published schema.
- `dta audit` (`audit/match.ts`): never suggests an `other` token, ranks `default` after `every`. On `brand-ab`, `16px` → `Dimensions.spacing.4` again.
- Snapshots re-recorded by name and reviewed: `brand-ab/token-find-json`, `audit`, `audit-json`, `audit-baseline` (the ranking) and `skill-add` (the skill copies the `dta token find` help text). Without `breakpoints` nothing changes: core test "without breakpoints, ranks as before", and the other fixtures' snapshots are unchanged.
- Docs: the `dta token find` section in Reference → Token queries, with real output from `brand-ab`; the help text (Commands reference). The audit outputs in the CI and coding-agents guides already showed `Dimensions.spacing.4` (they predate 091).
