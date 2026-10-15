# TICKET-049: Build: package scaffold and base layer CSS

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033, TICKET-040
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Create `packages/build` (`@dta/build`, private, depends on `@dta/core` and `style-dictionary`) with `buildOutputs(model, options)` producing the base layer, `output/css/base.css`, in memory through Style Dictionary v4 (`tokens` objects, `formatAllPlatforms`). This ticket fixes the architecture the other tickets extend: model → token tree builder → emit/reference sets → Style Dictionary → files.

## Acceptance Criteria

- [ ] `packages/build` scaffolded like the other packages (package.json, tsconfig, vitest project, entry-point-only exports); boundary check passes
- [ ] `buildOutputs` returns `{ files, diagnostics }`; for both fixtures `output/css/base.css` is byte-identical to `test/snapshots/<fixture>/build/files/output/css/base.css`
- [ ] Base layer = tokens of single-mode collections; multi-mode collections are reference context only (first mode alphabetically); self-referencing aliases are dropped
- [ ] A name collision between an emitted token and reference context does not throw; broken references are warning diagnostics
- [ ] No file is read or written (test with an empty temp cwd); token files and the input model are not mutated
- [ ] Model with no collections returns no files and no error
- [ ] Transforms and the transform group needed for CSS are ported (name/kebab-deduped, value/dimension-px, value/opacity-decimal), tested through crafted models
- [ ] 039 parity table: `build` row annotated (base layer done); `style-dictionary.config.ts` and `removedollarsigns.sh` rows added if missing
- [ ] All gates pass, and the GitHub run is green
