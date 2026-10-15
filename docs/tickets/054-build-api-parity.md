# TICKET-054: Build: public API, options and full parity test

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-050, TICKET-051, TICKET-052, TICKET-053
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Finish the public surface and prove parity: output directory options, collection filter, the complete snapshot comparison and the determinism and no-I/O guarantees.

## Acceptance Criteria

- [x] `BuildOptions` supports `brands`, `collections` (filter, as legacy `config.collections`) and `css.outDir` / `tailwind.outDir`; defaults match legacy; invalid combinations yield diagnostics
- [x] One parity test per fixture: every file under `test/snapshots/<fixture>/build/files/output/{css,js,tailwind}` is produced byte for byte, and no extra file is produced
- [x] Two runs on the same model give identical files in identical order
- [x] The package index exports only `buildOutputs` and its option/result types; boundary check passes
- [x] README of the package lists the options and the parity contract; docs HTML explicitly noted as out of scope (039 row set to "Epic 7 decision")
- [x] 039 parity table: `build` row set to "package done; CLI wiring in Epic 6 (scenario stays PENDING)"
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Options: `brands`, `collections` (filter; unknown names give an `unknown-collection` warning), `css.outDir`, `tailwind.outDir` (trailing slashes tolerated, blank values fall back to the default with an `invalid-option` warning). The JS directory stays fixed as in legacy.
- Parity test per fixture: the produced paths equal the files in `test/snapshots/<fixture>/build/files` except `output/docs/`, every file is byte-identical, and there are no diagnostics. A second test shows two runs give the same result.
- Index exports `buildOutputs`, `BuildOptions`, `BuildResult`, `OutputFile` only. `packages/build/README.md` documents options and contract.
- 039: `build` row set to "package done; CLI wiring in Epic 6 (scenario stays PENDING)"; docs HTML row stays an Epic 7 decision. Quirks recorded for the CLI port: the summary prints `build/js/colorpalette.js` for a file that lives at `output/js/colorpalette.js`; the JS directory is not configurable; a brand token that aliases its own path removes the primitive it shadows.
