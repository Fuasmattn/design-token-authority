# TICKET-175: `deepmerge` advisory, and `__proto__` keys in token files

**Phase:** 13 — Maintenance
**Priority:** High
**Effort:** S
**Status:** in review (2026-10-28), branch `175-deepmerge-advisory`
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

1. `pnpm audit` fails on every pull request since 2026-10-28: GHSA-gcqx-w48m-w2h4 (low), `deepmerge` 4.2.0–4.3.1, through `style-dictionary` → `@bundled-es-modules/deepmerge`. A `__proto__` key in a merged object sets the prototype of the result. No fixed version of `deepmerge` exists, and `style-dictionary` 5.7.1 is the newest.
2. Found while checking whether token data reaches `deepmerge`: a token group named `__proto__` made `dta build` fail with "Maximum call stack size exceeded" (Style Dictionary's reference map looped on it), and `dta lint` passed the file without a word. A `__proto__` key inside a value (a shadow, a dimension) was kept in the model and handed to Style Dictionary.

## What to build

- Read token and resolver files without any `__proto__` key, at any depth, and report each file that had one as an error (`reserved-key`).
- Ignore the advisory in `pnpm-workspace.yaml` with the reason and when to drop it, as for `basic-ftp`.
- Docs: the token files reference says so.

## Acceptance criteria

- [x] A `__proto__` group or value key is left out and reported; `dta lint` and `dta build` fail with the message instead of a stack overflow
- [x] `pnpm audit` passes with the ignore and its reason
- [x] Safety check of the maintenance spec green

## Notes

Where Style Dictionary uses `deepmerge` (5.7.1): its options getter and `extend` (config, hooks and, through `tokens` in the options, DTA's token tree, `packages/build/src/build.ts`), the log config, hook registration and the DTCG type map. Token values themselves are merged with its own `deepExtend`. So the only way outside data reaches `deepmerge` is the token tree, which no longer carries a `__proto__` key. The config is the project's own code.
