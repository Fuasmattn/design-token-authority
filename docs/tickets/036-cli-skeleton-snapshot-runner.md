# TICKET-036: New CLI skeleton and snapshot runner

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033, TICKET-035
**Status:** done
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A minimal `@dta/cli` that loads and validates `dta.config.ts` (with `defineConfig`, JSON fallback) and dispatches commands, plus the CLI-seam test: it runs new-CLI commands against each fixture project and compares written files and stdout with the snapshots. Commands not yet ported are on an explicit pending list so CI stays green.

## Acceptance Criteria

- [x] `@dta/cli` runs locally from the workspace; it is not published and does not claim the `dta` binary
- [x] Config is loaded from TypeScript or JSON and validated with clear error messages
- [x] The snapshot runner compares files and stdout per fixture and command, with readable diffs on failure
- [x] A pending list marks unported commands; removing an entry makes that command's snapshots mandatory
- [x] Intentional output changes are made by updating snapshots in the same PR

## Implementation Notes

- **Shared harness:** the snapshot machinery from TICKET-035 moved into a private package, `@dta/testkit` (scenarios, run-in-fresh-copy capture, normalization, read/write, comparison with readable diffs). The legacy capture script (`scripts/snapshots/capture-legacy.ts`) and the new CLI's parity suite both use it, so normalization cannot drift apart. Re-capturing the legacy snapshots with the refactored script reproduced the committed ones exactly.
- **Parity suite:** `packages/cli/test/snapshots.test.ts` runs the new CLI (as a real process) for every fixture and scenario. Every scenario is on the `PENDING` list today. Pending scenarios still run and must _not_ match: one that already passes fails the suite, so the list cannot go stale.
- **Verified:** with the legacy CLI standing in as the "new" one and an empty pending list, all scenarios pass; with the real new CLI and `build` made mandatory, the suite fails with a readable diff.
- **Config:** Zod schema derived from the v1 schema. Unknown keys are rejected (typos), `figma` is now optional, and all problems are reported at once with their field path. Config files: `dta.config.{ts,mts,js,mjs,json}`; more than one in a directory is an error.
- **Exit codes:** 0 ok, 1 general error (including missing config), 2 invalid config (as in v1), 3 command not ported yet.
- **Run locally:** `pnpm dta:next <command>` (the binary is deliberately not called `dta`).
- **Fixed on the way:** stripping spinner redraws with a regex was quadratic on long lines (the graph HTML has a 300 KB line), which made `snapshot:check` take minutes; and Node's 1 MB default output buffer would have broken larger fixtures.
