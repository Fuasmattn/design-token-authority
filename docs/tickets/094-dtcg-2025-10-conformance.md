# TICKET-094: Read DTCG 2025.10 token files and resolver documents

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** L (split before starting)
**Blocked by:** —
**Status:** open
**Related:** TICKET-032 (Figma's native DTCG export)

## Background

Found while writing the Learn DTCG pages (073). DTA reads per-mode files in the shape of Figma variables. Compared with the stable [DTCG 2025.10](https://www.designtokens.org/TR/2025.10/) modules, it does not yet:

- inherit `$type` from groups (a token without its own `$type` is `missing-type`);
- read the 2025.10 value shapes: `color` as `{ colorSpace, components, alpha?, hex? }` (fails as `invalid-value`), `dimension` and `duration` as `{ value, unit }`, and the other types (`fontFamily`, `fontWeight`, `cubicBezier`, composites), which are skipped as `unsupported-type`;
- resolve `$root`, `$extends` and `$ref` (JSON Pointer) references;
- read `.tokens` / `.tokens.json` files or resolver documents (`*.resolver.json`: sets, modifiers, contexts, `resolutionOrder`), including combining two modifiers such as brand × theme.

## What to build

A spec (or ADR) first: how DTCG 2025.10 files and resolver documents map onto the token model (collections and modes) and back, what `dta push` does with types Figma variables cannot hold, and the order of the slices. Then one ticket per slice, for example: group `$type` inheritance → colour and dimension objects in → `$root`/`$extends`/`$ref` → resolver documents in → combined modifiers in the build.

## Acceptance criteria

- [ ] Spec approved by the maintainer, with the slices as tickets in the index
- [ ] The "Where DTA differs" list on the Learn DTCG page updated as each slice lands
