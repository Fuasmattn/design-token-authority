# TICKET-063: CLI: graph command (console, dot, markdown, html)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta graph` and its four report formats on top of core `analyzeGraph`; `--output` writes to a file.

## Acceptance Criteria

- [ ] All four `graph-*` scenarios removed from `PENDING` and green on both fixtures (formats live in the CLI; the HTML visualisation is ported verbatim)
- [ ] `--output <path>` and missing tokens dir behave as in legacy (tests)
- [ ] Legacy `graph.ts` and `commands/graph.ts` deleted at the cut-over (066)
- [ ] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [ ] All gates pass, and the GitHub run is green
