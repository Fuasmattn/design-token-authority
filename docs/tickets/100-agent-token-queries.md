# TICKET-100: `dta token get | find | list`

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 2)

## What to build

Read-only token queries on the token files, for people, CI and agents:

- `dta token get <name> [--mode <collection>=<mode>]…`: type, description, collection, the value in every mode (or the selected ones), the alias chain per mode, and the names to use in code (CSS custom property via `cssVariableName`, Tailwind theme key). An unknown name exits 1 and suggests the closest names.
- `dta token find --value <value> [--type …] [--near]`: every token that resolves to the value in some mode, semantic tokens before the primitive, with the mode. Colours normalised; `--near` uses `colorsApproximatelyEqual`.
- `dta token list [--collection …] [--type …] [--match <glob>]`: names with type and collection, sorted.
- `--format console|json`; JSON shape `dta.token/1` with a JSON Schema published on the website.

## Acceptance criteria

- [ ] `@dta/core`: `listTokens`, `findTokensByValue` and a per-mode resolution summary on a model, tested through the public API (alias chains across modes, near colours, unknown names)
- [ ] `@dta/build`: Tailwind theme key per token next to `cssVariableName`
- [ ] `dta token` with the three subcommands; snapshot scenarios on `brand-ab` (console and JSON) recorded by name
- [ ] JSON Schema for `dta.token/1` published under `/schemas/`; the generated Commands reference shows the command
- [ ] All gates pass, and the GitHub run is green
