# TICKET-176: Vercel Web Analytics on the website

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** XS
**Status:** review (2026-10-30, #55)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

Vercel's bot opened #55 to turn on Web Analytics through the Astro Vercel adapter (`@astrojs/vercel` with `webAnalytics: { enabled: true }`). Two checks failed:

1. **site:** the adapter puts `/_vercel/insights/script.js` on every page, in every build. That file only exists on Vercel's edge, so the playground e2e test (only the page's own built files load) read a file missing from `site/dist` and failed.
2. **audit:** the adapter brings `@vercel/functions`, which `unstorage` (through `astro`) then resolves as its optional peer, and with it `@vercel/cli-config` → zod 4.1.11 (GHSA high, fixed in 4.6.6).

## What to build

- Drop the adapter. Use the component Vercel's Analytics quickstart gives for Astro (`@vercel/analytics/astro`, enough on its own from 1.4.0), in `site/src/components/Analytics.astro`.
- Render it only when building on Vercel (`VERCEL=1`), so local, CI and e2e builds stay free of third-party scripts and the playground's request checks keep their meaning.
- Place it in the standalone pages' head (`SiteLayout`) and the docs pages' head (a Starlight `Head` override). Not on the story pages: they exist for screenshots.

## Acceptance criteria

- [x] `pnpm site:build` without `VERCEL` has no analytics tag; with `VERCEL=1`, the landing page, the playground and the docs pages have one, the stories none
- [x] `pnpm audit` passes without a zod override (the zod path is gone with the adapter)
- [x] Site checks (`test:contrast`) and the gates green
- [ ] Web Analytics enabled for the project in the Vercel dashboard, and page views arriving after the next production deploy

## Notes

Web Analytics is cookieless and posts to the site's own `/_vercel/insights/*` routes. If the site ever needs a privacy note, that is where it goes.
