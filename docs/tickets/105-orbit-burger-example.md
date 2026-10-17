# TICKET-105: Orbit Burger: the example brand as a real token set and fixture

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 2)

## What to build

The landing page's example product, Orbit Burger (a space burger delivery app), as real DTA material rather than literal colours in a mockup:

- **Token files** under `site/examples/orbit-burger/tokens/` (or a sibling location the site build can read): a `Primitives` collection (Void, Starlight, Dust, Nova 500/600, Mint, radius scale) and a `Brand` collection with the semantic tokens the card uses (`Colors.Surface.Default`, `Colors.Text.Default`, `Colors.Text.Muted`, `Colors.Accent.Fresh`, `Colors.Brand.Primary`, `Radius.Card`), named like the `brand-ab` fixture. Lint-clean under the site's rules.
- **Built with `dta build`** at site build (next to `pnpm tokens`), scoped under its own selector or prefix so the example variables never collide with the DTA Drafting Table tokens on the page. The site's colour-literal guard (`components.test.ts`) stays satisfied: the example card uses `var(--…)` from this build.
- **Two states** the page needs: `main` and `this change`. The change is `Radius.Card` 8 → 24 and `Colors.Brand.Primary` Nova 500 → 600, kept as a second token set (`tokens-base/` vs `tokens/`, as the fixture does) so `dta diff --tokens-only` runs on it for real.
- **Stories** for the Orbit Burger card (at least the card itself and a phone-width variant) in the site's stories so `dta diff` renders them and the page can quote real numbers for "caused X % of the differences".

## Acceptance criteria

- [ ] Token files lint clean; `dta build` produces the example CSS; the site build runs it
- [ ] A recorded `dta diff` run on the two token sets, with stories, gives the percentages the page shows (kept with the snapshot or in the ticket outcome)
- [ ] No colour literal for Orbit Burger in `site/src`; the guard tests pass
- [ ] All gates pass plus the site job, and the GitHub run is green
