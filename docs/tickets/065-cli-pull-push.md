# TICKET-065: CLI: pull and push commands

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** L
**Blocked by:** 059, 064
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `pull` (API and `--from-file`, format detection, writing token files) and `push` (diff in console/markdown/json, `--dry-run`, `--skip-lint` gating, typed confirmation, `--yes`, never deletes) on `@dta/figma`. Decide keep-or-drop of the tokenHaus adapter (039).

## Acceptance Criteria

- [ ] `pull --from-file` and `push --dry-run` snapshots recorded from legacy first, then green
- [ ] API paths tested with `startFigmaFake` and `test/recordings` (pull roundtrip, push payload assertion), no Figma secrets in CI
- [ ] Confirmation text, `--yes`, `push.skipConfirmation` and lint gating covered by tests; push never deletes (test)
- [ ] 403 on non-Enterprise plans shows the `--from-file` hint
- [ ] Legacy `commands/pull.ts`, `push.ts`, `figma_api.ts`, `token_export.ts`, `token_import.ts`, `importers/*` deleted at the cut-over (066)
- [ ] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [ ] All gates pass, and the GitHub run is green
