# TICKET-073: Learn: DTCG intro and token pattern catalogue

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** M
**Blocked by:** 069
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decision 8, open question 5)

## What to build

The Learn section explains the DTCG format (types, aliases, groups, the resolver module) with small examples, and a pattern catalogue (primitive → semantic → component tiers, multi-brand inheritance, light/dark and other themes, responsive overrides, component-level overrides) with trade-offs, plus how large public design systems structure their tokens, with sources.

## Acceptance criteria

- [x] DTCG intro pages with runnable examples (files the CLI accepts)
- [x] One page per pattern: when to use it, trade-offs, a small example token set
- [x] References to public systems are researched and linked (no claims without a source)
- [x] All gates pass plus the site job and link check, and the GitHub run is green

## Outcome

- Pages under `site/src/content/docs/learn/`: DTCG (tokens and groups, types, aliases, resolver module), patterns (tiers, multiple brands, light and dark, breakpoint overrides, component overrides) and public design systems (Material, Primer, Spectrum, Atlassian, Salesforce Lightning, each quoted from and linked to its own documentation).
- Six example projects in `site/learn-examples/`, imported into the pages with `?raw`; `site/learn-examples.test.ts` runs `dta lint` and `dta build` on each through `bin/dta.js` and pins the output the pages show. Spec syntax DTA does not read is shown separately and labelled.
- Open question 5 of the docs-site spec: the public-systems research shipped with this ticket.
- Follow-ups: 093 (nested `data-brand` does not reach single-mode tokens that alias brand tokens, found while checking the examples in Chromium) and 094 (DTCG 2025.10 conformance).
