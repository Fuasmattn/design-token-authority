# TICKET-096: Landing page on tokens and design-system components only

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** M
**Blocked by:** 095
**Status:** done

## Background

The landing page (071) predates the rule in CLAUDE.md that website UI uses only the DTA Drafting Table tokens and design-system components. `landing.css` and `components/landing/ReviewDemo.astro` hold about 350 literal sizes (font sizes, paddings, gaps, radii), a few colour literals and shadows, and UI that exists nowhere in the design system: the logo, the Light/Graphite switch, the "example" and "coming" badges and the cards.

## What to build

- **Components** in `site/src/components/ds`, each with a docs page and a story: `Logo`, `ThemeSwitch` (segmented control), `Badge` (`example`, `coming`) and `Card` (surface card, optionally a link, `featured`, `grid` paper). The landing page and the review demo use them.
- **Tokens instead of literals** in `landing.css` and `ReviewDemo.astro`: spacing, radii, strokes, type sizes, weights and line heights from the tokens. Values that are not on the scale move to the nearest step; layout values the tokens lack (content width, measure, section spacing) become tokens in `site/tokens`.
- **Borders instead of shadows**, no colour literals (the selected tab and the card outlines use borders; the striped overlay uses `color-mix` with `signal-bg`).
- **A guard**: a test fails when `landing.css` or the landing components use a colour literal, a shadow other than the focus ring, or a literal px value for spacing, radius or type.

## Acceptance criteria

- [x] The four components with docs pages and stories; landing page and review demo use them
- [x] The guard test passes; new tokens documented with `$description`, `pnpm report:tokens` run
- [x] Landing page compared at 1280px and 390px in Light and Graphite before and after: same layout, values snapped to the scale
- [x] All gates pass plus the site job, and the GitHub run is green

## Outcome

- New design-system components with docs pages and stories: `Logo`, `ThemeSwitch`, `Badge` (`example`, `coming`, `note`) and `Card` (`href`, `featured`, `grid`). The landing page uses them and `Button` (outline); the review demo uses `Badge`.
- New tokens in `site/tokens`: `space.10/14/20/36` (40, 56, 80, 144) and `layout.content/heading/measure/title` (1240, 900, 640, 760), shown on the Spacing page; `pnpm report:tokens` run.
- `landing.css` and `ReviewDemo.astro` take every spacing, radius and type value from the tokens; shadows became borders (the focus ring and the compare knob's halo stay as `0 0 0` rings); no colour literals. Values of the made-up example in the review demo (the reviewed card's radius before and after) are demo variables, not tokens.
- `src/landing/styles.test.ts` guards it.
- Compared at 1280px and 390px in Light and Graphite: same layout; the page is about 110px shorter where values snapped to the scale (section headings use the type tokens, e.g. 50px instead of 56px).
- Still page sections rather than components: the steps, the trust list, the agent bubble and the command line in the use cards. They use only tokens now; they become components when a second page needs them.
