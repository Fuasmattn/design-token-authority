# TICKET-018: Token linter and plausibility checks

**Phase:** 5 — Quality & Validation
**Priority:** High
**Effort:** L

## Summary

Build a `dtf lint` command that validates token files against configurable rules. This catches design system violations, naming drift, structural issues, and broken alias references before they propagate to build outputs or back to Figma.

## Background

Once the token format is settled, a linter enables enforcing invariants automatically. Examples of rules that should be checked:
- Semantic tokens must alias primitives (not hardcode raw values)
- No circular alias chains
- No dangling aliases
- Mode names must not be Figma defaults (`Mode1`, `Mode 1`)
- Color contrast ratios for semantic color pairs (e.g. `text-on-primary` vs `background-primary`)
- Token naming must follow the project's convention (configurable regex per collection)

## Acceptance Criteria

- [ ] New command: `dtf lint`
- [ ] Rules are configurable in the project config (TICKET-008) under a `lint` key
- [ ] Built-in rules (always run):
  - No dangling aliases
  - No circular aliases
  - No default Figma mode names (`Mode 1`, `Mode1`, `Mode 2`, etc.)
- [ ] Configurable rules:
  - `semantic-must-alias` — semantic layer tokens must not contain raw values
  - `naming-pattern` — configurable regex per collection
  - `color-contrast` — minimum contrast ratio for specified color pairs
  - `no-duplicate-values` — two primitive tokens with identical raw values (suggests consolidation)
- [ ] Output: each violation shows token path, rule name, and a human-readable message
- [ ] Exit code `2` on rule violations (distinct from `1` for errors)
- [ ] `--fix` flag where auto-fix is possible (e.g. normalizing hex case)
- [ ] Runs automatically as part of `dtf push` (can be skipped with `--skip-lint`)

## Implementation Notes

**Config example:**
```ts
// dtf.config.ts
export default defineConfig({
  // ...
  lint: {
    rules: {
      'semantic-must-alias': { error: true, collections: ['Brand(Alias)'] },
      'naming-pattern': {
        error: false,
        patterns: {
          'Primitives(Global)': /^[A-Z][a-z]+\/[a-z0-9-]+$/,
          'Brand(Alias)': /^[A-Z][a-z]+\/[A-Z][a-z]+\//,
        },
      },
      'color-contrast': {
        error: true,
        pairs: [
          { foreground: 'Colors.Text.Default', background: 'Colors.Background.Default', minRatio: 4.5 },
        ],
      },
    },
  },
})
```

**Rule engine:**
```ts
interface LintRule {
  name: string
  check(tokens: FlatTokenMap, config: Config): LintViolation[]
}

interface LintViolation {
  rule: string
  severity: 'error' | 'warning'
  tokenPath: string
  message: string
  fix?: () => void
}
```

**Color contrast:** Use WCAG relative luminance formula; no extra dependencies needed.

## Dependencies

- TICKET-007 (CLI)
- TICKET-008 (config — `lint.rules` section)
- TICKET-017 (dependency graph — reuse for alias validation rules)
