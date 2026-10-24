# TICKET-071: Landing page from the "J · Drafting Table" mockup

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** L
**Blocked by:** 070
**Status:** done (without the hero key visual, see Notes)
**Spec:** [docs-site](../specs/docs-site.md) (decision 7)

## What to build

The site's home page implements the J · Drafting Table mockup: hero with pitch and `npx dta init` command button, problem, workflow rail, the interactive "See it" review demo with the drag-to-compare slider, Try / Govern / Delegate, Why trust it, Learn/Docs/Playground cards and footer, in light and Graphite, down to 390 px.

## Acceptance criteria

- [x] Sections and copy follow the mockup; placeholder copy and demo numbers are visibly marked as examples
- [x] Commands that do not exist yet (`dta check`, `dta diff`, `dta skill add`) are shown as "coming" or replaced by shipped commands; nothing on the page claims a feature that is not released
- [x] Interactive parts (review demo tabs, slider, theme toggle) work by keyboard and pointer; motion stops under reduced motion
- [x] Responsive per the "J refined — phone 390" artboard; no horizontal scroll at 390 px
- [x] Lighthouse-style budget: no layout shift from fonts (font-display and size-adjust), page weight noted in the ticket
- [x] All gates pass plus the site job, and the GitHub run is green

## Implementation notes

- Hero visual: the J review demo; the robot/mascot explorations on the canvas are not part of this ticket (spec open question 4).

## Notes

- **Key visual left out** (maintainer decision, 2026-10-16: not happy with it yet). The hero has the pitch, the redlined "agents." (`color.action`), the `npx dta init` command button and the two links, over a static grid-paper backdrop; the workbench visual and the robot/mascot explorations wait for a new design.
- Own Astro page (`site/src/pages/index.astro`) instead of the Starlight splash (`index.mdx` removed): same `dta build` token CSS and fonts as the docs; the Light/Graphite toggle writes Starlight's `starlight-theme` key, so landing and docs agree in both directions.
- Content as data in `site/src/landing/content.ts`; `landing.test.ts` checks the honesty rule against the CLI's registered commands: `npx dta init`, `npx dta build` and `npx dta lint && npx dta diff` (instead of the mockup's `dta check && dta diff`) are shipped; `npx dta skill add`, the Delegate card, the Playground card, the breaking-change tab and the layering finding carry a "coming" label. The review demo is labelled "Example data"; structure findings name the real lint rules (`naming-pattern`, `semantic-must-alias`).
- "Why trust it" terminal: lines from the real `dta diff` dogfood run on the website's tokens (084), replacing the mockup's invented `dta check` output (the Terminal component's rule: real output only).
- Review demo (`site/src/components/landing/ReviewDemo.astro`): server-rendered, ARIA tabs with arrow/Home/End keys, findings as pressed buttons, actions record a choice, drag-to-compare slider as a native range input with diff overlay toggle. Checked with Playwright: keyboard tab switching, slider by keys, actions, theme toggle.
- Motion: entrance rise, redline draw and tag pop, hover lifts; everything stops under `prefers-reduced-motion` (0 running animations measured).
- Responsive: no horizontal scroll at 390 px (light and Graphite, measured); nav links hidden on phones, steps in two columns, cards stacked.
- Fonts and layout shift: the two Latin font files are preloaded; size-adjusted local fallbacks (`Instrument Sans Fallback`: size-adjust 106.5 %, from the font's metrics against Arial; `Martian Mono Fallback`: 116.7 % against Courier New). Cumulative layout shift measured 0 at 1440 and 390 px.
- Page weight (production build): HTML 33 KB (7 KB gzip), CSS 29 KB (6.5 KB gzip), JS 2.5 KB, fonts 81 KB (Instrument Sans 57 KB, Martian Mono 24 KB); about 96 KB transferred.
