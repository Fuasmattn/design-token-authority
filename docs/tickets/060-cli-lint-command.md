# TICKET-060: CLI: lint command

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** S
**Blocked by:** 059
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta lint`: read the tokens dir, call `lintTokens(model, config.lint)`, group violations by file, print the summary, exit 1 on errors, 0 otherwise. `--fix` prints that it is unsupported.

## Acceptance Criteria

- [x] `lint` removed from `PENDING`; brand-ab and daisyui snapshots match (stdout and exit code as recorded: 0 for brand-ab, 2 for daisyui)
- [x] Config diagnostics from `lintTokens` are shown and make the run fail
- [x] CLI tests for: clean run, warnings only, errors, missing tokens dir, `--fix`
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `commands/lint.ts` uses `createUi` (clack pointed at the CLI's stdout callback), so the output is byte-identical to the recording.
- Lint errors exit 2 (legacy behaviour, pinned by the snapshot); parse errors and config diagnostics exit 1; `--fix` prints that it is unsupported and continues.
