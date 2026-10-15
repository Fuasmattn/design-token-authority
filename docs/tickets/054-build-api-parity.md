# TICKET-054: Build: public API, options and full parity test

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-050, TICKET-051, TICKET-052, TICKET-053
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Finish the public surface and prove parity: output directory options, collection filter, the complete snapshot comparison and the determinism and no-I/O guarantees.

## Acceptance Criteria

- [ ] `BuildOptions` supports `brands`, `collections` (filter, as legacy `config.collections`) and `css.outDir` / `tailwind.outDir`; defaults match legacy; invalid combinations yield diagnostics
- [ ] One parity test per fixture: every file under `test/snapshots/<fixture>/build/files/output/{css,js,tailwind}` is produced byte for byte, and no extra file is produced
- [ ] Two runs on the same model give identical files in identical order
- [ ] The package index exports only `buildOutputs` and its option/result types; boundary check passes
- [ ] README of the package lists the options and the parity contract; docs HTML explicitly noted as out of scope (039 row set to "Epic 7 decision")
- [ ] 039 parity table: `build` row set to "package done; CLI wiring in Epic 6 (scenario stays PENDING)"
- [ ] All gates pass, and the GitHub run is green
