# TICKET-062: CLI: build command

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059, 061
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta build`: read tokens, call `buildOutputs` (brands, collections, css/tailwind options from config), generate docs per ticket 061, write the files, print the generated-files box and exit code.

## Acceptance Criteria

- [x] `build` removed from `PENDING`; both fixtures match the recorded stdout and all files under `output/`
- [x] Summary prints the real JS path (`output/js/colorpalette.js`): the one intended snapshot diff, reviewed in the PR and recorded in the 039 quirk table
- [x] Diagnostics (broken reference, unknown brand/collection) shown; errors give exit 1
- [x] Legacy `commands/build.ts`, `style-dictionary.config.ts`, `formatters/tailwind-v*.ts`, `removedollarsigns.sh` deleted at the cut-over (066)
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `commands/build.ts` reads the tokens dir, calls `buildOutputs` and `generateDocsHtml` (`@dta/docs`), writes the files and replays the legacy steps (base, each brand, shared, docs) in the legacy order; the "Generated files" box lists files in that order, but only those that exist.
- The one intended difference (`output/js/colorpalette.js` instead of `build/js/colorpalette.js`) is an entry in `INTENDED_CHANGES` in `packages/cli/test/snapshots.test.ts`, not an edited snapshot: `snapshot:check` re-records the legacy output, so the recorded files stay as they are, and a stale entry fails the suite.
- Parse errors and error diagnostics fail with exit 1 and write nothing.
