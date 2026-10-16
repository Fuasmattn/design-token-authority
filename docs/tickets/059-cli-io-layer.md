# TICKET-059: CLI: shared I/O layer, UI helpers and config wiring

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 058
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Add the CLI-internal modules every command uses: reading a tokens directory into `parseTokenFiles`, writing `buildOutputs` files, printing diagnostics, the clack-based `ui` helper (banner, step, box, summary) and exit-code handling. Replace the CLI config's copy of the lint schema with `lintConfigSchema` from `@dta/lint`.

## Acceptance Criteria

- [x] `readTokenDir(dir)` / `writeFiles(files)` with tests on a temp copy of a fixture (missing dir gives the legacy message and exit 1)
- [x] `ui` helper reproduces the framing of the recorded snapshots (`T`, `|`, `o`, box) and is tested against a recorded snippet
- [x] Diagnostics from packages print as lines, errors make the exit code 1
- [x] CLI config uses `lintConfigSchema`; existing config tests still pass
- [x] Boundary check passes (`@dta/cli` imports packages by name only)
- [x] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `io/token-dir.ts` (`readTokenDir`, `TokenDirError`), `io/write-files.ts` (refuses paths outside the project), `io/diagnostics.ts`, `ui.ts` (banner, `cmd`, `filePath`). The terminal frame (`T`, `|`, `o`, boxes) comes from `@clack/prompts` itself, so commands use it directly; the byte-for-byte check is each command's snapshot scenario.
- CLI config: `lint` is `lintConfigSchema` plus an early regular-expression check (config load still rejects a bad pattern with the same path as before).
- Fixed on the way: `lintConfigSchema` required every rule; the rules are now optional (test added in `@dta/lint`).
