# TICKET-055: Lint: package scaffold, validated config and built-in rules

**Phase:** 8 — Token Engine Overhaul, Epic 5 (@dta/lint)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033, TICKET-043
**Status:** ready-for-agent
**Spec:** [lint-package](../specs/lint-package.md)

## What to build

Create `packages/lint` (`@dta/lint`, private, depends on `@dta/core` and `zod`) with `lintTokens(model, config?)`, the Zod lint config schema and the three built-in rules.

## Acceptance Criteria

- [ ] `packages/lint` scaffolded like the other packages (entry-point-only exports); boundary check passes
- [ ] `lintTokens(model, config?: unknown)` returns `{ violations, errorCount, warningCount, diagnostics }`; a clean model gives no violations; the model is not mutated; nothing is read, written or printed
- [ ] `lintConfigSchema` (Zod) covers the four configurable rules with `severity: error | warn | off`; invalid config yields error diagnostics naming the failing path and never throws (wrong types, unknown rule names, empty/undefined config accepted)
- [ ] `no-dangling-aliases`, `no-circular-aliases` (message `Circular alias chain: a → b → a`, empty file) and `no-default-mode-names` (`Mode 1`, `Mode1`, `mode 2`; once per file) run always with severity `error`, built on core `analyzeGraph`
- [ ] Message wording matches legacy except the documented dot-form target for dangling aliases
- [ ] Legacy `linter.test.ts` cases for these rules re-expressed through `lintTokens` with crafted models
- [ ] 039 parity table: `linter.ts` row added/updated (built-in rules done); `contrastRatio` duplicate in `linter.ts` noted as covered by core
- [ ] All gates pass, and the GitHub run is green
