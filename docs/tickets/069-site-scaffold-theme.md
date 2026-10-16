# TICKET-069: Site scaffold: Astro + Starlight themed by the built tokens, built in CI

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 068
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decisions 2, 3, 5, 8, 10)

## What to build

`site/` is a private workspace app with Astro + Starlight. Its theme maps Starlight's variables onto the built Drafting Table tokens, with Instrument Sans and Martian Mono, and the light/Graphite toggle switches the token mode. The sidebar has the Diátaxis groups with stub pages. CI builds tokens and site and checks internal links.

## Acceptance criteria

- [ ] `pnpm site:dev` / `pnpm site:build` (tokens built first); static output; no analytics
- [ ] Starlight theme uses only semantic token variables (no hard-coded colours; a test greps the theme CSS for raw hex)
- [ ] Theme toggle switches Light/Graphite and persists per browser; respects `prefers-color-scheme` on first visit
- [ ] Sidebar groups Start, Learn, Guides, Reference, Playground, Contribute with stub pages
- [ ] CI site job: token build, `astro build`, link check; Prettier and typecheck cover `site/`; boundary guardrail covers it
- [ ] All gates pass plus the site job, and the GitHub run is green

## Implementation notes

- Pick current stable Astro and Starlight versions (at least two weeks old) and pin them.
