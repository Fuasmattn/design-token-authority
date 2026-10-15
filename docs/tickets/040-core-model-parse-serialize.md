# TICKET-040: Core: token model, DTCG parse and serialize, diagnostics

**Phase:** 8 — Token Engine Overhaul, Epic 2 (@dta/core)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-033
**Status:** ready-for-agent
**Spec:** [core-token-model](../specs/core-token-model.md)

## What to build

The tracer bullet for `@dta/core`: an in-memory token model plus lossless parse and serialize of per-mode DTCG token files, reporting problems as diagnostics. Pure functions, no file system.

## Acceptance Criteria

- [ ] `parseTokenFiles(files)` takes `{ fileName, content }[]` and returns `{ model, diagnostics }`; collection and mode come from `{Collection}.{Mode}.json` (split at the last dot before `.json`)
- [ ] A token has a name (path segments), type (`color`, `number`, `string`, `boolean`), a value per mode, optional description and the `com.figma` extension data
- [ ] Modes of one collection are merged into one token with a value per mode; a token missing in some modes yields a diagnostic
- [ ] `serializeTokenFiles(model)` returns the file set; parse then serialize of both fixtures (`test/fixtures/*/tokens`) gives byte-identical content (key order, `$description`, unknown `$extensions` preserved)
- [ ] Bad input never throws: invalid JSON, empty file, bad file name, missing `$type`/`$value`, unsupported `$type` (warning; preserved on serialize) each produce a diagnostic with file, token path, code and message
- [ ] `nameToDot` and `nameToSlash` helpers; `parseAlias` stays exported
- [ ] Tests only through the package's public API; index exports a small surface; `pnpm run guardrails:boundaries` passes
- [ ] 039 parity table: `token_types.ts` row updated
- [ ] All gates pass
