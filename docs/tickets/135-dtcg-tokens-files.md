# TICKET-135: Read `.tokens` and `.tokens.json` files

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** S
**Blocked by:** 132
**Status:** done
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decision 12; slice 4)

## What to build

- `readTokenDir` (and the diff base reader) also read `*.tokens` and `*.tokens.json`; the extension is checked before the `{Collection}.{Mode}.json` pattern, so `app.tokens.json` is collection `app`, single mode.
- Accepted with media type `application/design-tokens+json` or `application/json` where a type is known (playground uploads).
- The playground accepts these files.

## Acceptance criteria

- [x] Tests: `.tokens`, `.tokens.json`, mixed with per-mode files, a name clash between the two forms reported
- [x] Token files reference documents both forms
- [x] All gates pass, and the GitHub run is green

## Notes

- A `.tokens` / `.tokens.json` file is one collection named after the file, in one mode named `Value` (`SINGLE_MODE`, the name the fixtures use for single-mode collections). Core exports `tokenFileParts` and `isTokenFileName`.
- `readTokenDir` and the `dta diff` base reader skip `*.resolver.json` already, so TICKET-136 can read resolver documents on their own.
- Playground: the file picker accepts `.tokens` and `application/design-tokens+json`; a single `.tokens` file never goes through plugin-export detection. The drop zone's hint names `.tokens` files (a copy change on the playground, so it is in the screenshots before a push).
- The `duplicate-file` message now names the file that already holds the collection and mode.
