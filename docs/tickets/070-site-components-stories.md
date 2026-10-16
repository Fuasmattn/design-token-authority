# TICKET-070: Drafting Table components and their story pages

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 069
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 6)

## What to build

The design system's components exist as Astro components (Button, CommandButton, Chip, TextField, Terminal, Redline, DiffCard, WorkflowRail), each with a story page that shows every variant in both themes at a stable URL, plus a stories manifest the build writes. These stories are what `dta diff` renders later.

## Acceptance criteria

- [ ] Components use only semantic token variables; borders not shadows; motion as the system specifies and off under `prefers-reduced-motion`
- [ ] Accessible as built: real buttons and links, labels, focus ring (`stroke-focus`, `action-subtle`), icon-only controls labelled
- [ ] One story page per component, both themes, all variants; stories excluded from search and sitemap
- [ ] Build writes a stories manifest (id, URL, suggested viewports) with a documented, versioned shape
- [ ] All gates pass plus the site job, and the GitHub run is green
