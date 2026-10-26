# TICKET-019: Naming convention enforcement rules

**Phase:** 5 — Quality & Validation
**Priority:** Medium
**Effort:** S
**Status:** done (2026-10-26)

## Summary

Extend the token linter (TICKET-018) with dedicated naming convention rules that enforce a consistent token naming structure across all collections. This is particularly important for multi-brand systems where consistent naming enables reliable alias resolution.

## Background

In the current project, alias resolution between collections depends on variable names being unique and consistently formatted. A naming drift in Figma (e.g. `Colors/Brand/Primary` vs `Colors/brand/primary`) silently breaks alias chains. The `meta.Mode1` issue is a concrete example of naming drift that went undetected.

## Acceptance Criteria

- [x] Linter rule `naming/mode-names` — mode names must not match Figma defaults (`/Mode \d+/i`)
- [x] Linter rule `naming/case` — variable segments must use a consistent case style per collection (configurable: `kebab-case`, `camelCase`, `PascalCase`, `snake_case`)
- [x] Linter rule `naming/depth` — variable paths must have a minimum/maximum segment count (configurable per collection)
- [x] Linter rule `naming/no-spaces` — no spaces in variable or collection names (spaces break some output targets)
- [x] Linter rule `naming/collection-pattern` — collection names must match a configurable regex
- [x] All rules are configurable in the `lint.rules` section of the project config
- [x] Violations include the specific token or collection name that fails, and the expected pattern

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
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
}
```

## Dependencies

- TICKET-018 (linter — these are rules within the linting framework)

## Outcome (2026-10-23)

Named like the existing rules (`naming-pattern`, `no-duplicate-values`), not `naming/…`:

| Ticket name                 | Rule                    | Notes                                                                                                                                                                                                                           |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `naming/mode-names`         | `no-default-mode-names` | Already always on since TICKET-018 (an error); nothing new.                                                                                                                                                                     |
| `naming/case`               | `naming-case`           | `collections: { <collection>: 'kebab-case' \| 'camelCase' \| 'PascalCase' \| 'snake_case' }`. Segments made of numbers (`700`, `0-5`) fit every style, or no scale could pass. `naming-pattern` stays for any other convention. |
| `naming/depth`              | `naming-depth`          | `collections: { <collection>: { min?, max? } }`; `min` above `max` is a config error.                                                                                                                                           |
| `naming/no-spaces`          | `no-spaces`             | Collection names and token path segments.                                                                                                                                                                                       |
| `naming/collection-pattern` | `collection-pattern`    | `pattern`: a regular expression for every collection name; an invalid one is a config error (`dta.config` loading and `lintTokens`).                                                                                            |

Configurable rules are warnings unless `severity` says otherwise, like the others. Token rules report per mode file (as `naming-pattern` does); collection rules once, on the collection's first mode file. Messages name the token or collection and the expected style, count or pattern. `dta context` states the configured naming rules in DESIGN.md for coding agents (as it already did for `naming-pattern`). Tests in `packages/lint/src/lint.test.ts`, config validation in `packages/cli/src/config.test.ts`, DESIGN.md in `context/render.test.ts`; Reference → Lint rules documents each with output from a run on `brand-ab`. No snapshot changes: none of the fixtures configures the new rules.
- After an independent review: `$root` is not checked or counted; scale steps `1.5`, `2xl`, `3xs` fit every case style; the four rules report a token once, not once per mode (the first mode's file); `naming-depth` needs `min` or `max`; the docs say patterns are not anchored. `naming-pattern` keeps its per-mode reports (pinned by the `brand-ab/lint` snapshot).
