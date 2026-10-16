# TICKET-070: Design system section: token pages, component docs and stories

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** L
**Blocked by:** 069
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 6)

## What to build

The docs have a "Design system" section in Starlight that presents DTA Drafting Table: an overview (principles, voice), token pages generated from the site's DTA token files (colours as swatches in Light and Graphite, type scale, spacing, radius, stroke), and one page per component (Button, CommandButton, Chip, TextField, Terminal, Redline, DiffCard, WorkflowRail) with live examples, guidelines and the tokens each uses. The same example definitions render isolated story routes and a stories manifest, which `dta diff` captures later. No Storybook.

## Acceptance criteria

- [ ] Token pages are generated at build time from the site's token files through `@dta/core` (parse, resolve): every token with its name, CSS variable, value per theme and usage note; aliases show their chain (semantic → primitive)
- [ ] Components are Astro components using only semantic token variables; borders, not shadows; motion as the system specifies and off under `prefers-reduced-motion`
- [ ] Accessible as built: real buttons and links, labels, focus ring (`stroke-focus`, `action-subtle`), icon-only controls labelled
- [ ] One MDX page per component: live examples (all variants, both themes), guidelines, tokens used
- [ ] Each example is also an isolated story route (`/stories/<component>/<variant>/`, no site chrome, excluded from search and sitemap); the build writes a stories manifest (id, URL, suggested viewports) with a documented, versioned shape
- [ ] All gates pass plus the site job, and the GitHub run is green
