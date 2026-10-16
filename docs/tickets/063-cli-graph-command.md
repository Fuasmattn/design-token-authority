# TICKET-063: CLI: graph command (console, dot, markdown, html)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Port `dta graph` and its four report formats on top of core `analyzeGraph`; `--output` writes to a file.

## Acceptance Criteria

- [x] All four `graph-*` scenarios removed from `PENDING` and green on both fixtures (formats live in the CLI; the HTML visualisation is ported verbatim)
- [x] `--output <path>` and missing tokens dir behave as in legacy (tests)
- [x] Legacy `graph.ts` and `commands/graph.ts` deleted at the cut-over (066)
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Report formatters live in `packages/cli/src/graph/` (console, dot, markdown, html), ported from the legacy `graph.ts` onto the core `analyzeGraph` result. Sorting: `inLegacyOrder` orders files by full file name (`Collection.Mode.json`) as the legacy reader did; the model's own order differs for modes such as `1` and `1.5` (daisyui), and the snapshot decides.
- The dangling-alias target is printed in dot form (as in the lint message); no fixture has a dangling alias, so no snapshot is affected.
- Browser opening stays (legacy quirk 3), through an injectable `openFile` in `CliIo`, so tests never launch a browser.
- Unknown `--format` now fails with exit 1 and a message (legacy printed nothing for it).
