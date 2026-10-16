# TICKET-078: Playground: dependency graph with brand and breakpoint switcher

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** M
**Blocked by:** 077
**Status:** open
**Spec:** [playground](../specs/playground.md) (decisions 3, 5, open question 1)

## What to build

The playground shows the token dependency graph (alias chains, cycles, dangling, orphans) with a brand and breakpoint switcher and lint findings highlighted as redlines.

## Acceptance criteria

- [ ] Graph from `@dta/core` analysis; keyboard-navigable; works at 390 px with a list fallback
- [ ] Findings link between the graph and the lint list
- [ ] Decision on reusing it for `dta graph --format html` recorded (spec open question 1)
- [ ] All gates pass plus the site job, and the GitHub run is green
