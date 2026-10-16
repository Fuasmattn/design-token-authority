# TICKET-055: Lint: package scaffold, validated config and built-in rules

**Phase:** 8 — Token Engine Overhaul, Epic 5 (@dta/lint)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033, TICKET-043
**Status:** done
**Spec:** [lint-package](../specs/lint-package.md)

## What to build

Create `packages/lint` (`@dta/lint`, private, depends on `@dta/core` and `zod`) with `lintTokens(model, config?)`, the Zod lint config schema and the three built-in rules.

## Acceptance Criteria

- [x] `packages/lint` scaffolded like the other packages (entry-point-only exports); boundary check passes
- [x] `lintTokens(model, config?: unknown)` returns `{ violations, errorCount, warningCount, diagnostics }`; a clean model gives no violations; the model is not mutated; nothing is read, written or printed
- [x] `lintConfigSchema` (Zod) covers the four configurable rules with `severity: error | warn | off`; invalid config yields error diagnostics naming the failing path and never throws (wrong types, unknown rule names, empty/undefined config accepted)
- [x] `no-dangling-aliases`, `no-circular-aliases` (message `Circular alias chain: a → b → a`, empty file) and `no-default-mode-names` (`Mode 1`, `Mode1`, `mode 2`; once per file) run always with severity `error`, built on core `analyzeGraph`
- [x] Message wording matches legacy except the documented dot-form target for dangling aliases
- [x] Legacy `linter.test.ts` cases for these rules re-expressed through `lintTokens` with crafted models
- [x] 039 parity table: `linter.ts` row added/updated (built-in rules done); `contrastRatio` duplicate in `linter.ts` noted as covered by core
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `config.ts` validates each rule independently (`readLintConfig`), so one bad rule yields one `invalid-config` diagnostic (message includes `rules.<rule>.<path>`) and the other rules still run. Top level and rule options are strict.
- `lint.ts` builds the three built-in rules on core `analyzeGraph`; configurable rules arrive in 056/057.
- 039: `linter.ts` row now notes the built-in rules are done; the `contrastRatio` duplicate is covered by `@dta/core`.
