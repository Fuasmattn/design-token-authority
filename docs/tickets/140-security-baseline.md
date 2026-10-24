# TICKET-140: Security baseline: SECURITY.md, dependency audit, current Node

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** in review (the GitHub settings and the patch release need the maintainer)

## Problem

Found on 2026-10-24, after the first npm release (TICKET-090):

- The repository had no security policy, and nowhere to report a vulnerability privately.
- Dependabot alerts and security updates were off, so Dependabot opened only version bumps, never a security fix. `pnpm audit` found 54 known vulnerabilities: 2 critical, 17 high, 29 moderate, 6 low. One chain ships to users: `style-dictionary` → `@bundled-es-modules/glob` → `url` → `qs` 6.15.0 (three denial-of-service advisories). `tsx` (also shipped, for `.ts` configs) pulled `esbuild` 0.27 (low, dev server on Windows). The rest is release tooling (`release-it` and its changelog plugin: `handlebars` critical, `undici`, `lodash`, `basic-ftp`, `defu`, `ip-address`), test tooling (`vitest`, `rollup`, `source-map-js`) and the site build (`picomatch`, `fflate`, `postcss-selector-parser`), plus `ajv` → `fast-uri` in `@dta/cli`'s dev dependencies.
- `.nvmrc` pinned Node.js 24.14.1 for CI, releases and local work; Node.js published several security releases since (the July 2026 one with three high CVEs, fixed in 24.18.1); the latest 24.x was 24.22.1.

## Acceptance criteria

- [x] `SECURITY.md`: supported versions, private reporting through GitHub, what is in scope and what is not (the config is code)
- [x] `pnpm audit` passes: upgrades where a direct dependency has the fix, `overrides` in `pnpm-workspace.yaml` for transitive ones (each with the package that pulls it in), and any advisory left ignored with its reason
- [x] CI runs `pnpm audit` as a job of its own; the release stops on `pnpm audit --prod`
- [x] `.nvmrc` on the latest Node.js 24 (CI, releases and the package test follow it)
- [ ] Dependabot alerts, Dependabot security updates and private vulnerability reporting switched on (repository settings; the agent's GitHub access may not change them)
- [ ] A patch release (2.0.2), so the fixed `qs` and `tsx` reach npm users
- [x] All gates pass, and the GitHub run is green

## Outcome (2026-10-24)

- **Direct upgrades:** `tsx` ^4.23.15 (esbuild 0.28; root and `@dta/cli`), `style-dictionary` ^5.7.1, `vitest` and `@vitest/coverage-v8` ^4.1.12 (every package; the vitest 5 major is a separate step), `rollup` 4.65.0, `esbuild` 0.28.2 (package build), `ajv` 8.20.0, `fflate` 0.8.3 (site).
- **Overrides** (`pnpm-workspace.yaml`): `qs` ^6.16.1, `handlebars` ^4.7.10, `undici` 6.x ^6.29.1, `lodash` ^4.18.1, `defu` ^6.1.7, `basic-ftp` ^5.3.1, `ip-address` ^10.7.4, `picomatch` 2.x ^2.3.2, `source-map-js` ^1.2.2, `postcss-selector-parser` ^7.1.7, `fast-uri` ^3.1.9. Each stays inside the major its dependents ask for.
- **Ignored, with reason:** GHSA-c475-qrg2-pj4r (basic-ftp `Client.list()` CPU denial of service from a malicious FTP server; the fix is basic-ftp 6, which `get-uri` under release-it's `proxy-agent` does not accept). It is only reached when release-it loads a PAC proxy file over `ftp://`, which the Release workflow never configures. Drop it once release-it moves on (release-it 21 is out; upgrading it is a separate step, since the release flow just worked).
- `pnpm audit`: no known vulnerabilities except the ignored one; `pnpm audit --prod`: none.
- **CI:** job `audit` in `test.yml` (`pnpm audit`, no install needed: it reads the lockfile). **Release:** `before:init` starts with `pnpm audit --prod`, so a known vulnerability in what users install stops the release before the version bump.
- **Node:** `.nvmrc` 24.22.1. `engines` stays `>=24.14.1`: it is the floor DTA works on, not a security gate (npm only warns on it); `SECURITY.md` asks users for a current 24.x. Vercel builds the site on 24.x, which is the latest 24.
- Contribute page: a line on SECURITY.md and the audit.
- **CI fix in the same change** (the "site" job failed on `main` since accbd4f): `playground.e2e.test.ts` still expected the "not on npm yet" note; it now checks the `defineConfig` import and the install note. Running the browser suites locally then showed a layout shift in `motion.e2e.test.ts`: the playground's CLI handoff rendered while the outputs were still building, and the file list arriving after the lazy build pushed it and the footer down. The old, longer note had kept the footer below the fold, which hid it. The CLI handoff now renders once the outputs are built, and the footer is hidden while they build (`[data-building]`, the same rule as while the analysis loads). `test:contrast`: 175 passed, twice.

Left for the maintainer:

1. Repository settings → Code security: **Dependabot alerts** and **Dependabot security updates** on; Settings → Code security → **Private vulnerability reporting** on (SECURITY.md links to it).
2. After the merge, run Release with `patch` (2.0.2).
