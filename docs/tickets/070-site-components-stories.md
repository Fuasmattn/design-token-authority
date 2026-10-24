# TICKET-070: Design system section: token pages, component docs and stories

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** L
**Blocked by:** 069
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decision 6)

## What to build

The docs have a "Design system" section in Starlight that presents DTA Drafting Table: an overview (principles, voice), token pages generated from the site's DTA token files (colours as swatches in Light and Graphite, type scale, spacing, radius, stroke), and one page per component (Button, CommandButton, Chip, TextField, Terminal, Redline, DiffCard, WorkflowRail) with live examples, guidelines and the tokens each uses. The same example definitions render isolated story routes and a stories manifest, which `dta diff` captures later. No Storybook.

## Acceptance criteria

- [x] Token pages are generated at build time from the site's token files through `@dta/core` (parse, resolve): every token with its name, CSS variable, value per theme and usage note; aliases show their chain (semantic → primitive)
- [x] Components are Astro components using only semantic token variables; borders, not shadows; motion as the system specifies and off under `prefers-reduced-motion`
- [x] Accessible as built: real buttons and links, labels, focus ring (`stroke-focus`, `action-subtle`), icon-only controls labelled
- [x] One MDX page per component: live examples (all variants, both themes), guidelines, tokens used
- [x] Each example is also an isolated story route (`/stories/<component>/<variant>/`, no site chrome, excluded from search and sitemap); the build writes a stories manifest (id, URL, suggested viewports) with a documented, versioned shape
- [x] All gates pass plus the site job, and the GitHub run is green

## Implementation notes

- Stories are plain data in `site/src/examples/stories.ts` (testable without Astro); `registry.ts` maps them to their `.astro` example by file name. One example renders twice per page (Light and Graphite panels set `data-brand` themselves), with an `idPrefix` so ids stay unique.
- Story pages pause all animations at their end state (`animation-delay: -10s`, paused) and disable transitions, so screenshots are stable; `noindex`, `data-pagefind-ignore`.
- "Tokens used" on each component page is read from the component's source, so it cannot drift.
- Redline examples measure real tokens only (`radius.lg · 18`, `space.24 · 96`); the design system's `width.card` label was not a token and was dropped.
- The Terminal example is abridged real output of `dta diff` on the brand-ab fixture.
- Favicon: the working mark (ink outline + blueprint square) as SVG.
- Verified by screenshots: colour, type and spacing pages, every story in both themes, the rail at 390 px (two columns, no rail); no horizontal scroll, no failed requests.
