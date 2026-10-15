# Spec: @dta/core — token model, aliases, graph analysis

**Status:** ready-for-agent
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 2
**Related:** ADR 0001, ADR 0002, TICKET-039 (legacy removal)

## Problem

Legacy keeps the token model spread over `token_types.ts`, `color.ts`, parts of `token_export.ts` / `token_import.ts` and a 2000-line `graph.ts` that mixes analysis, file reading and four report formatters. Alias lookup is order-dependent (first file with a matching name wins), bad input is thrown or silently skipped, and nothing is usable without the file system.

## Solution

`@dta/core` becomes the pure, stable centre: an in-memory token model, lossless DTCG parse/serialize, alias resolution with Figma-style mode selection, and graph analysis. It has no dependency on any other `@dta/*` package and does not touch the file system.

## Decisions (grilled with the maintainer)

1. **Scope: analysis only.** Core owns the model, DTCG parse/serialize, alias resolution, color utilities and graph analysis (cycles, dangling aliases, orphans, chain depth, stats). The graph report formatters (console, DOT, Markdown, HTML) are presentation and belong to the CLI side (Epic 6).
2. **Pure, no fs.** Core receives already-read file contents and returns data. Reading and writing files is the job of `@dta/cli` and `@dta/figma`. This keeps core testable and reusable (e.g. an MCP server later).
3. **Color in core.** `parseColor`, hex conversion, approximate equality and contrast ratio are part of core's public API (color is a token type used by figma, lint and build).
4. **Model shape.** Collections → modes → flat tokens. A token has a name, a type, a value per mode, an optional description, and its `com.figma` extension data. Files are one per collection + mode (`{Collection}.{Mode}.json`; split at the last dot before `.json`).
5. **Names are path segments.** A token name is an array of segments (`['Colors','Brand','Primary']`). Helpers render the dot form (JSON aliases) and the slash form (Figma). Variable names stay unique across collections (existing invariant).
6. **Alias resolution uses a mode selection.** `resolve` takes a selection mapping collection → mode (default: each collection's first mode). An alias finds its target by unique name and reads the value in the mode selected for the target's collection. This replaces legacy's first-file-wins lookup.
7. **Graph nodes are per token and mode**, like legacy, so counts and report shapes stay comparable. Edges are mode-aware (a BrandA token points at the target in the mode selected for the target's collection). If a fixture's graph snapshot changes because of this, it is a reviewed diff and the quirk is recorded in TICKET-039.
8. **Diagnostics, never throw.** Parsing and analysis return the result plus a list of diagnostics (severity, code, file, token path, message). Callers decide what is fatal. Throwing is for programmer errors only.
9. **Plain data + pure functions.** The model is JSON-serializable data; the API is functions (`parseTokenFiles`, `serializeTokenFiles`, `resolve`, `analyzeGraph`, …), not classes.
10. **Lossless round trip.** Parse → serialize of an untouched file yields identical content: key order, `$description`, and unknown `$extensions` are preserved, so pulling produces no git diff.
11. **Unsupported `$type`** (e.g. composite types from plugins): a warning diagnostic; the token is excluded from analysis but preserved on serialize. Revisit when a plugin import needs it.

## Public API sketch (names may change in TICKET-040)

- Types: `TokenModel`, `Collection`, `Token`, `TokenName`, `TokenType`, `TokenFileInput`, `Diagnostic`, `ModeSelection`, `GraphAnalysis`.
- Functions: `parseTokenFiles`, `serializeTokenFiles`, `parseAlias` (exists), `nameToDot`, `nameToSlash`, `resolve`, `analyzeGraph`, `parseColor`, `toHex`, `colorsApproximatelyEqual`, `contrastRatio`.

## Out of scope

Figma payload conversion (`@dta/figma`), report formatting, lint rules, config, any file I/O.

## Testing

Through the public API only (gray-box). Ported legacy unit tests are re-expressed through the new API. Graph results are cross-checked against the existing `graph-*` snapshots in Epic 6; until then, package tests use the two fixtures read by the test itself.

## Tickets

[040](../tickets/040-core-model-parse-serialize.md) · [041](../tickets/041-core-color-utils.md) · [042](../tickets/042-core-uniqueness-alias-resolution.md) · [043](../tickets/043-core-graph-analysis.md)
