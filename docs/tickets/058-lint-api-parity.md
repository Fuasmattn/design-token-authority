# TICKET-058: Lint: public API and full parity test

**Phase:** 8 — Token Engine Overhaul, Epic 5 (@dta/lint)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-056, TICKET-057
**Status:** done
**Spec:** [lint-package](../specs/lint-package.md)

## What to build

Finish the public surface and prove parity with the legacy `dta lint` snapshots.

## Acceptance Criteria

- [x] For brand-ab (with the lint rules from `test/fixtures/brand-ab/dta.config.ts`) and daisyui (no rules), the violations grouped by file equal the ones printed in `test/snapshots/<fixture>/lint/stdout.txt`: same files, same order, same rule, severity and message; counts match the summary line
- [x] Differences in order caused by the model (sorted collections and modes) versus legacy directory order are listed in the ticket, with the snapshot as authority
- [x] Malformed configs (wrong types, unknown rules, bad regex) never throw (table-driven test)
- [x] The package index exports `lintTokens`, `lintConfigSchema` and the types only; boundary check passes
- [x] Package README lists the rules, severities, config and the quirks kept for parity
- [x] 039 parity table: `lint` row set to "package done; CLI wiring in Epic 6 (scenario stays PENDING)"; quirk table gets the contrast and duplicate-value decisions
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `parity.test.ts` reads `test/snapshots/{brand-ab,daisyui}/lint/stdout.txt`, so the snapshot stays the authority. The brand-ab lint config is inlined (a copy of the `lint` section of the fixture's `dta.config.ts`).
- Order differences: none. File order and per-file order equal the legacy output for both fixtures.
- Malformed configs: table-driven test over 12 configs, all give error diagnostics and never throw.
