# TICKET-019: Naming convention enforcement rules

**Phase:** 5 — Quality & Validation
**Priority:** Medium
**Effort:** S

## Summary

Extend the token linter (TICKET-018) with dedicated naming convention rules that enforce a consistent token naming structure across all collections. This is particularly important for multi-brand systems where consistent naming enables reliable alias resolution.

## Background

In the current project, alias resolution between collections depends on variable names being unique and consistently formatted. A naming drift in Figma (e.g. `Colors/Brand/Primary` vs `Colors/brand/primary`) silently breaks alias chains. The `meta.Mode1` issue is a concrete example of naming drift that went undetected.

## Acceptance Criteria

- [ ] Linter rule `naming/mode-names` — mode names must not match Figma defaults (`/Mode \d+/i`)
- [ ] Linter rule `naming/case` — variable segments must use a consistent case style per collection (configurable: `kebab-case`, `camelCase`, `PascalCase`, `snake_case`)
- [ ] Linter rule `naming/depth` — variable paths must have a minimum/maximum segment count (configurable per collection)
- [ ] Linter rule `naming/no-spaces` — no spaces in variable or collection names (spaces break some output targets)
- [ ] Linter rule `naming/collection-pattern` — collection names must match a configurable regex
- [ ] All rules are configurable in the `lint.rules` section of the project config
- [ ] Violations include the specific token or collection name that fails, and the expected pattern

## Implementation Notes

These are all simple string-matching rules that can be implemented as pure functions:

```ts
const modeNamesRule: LintRule = {
  name: 'naming/mode-names',
  check(tokens, config) {
    return config.collectionModes
      .filter(({ modeName }) => /^mode\s*\d+$/i.test(modeName))
      .map(({ collectionName, modeName }) => ({
        rule: 'naming/mode-names',
        severity: 'error',
        tokenPath: `${collectionName}/${modeName}`,
        message: `Mode "${modeName}" in "${collectionName}" uses Figma's default name. Rename it to something meaningful.`,
      }))
  },
}
```

**Case style detection:**
```ts
const casePatterns = {
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  'camelCase': /^[a-z][a-zA-Z0-9]*$/,
  'PascalCase': /^[A-Z][a-zA-Z0-9]*$/,
  'snake_case': /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
}
```

## Dependencies

- TICKET-018 (linter — these are rules within the linting framework)
