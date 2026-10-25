# TICKET-149: Docs sidebar groups collapsed by default, except Start

**Phase:** 10 — Landing redesign (site polish)
**Priority:** Low
**Effort:** XS
**Blocked by:** —
**Status:** in review (2026-10-25)

## What to build

The docs sidebar shows every group open (Start, Learn, Guides, Reference, Design system with Tokens and Components, Contribute): a long list before the reader has chosen anything. Maintainer decision (2026-10-25): every group is collapsed by default, except the first one, Start.

- Starlight's `collapsed: true` on each group except Start, nested groups included (Tokens, Components). Starlight always opens the group that holds the current page, so a reader on a guide still sees the Guides list; on wide screens it remembers groups the reader opened for the session.
- The sidebar moves to its own module (`site/sidebar.mjs`), so a test can check the rule without loading the Astro config.

## Acceptance criteria

- [x] Start open; Learn, Guides, Reference, Design system (and Tokens, Components inside it) and Contribute collapsed; Playground stays a plain link
- [x] The group of the current page is open (e.g. on a guide: Guides)
- [x] `site/sidebar.test.ts` checks the rule, so a new group is collapsed unless it is the first
- [x] Screenshots of a docs page at 1280 and 390 (menu open), light and Graphite
- [x] All gates pass

## Progress (2026-10-25)

- `site/sidebar.mjs` holds the sidebar, `astro.config.mjs` imports it; `site/sidebar.test.ts` checks the rule. Built site: on `/start/` only Start is open; on a guide, Start and Guides. Screenshots at 1280 (Start, a guide) and 390 (menu open), light and Graphite.
