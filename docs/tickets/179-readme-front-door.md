# TICKET-179: README as the front door

**Phase:** 14 — Launch
**Priority:** High
**Effort:** S
**Status:** done (2026-11-02)
**Spec:** —

## Problem

The README is accurate but reads like a reference card. Someone arriving from a link (Hacker News, a Slack post, a list of token tools) decides in about a minute whether to try DTA, and today that minute shows a dense paragraph, install commands that assume Figma Enterprise, and a full command table. Nothing shows `dta diff`, the part no other token tool does, and the in-browser playground, the one way to try DTA without installing anything, is not mentioned at all.

DTA is about to be shared outside the maintainer's company. The README is where most of that traffic lands first.

## What to build

Restructure `README.md` in this order. Every claim must match the docs site; no new features.

1. **Name and badges:** npm version (`design-token-authority`), CI (`test.yml`), licence.
2. **One-line pitch**, problem first: see what a token change does to your UI before it merges.
3. **Links:** website, docs, playground, example report (#59's deployed report).
4. **`npm create dta`** as the one-line start.
5. **Hero:** an animated `dta diff` report (the compare slider sweeping over a changed story, with the token that caused it), one dark version as a plain Markdown image (the GitHub app and npm ignore `<picture>`), linked to the deployed example report. Assets in `docs/readme/`.
6. **Try it:** three paths, cheapest first: the playground (no install, uploads nothing); `npm create dta` with a plugin export (any Figma plan); `dta pull` (Enterprise).
7. **Why DTA:** the three problems from the docs' "What DTA is" page (structure drifts, code breaks quietly, screenshots pile up), each with the command that answers it.
8. **How it fits:** a diagram as one SVG with its own dark background in `docs/readme/` (Figma or JSON → `tokens/` → `lint` / `build` / `diff`). Not Mermaid: npm and the GitHub mobile app show Mermaid as source.
9. **Commands:** the existing table, unchanged.
10. **Where it sits:** one short, fair paragraph on Style Dictionary (DTA builds with it) and Figma plugins (DTA reads their exports).
11. **Documentation:** the site, with four links instead of fifteen.
12. **Contributing:** tickets and specs, `AGENTS.md` for coding agents, link to issues labelled `good first issue`.
13. **Licence.**

## Acceptance criteria

- [ ] README follows the order above and renders correctly on GitHub and npm (light and dark; diagram and hero visible)
- [x] The hero screenshot exists in `docs/readme/` in both themes, taken from a real `dta diff` report with no customer names (BrandA/BrandB only)
- [ ] Every command and claim matches the docs site; links resolve (`docs-internal-refs` test still green)
- [ ] A few open issues carry the `good first issue` label before the README links to them
- [ ] Gates green

## Notes

- The hero is the real report of the sample pull request #59 (`sample/dta-diff-showcase`: `action.bg` blue → green, `radius.md` 10 → 12, `space.2` 8 → 10), generated with `dta diff --base origin/main` and recorded headless in the dark theme: the first story with "Show before" off and on. About 100 KB.
- The npm package page shows the same README, so the badges and the relative image paths must work there too (use absolute `raw.githubusercontent.com` URLs for images if npm drops relative ones).
- Follow-ups for the launch, not part of this ticket: a launch post, a "Compared with" docs page, the `good first issue` triage.
