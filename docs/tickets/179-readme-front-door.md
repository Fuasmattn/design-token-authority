# TICKET-179: README as the front door

**Phase:** 14 — Launch
**Priority:** High
**Effort:** S
**Status:** open (2026-11-02)
**Spec:** —

## Problem

The README is accurate but reads like a reference card. Someone arriving from a link (Hacker News, a Slack post, a list of token tools) decides in about a minute whether to try DTA, and today that minute shows a dense paragraph, install commands that assume Figma Enterprise, and a full command table. Nothing shows `dta diff`, the part no other token tool does, and the in-browser playground, the one way to try DTA without installing anything, is not mentioned at all.

DTA is about to be shared outside the maintainer's company. The README is where most of that traffic lands first.

## What to build

Restructure `README.md` in this order. Every claim must match the docs site; no new features.

1. **Name and one-line pitch.** Problem first: see what a token change does to your UI before it merges.
2. **Badges:** npm version (`design-token-authority`), CI (`test.yml`), licence.
3. **Hero image:** one screenshot of a `dta diff` report (a changed story with the token that caused it), light and dark through `<picture>`. Assets in `docs/readme/`.
4. **Try it:** three paths, cheapest first: the playground (no install, uploads nothing); `npm create dta` with a plugin export (any Figma plan); `dta pull` (Enterprise).
5. **Why DTA:** the three problems from the docs' "What DTA is" page (structure drifts, code breaks quietly, screenshots pile up), each with the command that answers it.
6. **How it fits:** a Mermaid diagram (GitHub renders it): Figma or JSON → `tokens/` → `lint` / `build` → outputs, and a pull request → `dta diff` → report.
7. **Commands:** the existing table, unchanged.
8. **Where it sits:** one short, fair paragraph on Style Dictionary (DTA builds with it) and Figma plugins (DTA reads their exports).
9. **Documentation:** the site, with four links instead of fifteen.
10. **Contributing:** tickets and specs, `AGENTS.md` for coding agents, link to issues labelled `good first issue`.
11. **Licence.**

## Acceptance criteria

- [ ] README follows the order above and renders correctly on GitHub (light and dark; Mermaid diagram visible)
- [ ] The hero screenshot exists in `docs/readme/` in both themes, taken from a real `dta diff` report with no customer names (BrandA/BrandB only)
- [ ] Every command and claim matches the docs site; links resolve (`docs-internal-refs` test still green)
- [ ] A few open issues carry the `good first issue` label before the README links to them
- [ ] Gates green (`prettier:check` covers the README)

## Notes

- The hero image is the one asset this ticket needs from outside the text. The sample pull request on `sample/dta-diff-demo` already has a real report to screenshot. A short animated loop can replace the still later; a still is enough to launch.
- The npm package page shows the same README, so the badges and the relative image paths must work there too (use absolute `raw.githubusercontent.com` URLs for images if npm drops relative ones).
- Follow-ups for the launch, not part of this ticket: a launch post, a "Compared with" docs page, the `good first issue` triage.
