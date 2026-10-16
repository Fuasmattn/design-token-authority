# TICKET-075: Deploy the website on Vercel

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** S
**Blocked by:** 069 (spec open questions 1 and 2 answered)
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 11)

## What to build

The site is live: previews per pull request, production from `main`, linked from README, `package.json` `homepage` and the GitHub repo.

## Acceptance criteria

- [ ] Vercel project configured with the mechanism chosen in open question 1; one-time manual steps written down
- [ ] Preview on a pull request and production from `main` verified once
- [ ] The test workflow still needs no secrets; deploy secrets (if any) are scoped to the deploy job
- [ ] All gates pass, and the GitHub run is green

## Implementation notes

- Needs the maintainer for the Vercel account setup; the agent prepares config and instructions.
