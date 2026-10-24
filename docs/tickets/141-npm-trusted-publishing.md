# TICKET-141: Release with npm trusted publishing (OIDC), without an npm token

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** S
**Blocked by:** 090 (both packages exist on npm)
**Status:** in review (the npm settings, the first release and deleting the token need the maintainer)

## Problem

The first releases (2.0.0–2.0.2) published with `NPM_TOKEN`, a granular npm token that bypasses 2FA. npm restricts such tokens for direct publishing (the notice in every release run), and a long-lived publish token in the repository secrets is the most valuable thing an attacker could take from the repository. npm trusted publishing lets the Release workflow publish with a short-lived OIDC token from GitHub instead.

## Acceptance criteria

- [x] `release.yml` publishes without `NPM_TOKEN` (`id-token: write` stays; npm 11.5.1 or newer)
- [x] The release publishes with `npm publish` (trusted publishing is documented for the npm CLI; pnpm only packs, which applies `publishConfig` and the `workspace:` versions)
- [ ] Both packages trust `Fuasmattn/design-token-authority`, workflow `release.yml`, with `npm publish` allowed (npmjs.com, maintainer)
- [ ] A release publishes both packages through OIDC, with provenance (maintainer runs Release)
- [ ] The npm token deleted on npmjs.com, the `NPM_TOKEN` secret removed, both packages set to "Require two-factor authentication and disallow tokens"
- [x] Contribute page: how releases publish

## Outcome (2026-10-24)

- `.release-it.json` `before:git:release`: `pnpm pack` of both packages into `.release/` (gitignored), then `npm publish .release/<name>-${version}.tgz --access public` for each. Checked locally: both tarballs pack (create-dta depends on `design-token-authority@^<version>`, has `access: public`), and `npm publish --dry-run` takes them.
- `release.yml`: no `NODE_AUTH_TOKEN` and no `NPM_CONFIG_PROVENANCE` (npm adds provenance itself for a public package published through trusted publishing); a step installs npm ^11.5.1. `registry-url` and `id-token: write` stay.
- npm does not check a trusted-publisher configuration when it is saved, and a new one expires unless a publish uses it within 2 days: run the first release soon after setting it up.
