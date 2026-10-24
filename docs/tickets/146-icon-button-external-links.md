# TICKET-146: `IconButton` and the external links (GitHub, npm)

**Phase:** 10 — Landing redesign (site polish)
**Priority:** Low
**Effort:** S
**Blocked by:** —
**Status:** in review (2026-10-24)

## What to build

The site's standalone pages (landing, playground) link to GitHub only as a footer text link, npm not at all. Add (maintainer, 2026-10-24: no author or portfolio link):

- **GitHub** and **npm** as icon buttons in the header: in the row next to the theme switch on tablets and desktops, in the full-screen menu's bottom row on phones (the Nav's default slot, which already holds the theme switch).
- The docs (Starlight) header gets npm next to its existing GitHub icon (Starlight's `social` config, its own icons).

The design system has no icon button yet, so it becomes a design-system component first (CLAUDE.md: "Website UI follows the tokens").

## Design

- `IconButton.astro` in `site/src/components/ds`: a 44 × 44 circular link (or button without `href`), the icon centred, `currentColor`. At rest only the icon shows; on hover a filled circle in `bg-hover` appears (`radius-full`, no border), on keyboard focus the circle plus the focus ring (`stroke-focus` in `action-subtle`). No shadow. Maintainer's choice (2026-10-24): fill only, no ink ring.
- The Nav's burger toggle gets the same hover (circle in `bg-hover` instead of the ink border), so all icon controls in the header behave alike.
- Required `label` (accessible name, e.g. "GitHub repository"); the icon is `aria-hidden`. External links open in the same tab, `rel="noopener"`.
- Icons in `site/src/components/ds/icons.ts`: the official marks, monochrome in `currentColor` (the brands' own guidelines allow one-colour use): GitHub's Invertocat (Octicons `mark-github`, MIT) and npm's square "n" mark. Single path each, no colour literals.

## Tokens (new, Primitives)

The site uses the 44 px touch target and the icon size as literals (Nav toggle, ThemeSwitch, Button 48 px). New tokens:

- `size.target` = 44: minimum touch target (WCAG 2.5.5). Used by IconButton; the Nav toggle and ThemeSwitch switch to it (same pixels, no visual change).
- `size.icon` = 20: icon glyph size.

New semantic token (Theme): `bg.hover`, the hover fill of icon controls. `bg-subtle` on `bg-canvas` is about 1.1:1 and barely visible, so it goes one step darker: Light `{paper.300}`, Graphite `{graphite.700}`.

The Button's 48 px stays as it is in this ticket (no visual change wanted there).

## Acceptance criteria

- [x] Tokens `size.target`, `size.icon` (Primitives) and `bg.hover` (Theme, both modes), built with `dta build`; Design system › Tokens pages list them
- [x] Nav burger: circle hover in `bg-hover`; Nav docs page and stories updated
- [x] `IconButton.astro` + `icons.ts`; only token variables (`components.test.ts` passes)
- [x] Docs page `design-system/components/icon-button.mdx` (when to use, guidelines, tokens used)
- [x] Stories: `IconButtonDefault` (both icons), the header row at 1280 and the open phone menu at 390 (Nav story with icons)
- [x] SiteLayout: GitHub + npm icon buttons before the theme switch; footer unchanged
- [x] Starlight `social`: npm (https://www.npmjs.com/package/design-token-authority) next to GitHub
- [x] Screenshots 1280 and 390, light and Graphite, before any push
- [x] Detail panel: its close button is an Icon button (maintainer, 2026-10-24); styles shared through `IconButton.css` for the Preact island, `close` glyph in `icons.ts`
- [x] All gates pass

## Notes

- Links: https://github.com/Fuasmattn/design-token-authority, https://www.npmjs.com/package/design-token-authority
- The footer's GitHub text link stays (footers repeat the main links).
