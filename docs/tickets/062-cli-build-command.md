# TICKET-062: CLI: build command

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059, 061
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta build`: read tokens, call `buildOutputs` (brands, collections, css/tailwind options from config), generate docs per ticket 061, write the files, print the generated-files box and exit code.

## Acceptance Criteria

- [ ] `build` removed from `PENDING`; both fixtures match the recorded stdout and all files under `output/`
- [ ] Summary prints the real JS path (`output/js/colorpalette.js`): the one intended snapshot diff, reviewed in the PR and recorded in the 039 quirk table
- [ ] Diagnostics (broken reference, unknown brand/collection) shown; errors give exit 1
- [ ] Legacy `commands/build.ts`, `style-dictionary.config.ts`, `formatters/tailwind-v*.ts`, `removedollarsigns.sh` deleted once green
- [ ] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [ ] All gates pass, and the GitHub run is green
