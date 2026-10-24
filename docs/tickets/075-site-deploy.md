# TICKET-075: Deploy the website on Vercel

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** S
**Blocked by:** 069 (spec open questions 1 and 2 answered)
**Status:** done (2026-10-24)
**Spec:** [docs-site](../specs/docs-site.md) (decision 11)

## What to build

The site is live: previews per pull request, production from `main`, linked from README, `package.json` `homepage` and the GitHub repo.

## Acceptance criteria

- [x] Vercel project configured with the mechanism chosen in open question 1; one-time manual steps written down
- [x] Preview on a pull request and production from `main` verified once
- [x] The test workflow still needs no secrets; deploy secrets (if any) are scoped to the deploy job
- [x] With the domain known: `site` set in `astro.config.mjs` (sitemap), absolute links in `llms.txt` (written by `site/scripts/generate-reference.ts`, relative until then), and `$id` on the published schemas (`/schemas/dta.config.schema.json`, `/schemas/token-file.schema.json`)
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Needs the maintainer for the Vercel account setup; the agent prepares config and instructions.

## Outcome (2026-10-24)

- **Mechanism:** the Vercel GitHub integration (spec open question 1). The project `design-token-authority` in the maintainer's Vercel account was imported from the repository; it reads `vercel.json` (install `pnpm install --frozen-lockfile`, build `pnpm --filter dta-site build`, output `site/dist`), Node.js 24.x. Production deploys from `main` and the preview deployments of pull requests (Dependabot's) were checked READY through the Vercel connector. The repository holds no Vercel secret, so the test workflow is unchanged.
- **Domain** (open question 2): `dta.martinprinz.dev`, added to the project through the Vercel connector, with a CNAME record at the domain's DNS (Squarespace); verified, HTTPS served. `design-token-authority.vercel.app` serves the same site.
- `SITE_URL` in `site/site-url.mjs`: `site` in `astro.config.mjs` (Starlight writes the sitemap), absolute links in `llms.txt` and the page URLs in `llms-full.txt`, and `$id` on every published schema (`withId` in `generate-reference.ts`, after `$schema`; tested in `reference.test.ts`).
- Linked from the README and the `homepage` of both packages (on npm with the next release). The GitHub repository's website field is the maintainer's to set (repository settings → About).
- One-time steps are on the Contribute page ("The website").
- Vercel's standard deployment protection stays on: the production domains are public, preview and per-deployment URLs ask for a Vercel login.
