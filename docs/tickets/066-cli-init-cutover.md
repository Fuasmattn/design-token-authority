# TICKET-066: CLI: init wizard, test:visual decision and cut-over

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** L
**Blocked by:** 060–065
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port the `init` wizard with scripted-prompt tests, register `test:visual` as moved to Epic 8, then switch the binaries (`dta`, `design-token-authority`) to the new CLI, drop `dta-next` and the legacy `sync_*` scripts, and update README and CLAUDE.md.

## Acceptance Criteria

- [ ] `init` tests with scripted prompts for both Figma plan paths; generated `dta.config.ts` validates against the config schema
- [ ] `PENDING` list is empty; every scenario is green
- [ ] Binaries point at the new CLI; `pnpm dta …` scripts and docs updated
- [ ] 039 has no `open` rows except the final removal checklist
- [ ] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [ ] All gates pass, and the GitHub run is green
