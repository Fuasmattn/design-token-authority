# Spec: @dta/lint — validate a token model against built-in and configured rules

**Status:** ready-for-review
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 5
**Depends on:** [@dta/core](./core-token-model.md) (Epic 2)
**Related:** ADR 0001, TICKET-039 (parity table), TICKET-018 (legacy linter), TICKET-019 (naming conventions, after parity), the `lint` snapshots in `test/snapshots/*/lint`

## Problem

Legacy `linter.ts` works on a graph that `graph.ts` builds by reading token files from a directory, so rules cannot be tested without either files or hand-built graph internals. The lint config is a TypeScript interface that is never validated (an invalid regex throws at lint time, a typo in a rule name is silently ignored), `contrastRatio` is duplicated from the colour code, and formatting (grouping by file, colours, summary) lives in the `lint` command next to the rules. The only description of the output contract is the recorded `lint` snapshots.

## Solution

`@dta/lint` checks a `@dta/core` token model: `lintTokens(model, config?)` returns structured violations (rule, severity, token, file, message), counts and diagnostics, and does no I/O and no printing. Rules are small functions over the core graph analysis (`analyzeGraph`) and the model. The lint config is a Zod schema owned by this package, validated where user-land data enters; a bad config yields diagnostics, never an exception. The CLI formats the violations and decides the exit code.

The contract for this epic is **parity**: for both fixtures, the violations equal what the legacy `dta lint` printed in the recorded snapshots (same rules, messages, files and order).

## Decisions

1. **Scope.** `@dta/lint` = model + config in, violations out: the three built-in rules (`no-dangling-aliases`, `no-circular-aliases`, `no-default-mode-names`) and the four configurable ones (`semantic-must-alias`, `naming-pattern`, `color-contrast`, `no-duplicate-values`). Formatting, colours, exit codes, `push` gating (`--skip-lint`) and config-file loading are CLI (Epic 6).
2. **Dependencies.** Depends on `@dta/core` (`analyzeGraph`, `parseColor`, `contrastRatio`, name helpers) and `zod`; never on `@dta/figma`, `@dta/build` or `@dta/cli`. No duplicate colour maths: contrast uses core.
3. **Pure.** `lintTokens(model, config?)` → `{ violations, errorCount, warningCount, diagnostics }`. No file reads, no console output, no mutation of the model.
4. **Config is validated (Zod).** `lintConfigSchema` describes `{ rules?: { 'semantic-must-alias'?, 'naming-pattern'?, 'color-contrast'?, 'no-duplicate-values'? } }` with `severity: 'error' | 'warn' | 'off'` per rule. `lintTokens` takes `unknown` config, parses it, and reports problems as error diagnostics naming the failing path (unknown rule names, wrong types, a pattern that is not a valid regular expression). A rule with an invalid option is skipped; the other rules still run. The CLI config epic embeds this schema instead of redefining it.
5. **Severity.** Built-in rules always run with severity `error` (legacy does not make them configurable; making them configurable is a feature after parity). Configurable rules default to `warn` and only run when present in the config; `off` disables a rule.
6. **Violation shape.** `{ rule, severity: 'error' | 'warn', tokenPath, file, message }` as in legacy, where `tokenPath` is the graph id (`Collection.Mode/Group/Token`) and `file` is `Collection.Mode.json` (empty for circular chains, as in legacy). No `fixable` field: `--fix` was never implemented and is dropped.
7. **Order.** Violations come rule by rule in the legacy order (dangling, circular, default mode names, semantic, naming, contrast, duplicates), and within a rule in graph node order (collections and modes sorted by name, tokens in file order). The parity test pins the resulting order against the snapshots; where the model's order differs from legacy's directory order, the snapshot decides and the difference is documented in the ticket.
8. **Copy the rule semantics, including their quirks.** `color-contrast` only compares tokens that hold a raw hex value (aliased colours are skipped, so pairs that live in alias layers are never checked), looks tokens up by their name inside the file in any mode, and silently skips pairs whose tokens it cannot find. `no-duplicate-values` compares raw values across all collections and modes by `type:value`. `naming-pattern` tests every path segment and reports the first failing one. `semantic-must-alias` flags raw values in the listed collections. All are covered by tests as they are; resolving aliases before checking contrast and similar improvements are feature tickets after parity (each a reviewed snapshot diff).
9. **One wording change.** The dangling-alias message names the target in dot form (`Colors.Missing`) instead of legacy's internal id form, because the model has no file-specific ids for missing tokens. No fixture has a dangling alias, so no snapshot changes; the legacy test only asserts the dot form appears.
10. **Testing seam.** Through `lintTokens` only: both fixtures' models with their `dta.config.ts` lint rules produce the violations in the `lint` snapshots (parsed from the recorded stdout); crafted models cover every rule, severities, `off`, and edge cases; legacy `linter.test.ts` cases are re-expressed; malformed configs (wrong types, unknown rules, bad regex) never throw and yield diagnostics.
11. **Wiring.** The CLI epic calls `lintTokens`; until then the `lint` scenario stays in `PENDING`. Each ticket updates its 039 rows; legacy `linter.ts`, `commands/lint.ts` and the lint config types are deleted with the CLI port.

## Public API sketch (names may change in the tickets)

- `lintTokens(model, config?: unknown)` → `{ violations, errorCount, warningCount, diagnostics }`
- `lintConfigSchema` (Zod) and the type `LintConfig`
- Types `LintViolation`, `LintResult`, `LintSeverity`

## Out of scope

Naming conventions beyond the existing regex rule (TICKET-019), auto-fix, new rules, configurable severity for built-in rules, alias-aware contrast, formatting and exit codes (Epic 6), MCP/audit uses (TICKET-029/030).

## Tickets

[055](../tickets/055-lint-scaffold-builtin-rules.md) · [056](../tickets/056-lint-semantic-naming-rules.md) · [057](../tickets/057-lint-contrast-duplicates.md) · [058](../tickets/058-lint-api-parity.md)
