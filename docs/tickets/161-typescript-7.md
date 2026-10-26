# TICKET-161: TypeScript 5.9 → 6.0 → 7

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** M
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

TypeScript 7 (stable since August 2026) is the native Go compiler: much faster type checks, but its programmatic API is not stable yet (expected in 7.1). Tools that call the compiler API cannot use 7.0. Here that is at least `rollup-plugin-dts` (the npm package's `.d.ts`, `scripts/package/dts.config.mjs`) and `astro check` (site typecheck). The TypeScript team recommends going through 6.0 first; 7.0 turns 6.0's deprecations into errors and makes `strict` the default.

## What to build

Two steps, each its own commit and green CI run:

1. **6.0.** Bump `typescript` to 6.0 everywhere, fix all deprecation warnings in the tsconfigs (`tsconfig.base.json`, packages, scripts, site). Nothing else changes.
2. **7.0 for type checking.** `typescript` 7 for `tsc --noEmit` (root `typecheck`, every package). Tools that need the compiler API keep 6.0 through the official `@typescript/typescript6` package (npm alias), so `rollup-plugin-dts` and `astro check` keep working. Record which tool uses which version.

Measure `pnpm typecheck` time before and after.

## Acceptance criteria

- [ ] Step 1: no deprecation warnings; safety check of the spec green
- [ ] Step 2: `tsc` is 7.x for all `typecheck` scripts; `package:build` produces the same `dist/*.d.ts` (diff before and after); `astro check` green
- [ ] Safety check of the spec green after each step
- [ ] Notes: typecheck time before/after, which tools stay on 6.0, and when to drop the alias (when `rollup-plugin-dts` and Astro support 7.1)

## Notes

`tsx` (runs the sources) and Vitest transpile with esbuild and do not use `tsc`, so they are not affected; check anyway.
