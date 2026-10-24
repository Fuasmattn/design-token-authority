# TICKET-100: `dta token get | find | list`

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** done
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 2)

## What to build

Read-only token queries on the token files, for people, CI and agents:

- `dta token get <name> [--mode <collection>=<mode>]…`: type, description, collection, the value in every mode (or the selected ones), the alias chain per mode, and the names to use in code (CSS custom property via `cssVariableName`, Tailwind theme key). An unknown name exits 1 and suggests the closest names.
- `dta token find --value <value> [--type …] [--near]`: every token that resolves to the value in some mode, semantic tokens before the primitive, with the mode. Colours normalised; `--near` uses `colorsApproximatelyEqual`.
- `dta token list [--collection …] [--type …] [--match <glob>]`: names with type and collection, sorted.
- `--format console|json`; JSON shape `dta.token/1` with a JSON Schema published on the website.

## Acceptance criteria

- [x] `@dta/core`: `listTokens`, `findTokensByValue` and a per-mode resolution summary on a model, tested through the public API (alias chains across modes, near colours, unknown names)
- [x] `@dta/build`: Tailwind theme key per token next to `cssVariableName`
- [x] `dta token` with the three subcommands; snapshot scenarios on `brand-ab` (console and JSON) recorded by name
- [x] JSON Schema for `dta.token/1` published under `/schemas/`; the generated Commands reference shows the command
- [x] All gates pass, and the GitHub run is green

## Outcome

- `@dta/core` `query.ts`: `describeToken` (one reading per mode combination the alias chain goes through), `findTokensByValue`, `listTokens`, `suggestTokenNames`. `@dta/build`: `tailwindThemeProperty`, the Tailwind v4 formatter's own mapping, exported.
- The CLI registry gained group commands (`parent`) and positional arguments; `commandReference()` names subcommands in full (`token get`), so the generated Commands page has a section per subcommand.
- Deviations from the spec, on purpose: `find` takes the value as an argument (`dta token find '#003f8a'`), not `--value`; `--near` uses a 2 % per-channel threshold in the query module. Names for code are given only for tokens `dta build` writes (single-mode collections, and multi-mode collections in the modes listed in `brands`): the fixture's `ScreenType` tokens resolve, but have no CSS variable, so `find` lists them last and `get` says so.
- Snapshot scenarios `token-get` (also `-json`, `-unknown`), `token-find` (also `-json`) and `token-list` on `brand-ab`; JSON output validated against `/schemas/dta.token.schema.json` in the tests. Docs: [Token queries](../../site/src/content/docs/reference/token-queries.mdx), exit codes.
