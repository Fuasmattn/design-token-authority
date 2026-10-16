# TICKET-059: CLI: shared I/O layer, UI helpers and config wiring

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 058
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Add the CLI-internal modules every command uses: reading a tokens directory into `parseTokenFiles`, writing `buildOutputs` files, printing diagnostics, the clack-based `ui` helper (banner, step, box, summary) and exit-code handling. Replace the CLI config's copy of the lint schema with `lintConfigSchema` from `@dta/lint`.

## Acceptance Criteria

- [ ] `readTokenDir(dir)` / `writeFiles(files)` with tests on a temp copy of a fixture (missing dir gives the legacy message and exit 1)
- [ ] `ui` helper reproduces the framing of the recorded snapshots (`T`, `|`, `o`, box) and is tested against a recorded snippet
- [ ] Diagnostics from packages print as lines, errors make the exit code 1
- [ ] CLI config uses `lintConfigSchema`; existing config tests still pass
- [ ] Boundary check passes (`@dta/cli` imports packages by name only)
- [ ] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [ ] All gates pass, and the GitHub run is green
