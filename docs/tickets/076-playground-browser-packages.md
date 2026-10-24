# TICKET-076: Run the `@dta/*` packages in the browser

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** M
**Blocked by:** 069
**Status:** done (2026-10-19), pending the GitHub run
**Spec:** [playground](../specs/playground.md) (decisions 1, 9, 11)

## What to build

The package APIs the playground needs (`@dta/core`, `@dta/figma` import/detect, `@dta/lint`, `@dta/build`) run in a browser bundle without Node built-ins, proven by tests in a browser environment. Where a package touched Node APIs, it gets a pure entry point or an injectable file system, not a playground copy.

## Acceptance criteria

- [x] Browser-environment tests call each needed public API on the brand-ab fixture
- [x] Bundle size of each package noted; `@dta/build` (Style Dictionary) loads lazily if heavy
- [x] No change to CLI behaviour: all snapshots unchanged
- [ ] All gates pass, and the GitHub run is green

## Notes

- Pre-check 2026-10-19: no Node built-ins in the packages' source outside `lint/src/test-helpers.ts` and `build/src/test-helpers.ts` (not exported); `@dta/build` formats in memory. Expect the work to be the browser test setup, entry points/exports for bundling (the packages export `./src/index.ts` today) and the size numbers, so the effort may be closer to S.
- Lazy loading of `@dta/build` is decided (spec decision 9), whatever its size.

## Outcome

- **Proof** in `site/browser-packages.test.ts`, with `site/browser-packages/engine.ts` as the entry: the calls the playground makes (`parseTokenFiles`, `analyzeStructure`, `analyzeGraph`, `resolve` from `@dta/core`; `detectFormat`, `importPluginExport` from `@dta/figma`; `lintTokens` from `@dta/lint`; `buildOutputs` from `@dta/build`, imported dynamically). Two halves:
  - **Always (`pnpm test`):** each package's public entry point (`export * from '@dta/…'`) bundles with esbuild for `platform: 'browser'`, and no metafile input is a Node built-in. esbuild has no Node polyfills, so a `node:*` import in a package or any of its dependencies fails the build (checked by temporarily adding `import 'node:path'` to `@dta/core`: all bundles failed with `Could not resolve "node:path"`). Each bundle has a size budget. The engine entry, bundled with code splitting, has no `@dta/build` or Style Dictionary input; they sit in one chunk the entry reaches only through a dynamic import (spec decision 9).
  - **With a browser** (`DTA_E2E=1` or `DTA_BROWSER_PATH`, the convention of `contrast.e2e.test.ts`; added to the site job's `test:contrast` script so CI runs it after installing Chromium): the split bundle runs in headless Chromium on brand-ab (token files, the `lint` section of its `dta.config.ts`, a tokenHaus export of its primitives, `Colors.Brand.Primary` in BrandB). It checks that `process`, `Buffer`, `require` and `global` are undefined, and that every analysis result equals the same call in Node. The `@dta/build` chunk is not requested until outputs are asked for; then the browser's output files equal Node's and match the CLI reference snapshot `test/snapshots/brand-ab/build/files` byte for byte. No page errors.
- **Why not Vitest browser mode:** it needs `@vitest/browser-playwright` plus the full `playwright` package with its own Chromium build, and it serves tests through Vite's dev server. Vite pre-bundles dependencies and only warns when it externalises a Node built-in, so it proves less about "no Node built-ins" than a strict `platform: 'browser'` esbuild bundle, which fails outright. The esbuild route adds one dev dependency (`esbuild` 0.28.2, already in the lockfile through Vite), reuses `playwright-core` and the site's Chromium job, and yields the size numbers from the same bundles. Cross-check, one-off and not committed: Vite 8 (what Astro uses) bundles the same entry for the browser with no built-in warnings, a 149 KB entry and `@dta/build` in a lazy 2.55 MB chunk.
- **Package fix:** no package touched a Node API (as the pre-check said), and the TypeScript entry points (`./src/index.ts`) bundle as they are with esbuild and Vite, so exports are unchanged. One change for size: `@dta/figma` and `@dta/lint` imported zod as `import { z } from 'zod'`, which bundlers cannot tree-shake (zod's `z` namespace object carries every locale). Switched to `import * as z from 'zod'` (zod's documented form, same API; `import type * as z` in `client.ts`). That took each package from about 460 KB to about 110 KB minified. Behaviour unchanged: all package tests and all 34 CLI snapshots pass. `@dta/cli` and `@dta/visual-diff` keep their import; they are not browser-bundled.
- **Bundle sizes** (esbuild 0.28.2, minified ESM, whole public API; gzip in brackets): `@dta/core` 14.5 KB (5.9 KB); `@dta/figma` 118 KB (35 KB), was 472 KB (100 KB); `@dta/lint` 106 KB (32 KB), was 462 KB (97 KB); `@dta/build` 2.17 MB (608 KB), almost all Style Dictionary. **Playground first load** (core + figma + lint, sharing zod): 111 KB (33 KB), was 465 KB (97 KB). **Lazy `@dta/build` chunk:** 2.17 MB (607 KB). Budgets in the test: core 32 KB, figma 160 KB, lint 150 KB, build 2.6 MB, playground entry 160 KB.
- **Site package:** dev dependencies `@dta/figma` (the playground needs it, TICKET-077) and `esbuild` 0.28.2.
- **Gates:** prettier, typecheck, boundaries, `pnpm test` (850 passed, the Chromium half skipped without a browser), snapshot check (34, unchanged), plus `pnpm site:build` and `test:contrast` with Chromium (13 passed). Run on Node 24.14.1 (`.nvmrc`). GitHub run: pending, nothing pushed.
- **For later (not done here):** `zod/mini` would take zod down to about 16 KB, but it is a different API, so it belongs to a separate ticket if the first load needs to shrink further. Style Dictionary dominates `@dta/build`; it already loads lazily.
