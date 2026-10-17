# TICKET-032: Migrate to Figma's native W3C DTCG export/import

**Phase:** 7 — AI Interop
**Priority:** Medium
**Effort:** M

## Summary

Track and adopt Figma's upcoming **native** W3C DTCG variable export/import (announced at Schema 2025, rolling out through 2026). Replace the current reliance on community plugins (tokenHaus etc.) as the default non-Enterprise path. Keep the REST API path for Enterprise customers.

## Background

Today the project has three ingestion paths:

1. **Figma REST API** (`getLocalVariables`) — works only on Enterprise plans.
2. **`--from-file` with community plugin exports** (tokenHaus detector in `src/importers/tokenhaus.ts`) — works on all plans but requires an external plugin in the designer's flow.
3. **DTCG per-mode files** (native format).

When Figma ships native DTCG export, path 2 becomes redundant and path 1 becomes optional — any plan can export DTCG natively. The project should:

- Detect native Figma DTCG exports and import them directly.
- Deprecate tokenHaus-specific handling (keep as a fallback, not the default).
- Position the REST API as the "live sync" path for Enterprise, and DTCG files as the portable default.

Getting this right matters because it's the one area where the project is most exposed to being commoditized by the platform. Adopting early keeps the tool ahead of the transition rather than broken by it.

## Acceptance Criteria

- [ ] Tracking: monitor Figma Schema 2025 rollout; record the native DTCG schema once published.
- [ ] Update `src/importers/detect.ts` to recognize Figma-native DTCG files as a first-class format.
- [ ] `dta pull --from-file <native-figma-export>` works without any plugin-specific handling.
- [ ] Documentation updated to recommend the native path for non-Enterprise plans; tokenHaus demoted to "legacy / fallback."
- [ ] Init wizard (TICKET-015) updates: the "which plan?" branch offers native DTCG as the recommended path.
- [ ] REST API path unchanged for Enterprise customers but clearly framed as "live sync" in docs — the native export is framed as the default for most teams.
- [ ] Conformance tests: one golden native-Figma DTCG fixture committed, exercised on every import path change.
- [ ] Decision recorded: if the native export drops alias preservation or metadata, does the tool fall back to an extended format, or do we accept the loss? Document the answer in the ticket resolution.

## Implementation Notes

**Format detection:** Figma's native export will likely carry an identifying marker (`$schema` URL or a `com.figma` section at the root). `detect.ts` should check for that marker first, falling back to current heuristics.

**Schema drift watch:** Until the native export is stable, do not remove the tokenHaus importer. Flag it deprecated but keep it compilable.

**Graceful alias fallback:** If the native format doesn't preserve alias references in some edge case, emit a warning during import rather than silently converting to raw values — the whole 3-layer model (Primitives → Brand → ScreenType) depends on aliases surviving the round trip.

**README update:** The current README lists three compatible plugins. Once native export lands, those become a "fallback" section; the recommended path for all non-Enterprise teams is the native export.

**Timing:** Figma's rollout is gradual through late 2026. A tracking issue with regular check-ins (quarterly) is more useful than a single sprint; turn this into a living ticket until the native export is broadly available.

## Dependencies

- TICKET-014 (autodiscovery — same analysis engine over the new format)
- TICKET-015 (init wizard — branches update)
- No hard blockers on our side; paced by Figma's rollout.

## Why this is important

This is the ticket that prevents `design-token-authority` from being framed as "a Figma import-export convenience" — a positioning that becomes indefensible once Figma ships native DTCG. Adopting the native format early keeps the project at the layer *above* import/export: governance, multi-brand composition, code-side enforcement, and AI interop. That layer is not something Figma will build.
