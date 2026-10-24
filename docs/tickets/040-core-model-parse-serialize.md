# TICKET-040: Core: token model, DTCG parse and serialize, diagnostics

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033
**Status:** done
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

The tracer bullet for `@dta/core`: an in-memory token model plus lossless parse and serialize of per-mode DTCG token files, reporting problems as diagnostics. Pure functions, no file system.

## Acceptance Criteria

- [x] `parseTokenFiles(files)` takes `{ fileName, content }[]` and returns `{ model, diagnostics }`; collection and mode come from `{Collection}.{Mode}.json` (split at the first dot, so mode names may contain dots: `border.1.5.json` is collection `border`, mode `1.5`)
- [x] A token has a name (path segments), type (`color`, `number`, `string`, `boolean`), a value per mode, optional description and the `com.figma` extension data
- [x] Modes of one collection are merged into one token with a value per mode; a token missing in some modes yields a diagnostic
- [x] `serializeTokenFiles(model)` returns the file set; parse then serialize of both fixtures (`test/fixtures/*/tokens`) gives byte-identical content (key order, `$description`, unknown `$extensions` preserved)
- [x] Bad input never throws: invalid JSON, empty file, bad file name, missing `$type`/`$value`, unsupported `$type` (warning; preserved on serialize) each produce a diagnostic with file, token path, code and message
- [x] `nameToDot` and `nameToSlash` helpers; `parseAlias` stays exported
- [x] Tests only through the package's public API; index exports a small surface; `pnpm run guardrails:boundaries` passes
- [x] 039 parity table: `token_types.ts` row updated
- [x] All gates pass

## Implementation notes

- `parseTokenFiles` / `serializeTokenFiles` live in `packages/core/src/{parse,serialize,entries}.ts`; only the public API in `index.ts` is used by tests.
- Lossless round trip works by keeping each parsed file (`Collection.sources`, opaque) and updating it in place on serialize: `$type`/`$value` always follow the model; `$description`/`$extensions` are written only when the model changed them, so per-mode differences survive. Indentation and trailing newline are detected per file (the DaisyUI fixture has no trailing newline).
- File names split at the **first** dot (spec corrected): collection names cannot contain dots, mode names can.
- Modes and collections are sorted by name, not in Figma order. The figma epic must carry mode order itself if it matters for push.
- JavaScript orders integer-like keys numerically, so a file whose integer-like keys are not ascending would be re-ordered. Both fixtures are unaffected.
- Not in the model yet (kept untouched in the source files): tokens with an unsupported `$type`, group-level `$type`/`$description`.
- 039 parity table: `token_types.ts` is covered by the core model; the legacy file stays until figma and build packages stop using it.
