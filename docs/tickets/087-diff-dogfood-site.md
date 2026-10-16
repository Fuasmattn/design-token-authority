# TICKET-087: Guard the DTA website with `dta diff`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** S
**Blocked by:** 086
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 12)

## What to build

Every pull request that touches the site, its tokens or components runs `dta diff` on the website's stories and shows the review in the PR, published with the Vercel recipe.

## Acceptance criteria

- [ ] Site `diff` config in the repo with the Vercel publish hook (secret scoped to the publish step); workflow enabled for this repo
- [ ] Verified on a real PR with a token change and one with a component change
- [ ] All gates pass, and the GitHub run is green
