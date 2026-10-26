# TICKET-161: TypeScript 5.9 → 6.0 → 7

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** M
**Status:** in review (2026-10-26), branch `161-typescript-7`, two commits
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

TypeScript 7 (stable since August 2026) is the native Go compiler: much faster type checks, but its programmatic API is not stable yet (expected in 7.1). Tools that call the compiler API cannot use 7.0. Here that is at least `rollup-plugin-dts` (the npm package's `.d.ts`, `scripts/package/dts.config.mjs`) and `astro check` (site typecheck). The TypeScript team recommends going through 6.0 first; 7.0 turns 6.0's deprecations into errors and makes `strict` the default.

## What to build

Two steps, each its own commit and green CI run:

1. **6.0.** Bump `typescript` to 6.0 everywhere, fix all deprecation warnings in the tsconfigs (`tsconfig.base.json`, packages, scripts, site). Nothing else changes.
2. **7.0 for type checking.** `typescript` 7 for `tsc --noEmit` (root `typecheck`, every package). Tools that need the compiler API keep 6.0 through the official `@typescript/typescript6` package (npm alias), so `rollup-plugin-dts` and `astro check` keep working. Record which tool uses which version.

Measure `pnpm typecheck` time before and after.

## Acceptance criteria

- [x] Step 1: no deprecation warnings; safety check of the spec green
- [x] Step 2: `tsc` is 7.x for all `typecheck` scripts; `package:build` produces the same `dist/*.d.ts` (diff before and after); `astro check` green
- [x] Safety check of the spec green after each step
- [x] Notes: typecheck time before/after, which tools stay on 6.0, and when to drop the alias (when `rollup-plugin-dts` and Astro support 7.1)

## Notes

`tsx` (runs the sources) and Vitest transpile with esbuild and do not use `tsc`, so they are not affected; check anyway.

Outcome (2026-10-26).

**Step 1, 6.0.3 everywhere** (commit 1): no deprecation diagnostic in any of the 15 tsconfigs (the base already uses `NodeNext`, `verbatimModuleSyntax`, `isolatedModules`, `strict`); typecheck, `astro check` and every test unchanged.

**Step 2, 7.0.2 for type checking** (commit 2):

- `typescript` 7.0.2 in the root and the eight packages: every `tsc --noEmit` runs the native compiler.
- `site` stays on `typescript` 6.0.3: `@astrojs/check` (through `@volar/kit`) peers on `^5 || ^6` and needs the compiler API, which 7.0 does not ship (expected in 7.1).
- `rollup-plugin-dts` 6.5.1 (also in TICKET-156) supports 7 by loading the compiler API from `@typescript/typescript6`; without it the build says so plainly. `@typescript/typescript6` 6.0.2 added at the root. `dist/index.d.ts` byte-identical to main.
- `tsx` and Vitest transpile with esbuild and never saw a difference (checked: all tests green on both steps).

**Time** (this machine, warm): `pnpm typecheck` 39.6 s on 6.0 → 21.5 s on 7; the 12 package and script projects alone 5.2 s on 7. What is left is the site's `tokens`, `reference` and `astro check` steps, which stay on 6.0.

**When to drop the extra version:** when `@astrojs/check` and `rollup-plugin-dts` run on TypeScript 7.1's API: move `site` to 7, remove `@typescript/typescript6`. Check on the next Astro bump.
