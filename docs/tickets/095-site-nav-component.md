# TICKET-095: Navigation component with a mobile menu

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** done

## Background

Found on the first Vercel preview (075): below 760px the landing page hides its navigation and offers nothing instead, so phones cannot reach How it works, Review, Use cases or the docs from the header. The docs pages are not affected (Starlight has its own menu).

The header links were landing-page CSS, not a design-system component. New UI on the site follows the token and design-system approach (CLAUDE.md), so the fix is a component, not more landing CSS.

## What to build

`Nav` in the DTA Drafting Table design system (`site/src/components/ds/Nav.astro`): the links in a row on wide screens; below 760px one "Menu" button (disclosure: `aria-expanded`, `aria-controls`) that opens them as a list. Closes on Escape (focus back to the button), on a link click and on a click outside. Token variables only. The landing page uses it instead of its own `.nav` markup and CSS.

## Acceptance criteria

- [x] `Nav.astro` with token variables only (passes `components.test.ts`), keyboard and screen reader behaviour as above, touch targets of at least 44px
- [x] Docs page `design-system/components/nav` (guidelines, tokens used) and stories: default (desktop and phone) and open menu (phone), so `dta diff` guards them
- [x] The landing page uses `Nav`; its `.nav`/`.navl` CSS is removed
- [x] Checked at 390px and 1280px in both themes; all gates pass plus the site job, and the GitHub run is green

## Outcome

- `Nav` (`site/src/components/ds/Nav.astro`), docs page and stories `nav--default` (1280, 390) and `nav--open` (390). Checked in Chromium: the menu opens, Escape closes it and focuses the button, a link or a click outside closes it.
- The landing page uses `Nav`; on phones `landing.css` only moves it after the theme switch so its panel opens from the right edge.
- `stories.test.ts` now derives the component list from `src/components/ds`, so a new component without a story fails.
- CLAUDE.md: website UI follows the tokens and the design system; new UI becomes a component (tokens only, docs page, story) first.
- Not part of this ticket: `landing.css` still has literal sizes from before this rule (font sizes, radii, paddings), and the theme switch is landing CSS rather than a component.
