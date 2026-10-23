# TICKET-090: First npm release

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** M
**Blocked by:** — (was 132–138, done 2026-10-22: DTCG 2025.10 support ships with the first release, [dtcg-2025-10](../specs/dtcg-2025-10.md))
**Status:** in review (the first publish needs the maintainer: the `NPM_TOKEN` secret and a run of the Release workflow from `main`)

## What to build

DTA can be installed and run without a clone: `npm i -D design-token-authority` and `npx design-token-authority <command>` (or `dta <command>` once installed). Found while writing the docs (072): the package is not on npm, and the npm name `dta` belongs to an unrelated package, so `npx dta` must never be shown.

## Acceptance criteria

- [x] A compiled build of `@dta/cli` and the packages it uses (no tsx at runtime for the CLI itself; tsx stays only for loading `.ts` configs), with `bin` names `dta` and `design-token-authority`
- [x] `npm pack` of the package installs into an empty project and runs `init`, `build`, `lint` and `diff --tokens-only` there (test in CI)
- [x] `dta init` writes a config whose `defineConfig` import resolves in the installed package
- [ ] release-it publishes to npm (`npm.publish: true`) from `main`, with provenance
- [ ] `create-dta` published next to it (name checked free on 2026-10-16): a tiny package whose bin runs `design-token-authority init`, so `npm create dta` (and `pnpm create dta`) start a project without an install; the landing page shows `npm create dta` (TICKET-098)
- [ ] Website and README: `NPM_RELEASED = true` on the landing page, quick start without the clone, CI guide with `npx design-token-authority`
- [ ] All gates pass, and the GitHub run is green

## Outcome (2026-10-23)

- **The package is the repository root**, as before; `pnpm package:build` (`scripts/package/build.ts`) bundles `packages/cli/src/bin.ts` and `index.ts` with esbuild into `dist/` (ESM, Node 24, one shared chunk) and `dist/index.d.ts` with rollup-plugin-dts (`scripts/package/dts.config.mjs`; the declarations import only `zod` and `node:` modules). `@dta/*` are bundled; every other import stays an import and must be in the root `dependencies` (the build fails and names the import otherwise): `@clack/prompts`, `commander`, `picocolors`, `pixelmatch`, `pngjs`, `style-dictionary`, `tsx` (only for loading `.ts` configs), `zod`; `playwright-core` is an optional peer.
- `publishConfig` points `bin` (`dta`, `design-token-authority`) and `exports` (with `types`) at `dist/`; `files` is `dist`. In the workspace nothing changes: `bin/dta.js` runs the sources through tsx, and the site and the fixtures import the sources. `publishConfig` is applied by pnpm, so pnpm packs and publishes (npm would ignore it).
- `dta --version` comes from `__DTA_VERSION__`, set by the build (the bundle has no `package.json` three folders up).
- **`create-dta`** (`packages/create-dta`): `bin.js` first installs `design-token-authority@^<its version>` as a dev dependency with the package manager that ran it (`npm_config_user_agent`: npm, pnpm, yarn, bun), unless the project already depends on it; the config `init` writes imports `defineConfig` from the package, so without it the next `dta build` could not load the config (found in review). Then it runs `design-token-authority init` with the arguments passed through (`npm create dta -- --yes`). It depends on `design-token-authority` `workspace:^`, written as `^<version>` when packed.
- **`dta init --yes` without a config** (new, needed for the package test and useful for CI and coding agents): writes the config for exported token files in `tokens/` with every output format, no questions; no `dta diff` (that is `dta init --diff --yes`) and nothing pulled. Without a terminal and without `--yes`, `dta init` stops with exit 2 and says to pass `--yes` (it used to wait forever; found running the tarball in a script).
- **Package test** (`packages/create-dta/test/package.e2e.test.ts`, CI job `package`, `DTA_PACKAGE_E2E=1`): builds, packs both packages, installs the tarballs into an empty npm project (with TypeScript 5.9 and `@types/node`, as a TypeScript project has), checks that only `dist` ships and that the bundle loads tsx only through one dynamic import (for `.ts` configs), then `create-dta --yes` (and, in a second empty folder with a stand-in `npm` on `PATH`, that create-dta installs the package first), `build` (the `.ts` config's `defineConfig` import resolves), `lint`, `diff --tokens-only` on a git change, and `tsc` on the config: it passes, and a wrong value (`tokens.dir: 1`) fails.
- **Release** (`.github/workflows/release.yml`, run by hand from `main`, the version typed in: no default, since a version cannot be published twice): release-it bumps the version (root and `create-dta`, `after:bump`), writes the changelog and builds `dist/`; `before:git:release` runs `pnpm publish` for both with provenance (`NPM_CONFIG_PROVENANCE`, `id-token: write`) **before** the release commit, tag and push, so a failed publish leaves nothing pushed; then the GitHub release. Both manifests have `repository` (provenance checks it against the GitHub repository), `homepage` and `bugs`. Needs the secret `NPM_TOKEN`: a granular npm token that may publish new packages (classic automation tokens are retired); after the first release, npm trusted publishing (OIDC) can replace it. A protected `main` must let github-actions push the release commit. Both npm names were checked free on 2026-10-23.
- **Version:** the tag `v1.0.0` (the v1 tool) exists and the config schema already speaks of v2, so the first npm release is `major` (2.0.0); the workflow input says so.
- **README** (it ships in the tarball): the quick start is now `npm create dta` and `npx design-token-authority …`, says the packages are published from 2.0.0 on and keeps the clone route for before that, so it is right on npm and on GitHub before the release.
- Docs: Contribute (the package, `create-dta`, releases and the package test), Quick start (`dta init --yes`), the Commands reference through `--help`.

Left for the maintainer (then tick the rest):

1. Merge to `main`, add `NPM_TOKEN`, run Release with `major`.
2. After the publish: `NPM_RELEASED = true` in `site/src/landing/content.ts`, the website's Quick start without the clone (and without the "drop the defineConfig import" note), the CI guide's workflow with the package instead of the second checkout; the README's clone paragraph can go. Not done now: the website would promise a package that is not on npm yet.
