# TICKET-144: DTA icon in the `dta diff` pull-request comment

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Low
**Effort:** S
**Blocked by:** —
**Status:** in review (real PR after the push)
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 10–13)

## What to build

The sticky comment opens with an emoji and "dta diff: …" (`actions/lib/dta-diff.mjs`, `HEADLINE`). Give it the DTA icon, so the comment is recognisable at a glance next to Vercel's and others, as Chromatic's and Vercel's comments are. No setup for users: the image is served by the DTA website.

The status line and the comment author stay GitHub Actions: a custom avatar there needs a GitHub App per team (its private key cannot be shared), which works against zero setup. Maintainer decision (2026-10-24): no code for that; at most a short note on the guide page.

## Acceptance criteria

- [ ] The comment headline starts with the DTA icon (about 20 px, inline with the text), light and dark (a `<picture>` with `prefers-color-scheme` sources, which GitHub renders in Markdown); the verdict stays readable as text, the emoji or an equivalent marker stays for screen readers and e-mail notifications
- [ ] The icon files are served from a stable URL on the website (e.g. `/brand/dta-diff-icon.svg` or PNG if GitHub's image proxy needs it), built from the DTA Drafting Table tokens (no colour literals outside the token build), with a design-system docs entry
- [ ] The icon renders in a real pull-request comment, in GitHub's light and dark theme and in the mobile app (screenshots)
- [ ] Tests: the headline per verdict in `actions/lib/dta-diff.test.ts` (alt text, both sources); the hidden markers and the state line unchanged, so existing comments are still found and edited
- [ ] Guide "dta diff in pull requests": one sentence on the icon; a short note that a GitHub App token gives the status and comment your own name and avatar (no recipe)
- [ ] All gates pass, and the GitHub run is green

## Notes

- GitHub proxies images in comments (camo); SVG works when served with `image/svg+xml`. Check this first, else ship a PNG at 2× size.
- `site/public/favicon.svg` is the starting point for the shape.
- The URL is fixed in the action, not configurable (no new config key, spec: no new features in Phase 11).

## Progress (2026-10-24)

- Maintainer: use the site icon (the favicon). `site/src/lib/brand-mark.ts` draws it from the tokens: the square `blueprint.600`, the outline `border.strong` of the theme (`ink.900` in Light, `paper.200` in Graphite, so it stays visible on GitHub's dark background). Served as `/brand/dta-mark-light.svg` and `/brand/dta-mark-dark.svg`; `/favicon.svg` is now generated from the same drawing (same picture as before, no colour literals left). Logo page: section "The mark as a file".
- Comment: `headline(verdict)` in `actions/lib/dta-diff.mjs` puts a `<picture>` (dark source, light `<img>`, 20 px, empty alt) before the emoji and the verdict; marker and state line stay first. Tests in `dta-diff.test.ts` and `brand-mark.test.ts`.
- SVG through GitHub's image proxy: SVG badges load in comments the same way; checked on the real pull request after the push (light, dark, mobile).
- Guide: one sentence on the mark, one on a GitHub App token for your own name and avatar.
