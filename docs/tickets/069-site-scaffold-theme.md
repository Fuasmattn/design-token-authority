# TICKET-069: Site scaffold: Astro + Starlight themed by the built tokens, built in CI

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 068
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decisions 2, 3, 5, 8, 10)

## What to build

`site/` is a private workspace app with Astro + Starlight. Its theme maps Starlight's variables onto the built Drafting Table tokens, with Instrument Sans and Martian Mono, and the light/Graphite toggle switches the token mode. The sidebar has the Diátaxis groups with stub pages. CI builds tokens and site and checks internal links.

## Acceptance criteria

- [x] `pnpm site:dev` / `pnpm site:build` (tokens built first); static output; no analytics
- [x] Starlight theme uses only semantic token variables (no hard-coded colours; a test greps the theme CSS for raw hex)
- [x] Theme toggle switches Light/Graphite and persists per browser; respects `prefers-color-scheme` on first visit
- [x] Sidebar groups Start, Learn, Guides, Reference, Playground, Contribute with stub pages
- [x] CI site job: token build, `astro build`, link check; Prettier and typecheck cover `site/`; boundary guardrail covers it
- [x] All gates pass plus the site job, and the GitHub run is green

## Implementation notes

- Pick current stable Astro and Starlight versions (at least two weeks old) and pin them.
- Done with Astro 7.3.5, Starlight 0.42.5 and starlight-links-validator 0.26.0 (all at least two weeks old). Fonts are self-hosted (`@fontsource-variable/instrument-sans`, `@fontsource-variable/martian-mono` 5.3.0) under the token family names, so no Google request.
- Theme bridge: Starlight's `data-theme` (light/dark) is mirrored to `data-brand` (light/graphite) by a `ThemeProvider` override. A DTA build option for the theme selector would remove the bridge; worth a feature ticket once user-defined structure (theme modifiers) lands.
- `typecheck` of the site is `astro check` (after building the tokens), part of the root `pnpm typecheck`.
- Verified by screenshots in both themes: page background `paper-100` / `graphite-900`, Instrument Sans loaded, asides and accents from the action tokens, no shadows.
