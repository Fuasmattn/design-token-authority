# TICKET-135: Read `.tokens` and `.tokens.json` files

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** S
**Blocked by:** 132
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decision 12; slice 4)

## What to build

- `readTokenDir` (and the diff base reader) also read `*.tokens` and `*.tokens.json`; the extension is checked before the `{Collection}.{Mode}.json` pattern, so `app.tokens.json` is collection `app`, single mode.
- Accepted with media type `application/design-tokens+json` or `application/json` where a type is known (playground uploads).
- The playground accepts these files.

## Acceptance criteria

- [ ] Tests: `.tokens`, `.tokens.json`, mixed with per-mode files, a name clash between the two forms reported
- [ ] Token files reference documents both forms
- [ ] All gates pass, and the GitHub run is green
