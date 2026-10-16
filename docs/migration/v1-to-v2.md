# Migrating from v1 to v2

v2 is a rewrite of Design Token Authority as `@dta/*` packages behind one CLI. Commands, flags, token files and build outputs are the same as in v1 (proven by snapshot tests on fixture projects), so most projects upgrade without changes. This note lists what does change.

## Requirements

- Node.js 24 or newer (`engines` in `package.json`).

## Config file

Your `dta.config.ts` keeps working. What is new or stricter:

- **Unknown keys are rejected.** v1 ignored keys it did not know; v2 fails with exit code 2 and names the field. A typo such as `outputs.tailwnd` now shows up instead of being skipped silently.
- **More config formats.** Besides `dta.config.ts`, the CLI finds `dta.config.mts`, `dta.config.js`, `dta.config.mjs` and `dta.config.json` (no TypeScript tooling needed for the JSON variant). `-c <path>` still picks a file explicitly.
- **`figma` is optional.** v1 required a `figma` object even for file-based imports; v2 defaults it to `{}`.
- **`lint.rules.naming-pattern.patterns` must be valid regular expressions.** An invalid pattern is a config error at load time instead of a failure during `dta lint`.
- **`layers` is still accepted** but deprecated; use `collections`.

`defineConfig` is still imported from `design-token-authority`.

## Output and behaviour changes

Each change is a reviewed snapshot diff, listed with its reason in the quirk table of [TICKET-039](../tickets/039-legacy-removal.md).

| Command | v1 | v2 |
|---|---|---|
| `dta build` | Summary listed `build/js/colorpalette.js` | Lists the path it writes: `output/js/colorpalette.js` |
| `dta pull` | Token files had no final newline | New files end with a newline; existing files keep their formatting |
| `dta push` | Printed a debug line `Local variable collections in Figma file: [...]` | Removed |
| `dta clean` | Deleted the whole top-level folder of an output dir (`src/styles` removed `src/`) | Deletes only configured output folders and the build defaults, then empty parents; refuses folders outside the project |
| `dta --version` | Always `0.1.0` | The version from `package.json` |
| `dta init` | Animated logo, opened `build/docs/index.html`, `.env.example` named old scripts | Static banner, opens the configured docs folder, names `dta pull` / `dta push` |
| `dta test:visual` | Ran the Playwright tests | Prints where the tests moved and exits 3 (visual-diff replaces it, Epic 8) |

## Removed

- The `sync-figma-to-tokens` and `sync-tokens-to-figma` npm scripts: use `dta pull` and `dta push`.
- Repository scripts that only served v1: `npm run build` (use `dta build`), `build:cli`, `prepare`.
