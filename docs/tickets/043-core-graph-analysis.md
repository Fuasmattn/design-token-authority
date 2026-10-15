# TICKET-043: Core: graph analysis

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-040, TICKET-042
**Status:** done
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

Port the analysis half of legacy `graph.ts` (not the report formatters, not file reading): nodes per token and mode, mode-aware edges, cycles, dangling aliases, orphans, chain depth and statistics.

## Acceptance Criteria

- [x] `analyzeGraph(model)` returns nodes (per token and mode), edges, cycles, dangling aliases, orphaned tokens, chain depths, max depth and stats (totals, alias count and percentage, per file, per type) as plain data
- [x] Results on both fixtures agree with legacy `dta graph` numbers (totals, alias count, depth, orphans); any difference caused by mode-aware edges is listed in this ticket and in 039's quirk table
- [x] Cycles and dangling aliases are reported without throwing, and the analysis terminates on cyclic input
- [x] Output is JSON-serializable and deterministic (stable ordering)
- [x] Tests only through the public API; tests ported from `src/graph.test.ts` for analysis behaviour
- [x] 039 parity table: graph row split into 'analysis (done in core)' and 'formatters (CLI epic)'
- [x] All gates pass

## Implementation notes

- `packages/core/src/graph.ts`; public API: `analyzeGraph(model)` returning `{ nodes, edges, cycles, danglingAliases, orphanedTokens, chainDepths, maxChainDepth, stats }` as plain data (maps became records). Node ids are the same as legacy (`Collection.Mode/Group/Token`).
- Edges: an alias is read in the node's own mode for tokens of the same collection, otherwise in the first mode of the target's collection (the default `resolve` selection).
- **Parity result:** totals, alias count, max depth, cycles, dangling, orphans, per-file and per-type counts equal the legacy `graph-console` snapshots for both fixtures (BrandA/B: 63 tokens, 37 aliases, 4 orphans; DaisyUI: 1,277 tokens, 237 aliases, 908 orphans). The mode-aware edge rule produced no difference on the fixtures, so there is no new entry for 039's quirk table.
- Each node has at most one outgoing edge, so cycles and depths are found by iterative pointer walking: no recursion, handles a 20,000-link chain, terminates on cycles and self-aliases.
- Ordering is deterministic (collections and modes sorted, tokens in first-appearance order). Lists in legacy output follow file order; the report formatters (CLI epic) may need to sort to keep snapshots byte-identical.
- Not ported (CLI epic): the console, DOT, Markdown and HTML report formatters and the directory reading of `graph.ts`.
- 039 parity table: graph row split into analysis (done in core) and formatters (CLI epic).
