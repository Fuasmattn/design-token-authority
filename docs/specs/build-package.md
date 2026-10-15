# Spec: @dta/build — token model to CSS, JS and Tailwind output files

**Status:** ready-for-review
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 4
**Depends on:** [@dta/core](./core-token-model.md) (Epic 2)
**Related:** ADR 0001, TICKET-039 (parity table), the `build` snapshots in `test/snapshots/*/build`

## Problem

Legacy `commands/build.ts` is one 400-line function that mixes file discovery (globs over `tokens/`), Style Dictionary setup, four build phases, output writing and console output. Which tokens end up in which file is decided by glob patterns and by matching `token.filePath` substrings. Transforms and formats are registered globally inside the command, a `strip-self-refs` preprocessor patches around Brand tokens that share a path with Primitives, and the JS output path is hardcoded. None of it can be tested without files on disk and a full Style Dictionary run, and the exact output contract only exists as the recorded `build` snapshots.

## Solution

`@dta/build` turns a `@dta/core` token model into output files **in memory**: `buildOutputs(model, options)` returns the files (path and content) plus diagnostics, and touches neither the file system nor the console. The CLI writes the files and prints the summary. Style Dictionary v4 stays the engine, fed with tokens built from the model instead of globs, and driven through its in-memory API (`formatAllPlatforms`). Selecting which tokens go where becomes explicit data (emit set vs. reference-only set) instead of filename matching.

The contract for this epic is **parity**: the CSS, JS and Tailwind files for both fixtures are byte-identical to the legacy snapshots.

## Decisions

1. **Scope.** `@dta/build` = model in, output files out: CSS variables (base, shared, per-brand themes), the JS colour palette, Tailwind v3 and v4 (shared and per-brand). Writing files, `clean`, console output and config loading are CLI (Epic 6).
2. **Dependencies.** Depends on `@dta/core` and `style-dictionary` (v4, already used); never on `@dta/figma` or `@dta/cli`. Replacing Style Dictionary stays out of scope (overhaul spec).
3. **Pure and in memory.** `buildOutputs(model, options)` → `{ files: { path, content }[], diagnostics }`. Paths are relative to the project root and built from the output directories in `options` (defaults as in legacy: `output/css`, `output/tailwind`). Files are sorted by path and contain no timestamps, so two runs on the same model are identical. Style Dictionary runs from `tokens` objects built from the model; no globs, no `filePath` matching, no `removedollarsigns.sh`, and token files are never mutated.
4. **Token selection is data.** For each output the package builds two sets from the model: tokens to _emit_ and tokens that are only _reference context_. Legacy rules, kept for parity: single-mode collections form the base layer; each configured brand adds that brand's mode of every multi-mode collection; for the base and shared outputs the first mode (alphabetical) of each multi-mode collection is reference context only; a token whose alias points at its own path is dropped (the `strip-self-refs` rule), because Brand tokens may shadow Primitives of the same name.
5. **Brands come from options.** `options.brands` lists the brands; none configured means no per-brand output (legacy behaviour). Deriving brands from `analyzeStructure` is a feature that waits until parity. A brand that is not a mode of any multi-mode collection yields a warning diagnostic and no files.
6. **Diagnostics instead of throwing.** Broken references are warnings (legacy ran with `brokenReferences: 'warn'`), unknown brands are warnings, a model with no collections yields no files and no error. Nothing throws for data problems.
7. **Parity first, known debt later.** Transforms (`name/kebab-deduped`, `value/dimension-px`, `value/opacity-decimal`) and the Tailwind v3/v4 formatters are ported as they are, including the output quirks that tickets 003/004 describe. Quirks are listed in 039; fixing them is a reviewed snapshot diff after parity. Output stays `$`-key based (Style Dictionary v4 DTCG mode).
8. **Docs HTML is not part of this package.** `formatters/docs-html.ts` (1.5k lines, `output/docs/index.html`) is the seed of the docs site (Epic 7). Until that epic decides, it is a row in 039 and the CLI keeps calling the legacy generator for the `build` snapshot; `@dta/build` parity covers `output/css`, `output/js` and `output/tailwind` only.
9. **Quirks that live in the CLI, not here.** The summary prints `build/js/colorpalette.js` while the file is written to `output/js/`, and the JS directory is hardcoded. The package returns the real path (`output/js/colorpalette.js`); the summary fix is a reviewed snapshot diff in the CLI epic.
10. **Testing seam.** Through the public API only: both fixtures' models (parsed with `parseTokenFiles`) produce exactly the files under `test/snapshots/<fixture>/build/files/output/{css,js,tailwind}`; crafted small models cover transforms, formatters and the diagnostics; a determinism test runs twice; a test proves no file is written (cwd is a temp dir that stays empty). Legacy `tailwind-v3.test.ts` and `tailwind-v4.test.ts` cases are re-expressed through `buildOutputs`.
11. **Boundary and wiring.** The CLI epic calls `buildOutputs`; until then the `build` scenario stays in `PENDING`. Each ticket updates its 039 rows; legacy build files are deleted with the CLI port, not before.

## Public API sketch (names may change in the tickets)

- `buildOutputs(model, options)` → `{ files, diagnostics }`
- `BuildOptions`: `{ brands?, collections?, css?: { outDir }, tailwind?: { outDir } }`
- `OutputFile`: `{ path, content }`

## Out of scope

Docs HTML (Epic 7), iOS/Android/Compose outputs (TICKET-011–013, after parity), per-target configuration beyond the legacy options, brand auto-detection, fixing known output debt (TICKET-003/004), file writing, `clean`, console output.

## Tickets

[049](../tickets/049-build-scaffold-base-css.md) · [050](../tickets/050-build-shared-css-js.md) · [051](../tickets/051-build-brand-themes.md) · [052](../tickets/052-build-tailwind-v4.md) · [053](../tickets/053-build-tailwind-v3.md) · [054](../tickets/054-build-api-parity.md)
