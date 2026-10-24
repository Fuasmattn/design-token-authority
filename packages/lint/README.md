# @dta/lint

Checks a `@dta/core` token model against a set of rules and returns the violations. Pure: nothing is read, written or printed. Spec: [docs/specs/lint-package.md](../../docs/specs/lint-package.md).

```ts
import { parseTokenFiles } from '@dta/core'
import { lintTokens } from '@dta/lint'

const { model } = parseTokenFiles(tokenFiles)
const { violations, errorCount, warningCount, diagnostics } = lintTokens(model, config.lint)
```

`config` is the `lint` section of the project config. It is `unknown` on purpose: it is validated here (`lintConfigSchema`), and a bad config never throws. Problems come back as `invalid-config` error diagnostics that name the failing path (for example `rules.naming-pattern.patterns.Base`); the other rules still run.

A violation is `{ rule, severity: 'error' | 'warn', tokenPath, file, message }`. `tokenPath` is the graph id (`Collection.Mode/Group/Token`), `file` is `Collection.Mode.json` (empty for problems that span files).

## Rules

Built-in rules always run at `error`:

| Rule                    | Finds                                               |
| ----------------------- | --------------------------------------------------- |
| `no-dangling-aliases`   | an alias that points to a token that does not exist |
| `no-circular-aliases`   | an alias chain that leads back to itself            |
| `no-default-mode-names` | modes named like Figma defaults (`Mode 1`, `Mode1`) |

Configurable rules default to `warn`, run only when present in the config, and can be set to `error`, `warn` or `off`:

| Rule                  | Options                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic-must-alias` | `collections`: raw values in these collections are violations                                                                                                                                  |
| `naming-pattern`      | `patterns`: collection name → regular expression every path segment must match (the first failing segment is reported; an invalid expression is a diagnostic and only that pattern is skipped) |
| `color-contrast`      | `pairs`: `[foreground, background]` token names (dot or slash form); `minRatio` (default 4.5)                                                                                                  |
| `no-duplicate-values` | none                                                                                                                                                                                           |

## `color-contrast` per mode (TICKET-092)

Both sides of a pair are resolved through their aliases with `resolve` from `@dta/core`. Every multi-mode collection either alias chain passes through adds its modes (a brand foreground over a single-mode background: one check per brand; Brand × Theme: one per combination); collections neither chain reaches are not multiplied in. A violation ends with the context (`… is below 4.5:1 in BrandA`, `in BrandA · Dark`, nothing for single-mode pairs) and its `file` is the first file along the chains that is read in one of those modes. A side that does not resolve, or is not a colour, gives a `contrast-unresolved` warning diagnostic (once for an unknown name, per mode for an alias that breaks in one mode) and the other modes are still checked.

## Behaviour kept from the v1 linter (for parity)

- `no-duplicate-values` groups non-alias tokens by `type:value` across all collections and modes, and reports every member except the first.
- The dangling-alias message names the target in dot form (`Colors.Missing`); this is the only wording change.
