# TICKET-043: Core: graph analysis

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040, TICKET-042
**Status:** ready-for-agent
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Port the analysis half of legacy `graph.ts` (not the report formatters, not file reading): nodes per token and mode, mode-aware edges, cycles, dangling aliases, orphans, chain depth and statistics.

## Acceptance Criteria

- [ ] `analyzeGraph(model)` returns nodes (per token and mode), edges, cycles, dangling aliases, orphaned tokens, chain depths, max depth and stats (totals, alias count and percentage, per file, per type) as plain data
- [ ] Results on both fixtures agree with legacy `dta graph` numbers (totals, alias count, depth, orphans); any difference caused by mode-aware edges is listed in this ticket and in 039's quirk table
- [ ] Cycles and dangling aliases are reported without throwing, and the analysis terminates on cyclic input
- [ ] Output is JSON-serializable and deterministic (stable ordering)
- [ ] Tests only through the public API; tests ported from `src/graph.test.ts` for analysis behaviour
- [ ] 039 parity table: graph row split into 'analysis (done in core)' and 'formatters (CLI epic)'
- [ ] All gates pass
