# TICKET-065: CLI: pull and push commands

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** L
**Blocked by:** 059, 064
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `pull` (API and `--from-file`, format detection, writing token files) and `push` (diff in console/markdown/json, `--dry-run`, `--skip-lint` gating, typed confirmation, `--yes`, never deletes) on `@dta/figma`. Decide keep-or-drop of the tokenHaus adapter (039).

## Acceptance Criteria

- [x] `pull --from-file` and `push --dry-run` snapshots recorded from legacy first, then green
- [x] API paths tested with `startFigmaFake` and `test/recordings` (pull roundtrip, push payload assertion), no Figma secrets in CI
- [x] Confirmation text, `--yes`, `push.skipConfirmation` and lint gating covered by tests; push never deletes (test)
- [x] 403 on non-Enterprise plans shows the `--from-file` hint
- [x] Legacy `commands/pull.ts`, `push.ts`, `figma_api.ts`, `token_export.ts`, `token_import.ts`, `importers/*` deleted at the cut-over (066)
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- New snapshots recorded from the legacy CLI: `pull-api` (`--output pulled`), `pull-from-file` (per-mode copy), `push-up-to-date`, `push-dry-run` (console, markdown, json) and `push-yes`, all on brand-ab against the fake. `push-*` use `test/recordings/brand-ab/variables-local.drifted.json` (Figma changed after the tokens: one colour and one number differ, one variable is missing). See `test/recordings/README.md`.
- The diff report is the legacy report, ported on the plan's payload (`planPush(...).payload`): the same lines, including Figma ids for modified variables. A report on names (from `plan.changes`) is a feature after parity.
- Intended differences, listed in `INTENDED_CHANGES` of the CLI snapshot suite: `push` no longer prints the debug line `Local variable collections in Figma file: [...]` (leftover `console.log` of the legacy payload generator), and token files that `pull` creates end with a newline. When a tokens folder already holds files, `pull` reuses their formatting, so unchanged tokens give no diff.
- Both commands keep the legacy exit codes (2 for missing input or credentials and for lint errors in `push`); Figma failures (rejected token, network, unexpected response) exit 1 with a message, and a 403 points to `--from-file`. The token is never printed.
- The confirmation prompt reads from `CliIo.input`, so tests type the answers.
- tokenHaus adapter: kept. The `--from-file` conversion works through the adapter registry and is covered by a CLI test; revisit when someone confirms nobody needs it.
