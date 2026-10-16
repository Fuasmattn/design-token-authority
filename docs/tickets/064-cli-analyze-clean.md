# TICKET-064: CLI: analyze and clean commands (with new snapshots)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Record `analyze` and `clean` scenarios from the frozen legacy CLI (reviewed snapshot addition), then port both: `analyze` prints the structure report from core `analyzeStructure`; `clean` removes token files and build output.

## Acceptance Criteria

- [x] New snapshots recorded from the legacy CLI for both fixtures, and `snapshot:check` stays green
- [x] Both scenarios green against the new CLI
- [x] `clean` is tested on a temp copy of a fixture and never touches files outside the configured dirs
- [x] Legacy `analyze`, `importers/analyze-tokens.ts`, `clean` files deleted at the cut-over (066)
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Harness: scenarios can now be limited to fixtures (`fixtures`) and can run against the Figma fake (`figma: {fileKey, token}`); the harness writes a generated `dta.snapshot.config.ts` (the fixture's config plus credentials), serves `test/recordings/<fixture>/variables-local.json` and passes `--config`. `scenariosFor(fixture)` is used by the recorder and the CLI suite. New snapshots: `clean` (both fixtures) and `analyze` (brand-ab), recorded from the legacy CLI.
- `analyze` runs `@dta/figma` (client, `variablesToModel`) and core `analyzeStructure`; the report text is ported. The CLI honours `DTA_FIGMA_API_URL` as the API base URL (proxies, the fake).
- `clean`: **fixed** instead of copied. Legacy removed the whole top-level directory of every configured output folder (an `outDir` such as `src/styles` deleted `src/`). It now removes only the configured folders and the build defaults, then empty parent folders, and refuses folders outside the project. Output is identical when the default `output/` folder is cleaned; recorded in the 039 quirk table.
- Not ported on purpose: nothing; `--from-file` is part of `pull` (065).
