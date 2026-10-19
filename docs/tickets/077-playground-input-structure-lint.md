# TICKET-077: Playground: input, structure and lint findings

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** L (own route, shared layout, Preact setup and new design-system components)
**Blocked by:** 076
**Status:** open
**Spec:** [playground](../specs/playground.md) (decisions 2, 3, 4, 6, 7, 12, 13, 14)

## What to build

On the site's own `/playground` route (not a Starlight page, spec decision 12) a user drops or pastes token files or a plugin export (or loads the brand-ab example) and sees the detected structure (collections, modes, layer roles) and lint findings, with the same diagnostics the CLI gives. Nothing leaves the browser.

## Acceptance criteria

- [ ] `/playground` is a standalone page on a shared `SiteLayout.astro` (also used by the landing page, which looks unchanged); the Starlight placeholder page and its sidebar group are removed; docs and landing page link to `/playground`; "Playground" in the site nav
- [ ] Preact island loaded only on the playground page; `@astrojs/preact` set up; nothing of Preact on other pages
- [ ] Input: a drop area that is also a button opening the file picker (keyboard, phones), accepting several files; a paste field; "Load example" (brand-ab)
- [ ] Structure view: collections, modes, inferred layer role with confidence (`analyzeStructure`); lint findings list (`lintTokens`, default rules) with the CLI's wording
- [ ] New UI as design-system components first (e.g. drop area, structure table, findings list), each with a docs page and stories incl. phone width
- [ ] Multiple per-mode files or one plugin export (auto-detected); invalid input shows CLI-equivalent diagnostics
- [ ] No network requests after load (asserted in a test)
- [ ] All gates pass plus the site job, and the GitHub run is green

## Notes

- APIs: `detectFormat` / `importPluginExport` (`@dta/figma`), `parseTokenFiles` / `analyzeStructure` (`@dta/core`), `lintTokens` (`@dta/lint`); browser proof and bundle budgets in `site/browser-packages.test.ts` (076).
- Lint runs with the default rules (a visitor has no config); toggling rules is a possible later addition.
- The optional "last session" in local storage (decision 4) is not part of 077.
- Checks like the landing page: AAA contrast test, no horizontal scroll at 390 px in both themes, layout shift 0.
