# TICKET-049: Build: package scaffold and base layer CSS

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033, TICKET-040
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Create `packages/build` (`@dta/build`, private, depends on `@dta/core` and `style-dictionary`) with `buildOutputs(model, options)` producing the base layer, `output/css/base.css`, in memory through Style Dictionary v4 (`tokens` objects, `formatAllPlatforms`). This ticket fixes the architecture the other tickets extend: model → token tree builder → emit/reference sets → Style Dictionary → files.

## Acceptance Criteria

- [x] `packages/build` scaffolded like the other packages (package.json, tsconfig, vitest project, entry-point-only exports); boundary check passes
- [x] `buildOutputs` returns `{ files, diagnostics }`; for both fixtures `output/css/base.css` is byte-identical to `test/snapshots/<fixture>/build/files/output/css/base.css`
- [x] Base layer = tokens of single-mode collections; multi-mode collections are reference context only (first mode alphabetically); self-referencing aliases are dropped
- [x] A name collision between an emitted token and reference context does not throw; broken references are warning diagnostics
- [x] No file is read or written (test with an empty temp cwd); token files and the input model are not mutated
- [x] Model with no collections returns no files and no error
- [x] Transforms and the transform group needed for CSS are ported (name/kebab-deduped, value/dimension-px, value/opacity-decimal), tested through crafted models
- [x] 039 parity table: `build` row annotated (base layer done); `style-dictionary.config.ts` and `removedollarsigns.sh` rows added if missing
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/build/src/`: `tree.ts` (sources → merged DTCG tree + origin per token, self-reference stripping, broken-reference warnings), `transforms.ts` (hooks registered per Style Dictionary instance, no global state), `build.ts` (`buildOutputs`, Style Dictionary run through `formatAllPlatforms`, nothing written), `index.ts` (exports `buildOutputs` and the option/result types).
- A source is one (collection, mode); the merge replaces a token completely when a later source defines the same path, as Style Dictionary does for token files. Order: single-mode collections first, then the first mode (alphabetical) of each multi-mode collection (reference context). The emit filter uses the origin kept next to the tree instead of `token.filePath`.
- `style-dictionary` types accept `brokenReferences: 'throw' | 'console'` only; legacy passed `'warn'`, which behaves like `console` under `verbosity: 'silent'`. We use `'console'` and report broken references ourselves as `broken-reference` warning diagnostics (with the token path).
- Quirk kept for parity: a Brand token that aliases its own path is removed after the merge, which also removes the Primitive it shadowed (covered by a test; fixing it is a feature after parity).
- A model with only multi-mode collections produces no base file (legacy skipped Phase A when there were no single-mode collections).
- Both fixtures' `base.css` equal the snapshots byte for byte.
- 039: `build` row now points to TICKETs 049–054; further rows are updated by the later tickets.
