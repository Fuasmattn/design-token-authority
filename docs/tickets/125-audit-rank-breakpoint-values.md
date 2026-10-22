# TICKET-125: `dta audit` and `dta token find` rank breakpoint-only matches lower

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** S
**Blocked by:** 091
**Status:** open

## Problem

Since 091, breakpoint tokens are built, so value lookups see them. On `brand-ab`, a hard-coded `16px` now makes `dta audit` suggest `Spacing.Gap` instead of `Dimensions.spacing.4`. But `Spacing.Gap` is 16px only in its Desktop mode, from 1024 px up; on phones it is smaller. Replacing `16px` with `var(--spacing-gap)` would change the page below 1024 px. The ranking (`findTokensByValue` in `packages/core/src/query.ts`, used by `dta audit`, `dta token find` and the agent skill) prefers built tokens with deeper alias chains and does not know about breakpoints (found in TICKET-091, see its Outcome).

## What to build

Proposal: a match is ranked by **where it holds**.

1. Tokens that have the value in every mode of the breakpoint collection (or are not in it) come first, as today.
2. Tokens that have the value only in the **default** breakpoint mode come next.
3. Tokens that have the value only in **non-default** breakpoint modes come last. `dta audit` never suggests them as the fix; `dta token find` still lists them, labelled with the mode and its media query (e.g. `Desktop (min-width: 1024px)`), so a person can still find them.

Within each group the existing ranking applies. Brand modes are not affected (a brand value is a fact of the chosen brand, not of the screen width).

## Acceptance criteria

- [ ] Ranking as above in `@dta/core` (the breakpoint collection and default mode come from the `breakpoints` config, passed in as options; core stays config-free)
- [ ] `brand-ab`: `16px` suggests `Dimensions.spacing.4` again; `dta token find 16px` lists `Spacing.Gap` last with its media query; `audit*` and `token-find*` snapshots re-recorded by name and reviewed
- [ ] Without `breakpoints` in the config, output is unchanged
- [ ] Docs (Commands reference via `--help` text, the agents guide if it shows audit output) updated with real output; all gates pass, and the GitHub run is green
