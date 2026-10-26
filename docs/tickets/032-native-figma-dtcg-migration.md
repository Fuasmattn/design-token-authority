# TICKET-032: Check Figma's native DTCG export against `dta pull --from-file`

**Phase:** 7 — AI Interop
**Priority:** Medium
**Effort:** S
**Blocked by:** a real export from Figma (the maintainer provides it)
**Status:** open (rewritten 2026-10-26; the original plan targeted the v1 importers, which were removed in TICKET-039)

## Problem

Figma is rolling out a native variable export and import in the DTCG format. DTA already reads DTCG 2025.10 (Phase 12) and its own per-mode files, and converts tokenHaus exports through an adapter. Nobody has checked a real native Figma export against `dta pull --from-file` yet, so the docs can only say it "will work".

## What to build

1. **A real export as a fixture.** The maintainer exports variables from a Figma file with at least two collections, one with several modes and aliases across collections. Brand names replaced by BrandA/BrandB, then committed under `test/fixtures/` (name: `figma-native-export`).
2. **Run it through the import.** `dta pull --from-file` on the fixture. `detectFormat` in `@dta/figma` must name the format (DTCG per mode, or a new adapter if Figma's layout differs). Whatever it cannot read becomes a small adapter in `packages/figma/src/adapters/`, like the tokenHaus one.
3. **Aliases survive.** Aliases across collections stay aliases after the import; anything that falls back to a raw value prints a warning instead of converting silently.
4. **A snapshot.** A CLI snapshot scenario on the fixture (`pnpm snapshot:record --scenario figma-native-export/pull`), so a later change to the import shows up as a diff.
5. **Docs.** The website's Token files page and the Figma plan section of `CLAUDE.md` name the native export as the default path for non-Enterprise plans, tokenHaus as a fallback, and the REST API as live sync for Enterprise.

## Acceptance criteria

- [ ] Fixture from a real Figma export committed, no real brand names
- [ ] `dta pull --from-file` reads it without plugin-specific steps; aliases across collections preserved or warned about
- [ ] Snapshot scenario recorded and reviewed
- [ ] Token files page and `CLAUDE.md` updated; the "Outlook" note in `CLAUDE.md` replaced by the checked state
- [ ] Gates pass

## Notes

- If Figma's export drops aliases or metadata the model needs, record the decision here: accept the loss with a warning, or keep the REST path as the only lossless one.
- Keep the tokenHaus adapter; it still serves files exported before the native feature.
