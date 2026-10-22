# TICKET-090: First npm release

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** M
**Blocked by:** 132–138 (DTCG 2025.10 support ships with the first release, [dtcg-2025-10](../specs/dtcg-2025-10.md))
**Status:** open

## What to build

DTA can be installed and run without a clone: `npm i -D design-token-authority` and `npx design-token-authority <command>` (or `dta <command>` once installed). Found while writing the docs (072): the package is not on npm, and the npm name `dta` belongs to an unrelated package, so `npx dta` must never be shown.

## Acceptance criteria

- [ ] A compiled build of `@dta/cli` and the packages it uses (no tsx at runtime for the CLI itself; tsx stays only for loading `.ts` configs), with `bin` names `dta` and `design-token-authority`
- [ ] `npm pack` of the package installs into an empty project and runs `init`, `build`, `lint` and `diff --tokens-only` there (test in CI)
- [ ] `dta init` writes a config whose `defineConfig` import resolves in the installed package
- [ ] release-it publishes to npm (`npm.publish: true`) from `main`, with provenance
- [ ] `create-dta` published next to it (name checked free on 2026-10-16): a tiny package whose bin runs `design-token-authority init`, so `npm create dta` (and `pnpm create dta`) start a project without an install; the landing page shows `npm create dta` (TICKET-098)
- [ ] Website and README: `NPM_RELEASED = true` on the landing page, quick start without the clone, CI guide with `npx design-token-authority`
- [ ] All gates pass, and the GitHub run is green
