# TICKET-064: CLI: analyze and clean commands (with new snapshots)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Record `analyze` and `clean` scenarios from the frozen legacy CLI (reviewed snapshot addition), then port both: `analyze` prints the structure report from core `analyzeStructure`; `clean` removes token files and build output.

## Acceptance Criteria

- [ ] New snapshots recorded from the legacy CLI for both fixtures, and `snapshot:check` stays green
- [ ] Both scenarios green against the new CLI
- [ ] `clean` is tested on a temp copy of a fixture and never touches files outside the configured dirs
- [ ] Legacy `analyze`, `importers/analyze-tokens.ts`, `clean` files deleted at the cut-over (066)
- [ ] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [ ] All gates pass, and the GitHub run is green
