# TICKET-066: CLI: init wizard, test:visual decision and cut-over

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** L
**Blocked by:** 060–065
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port the `init` wizard with scripted-prompt tests, register `test:visual` as moved to Epic 8, then switch the binaries (`dta`, `design-token-authority`) to the new CLI, drop `dta-next` and the legacy `sync_*` scripts, and update README and CLAUDE.md.

## Acceptance Criteria

- [x] `init` tests with scripted prompts for both Figma plan paths; generated `dta.config.ts` validates against the config schema
- [x] `PENDING` list is empty; every scenario is green
- [x] Binaries point at the new CLI; `pnpm dta …` scripts and docs updated
- [x] 039 has no `open` rows except the final removal checklist
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Notes (done)

- `init` lives in `packages/cli/src/commands/init.ts` (wizard) and `init-config.ts` (file key, config and `.env.example` generation). Autodiscovery uses `@dta/figma` + `analyzeStructure` from `@dta/core`; follow-up `pull` / `build` call the new commands. Prompts are tested by a driver that types each answer once its question is on screen; the generated `dta.config.ts` is loaded through `loadConfig` in the tests.
- `test:visual` stays registered, prints where to run the Playwright tests and exits 3 (spec decision 10).
- Cut-over: `bin/dta.js` (both bin names) starts `packages/cli/src/bin.ts`, `exports` points at the new `defineConfig`, `dta-next` and the `sync-*` scripts are gone, `.env` is loaded by the new bin, `dta --version` reads `package.json`. A compiled build for publishing is not part of this ticket (Epic 7 / release).
- Legacy files are still on disk on purpose: `snapshot:check` records from the legacy CLI. TICKET-039 deletes them.
