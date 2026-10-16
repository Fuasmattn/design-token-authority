# TICKET-060: CLI: lint command

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** S
**Blocked by:** 059
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta lint`: read the tokens dir, call `lintTokens(model, config.lint)`, group violations by file, print the summary, exit 1 on errors, 0 otherwise. `--fix` prints that it is unsupported.

## Acceptance Criteria

- [ ] `lint` removed from `PENDING`; brand-ab and daisyui snapshots match (stdout and exit code: 0 and 2 as recorded)
- [ ] Config diagnostics from `lintTokens` are shown and make the run fail
- [ ] CLI tests for: clean run, warnings only, errors, missing tokens dir, `--fix`
- [ ] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [ ] All gates pass, and the GitHub run is green
