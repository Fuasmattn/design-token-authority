# TICKET-089: Storybook adapter for `dta diff`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** M
**Blocked by:** 082
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 3)

## What to build

Projects with a static Storybook build use `dta diff` without writing a stories manifest: `diff.stories: { type: 'storybook' }` reads `index.json` of the built Storybook and renders each story through its iframe URL.

## Acceptance criteria

- [ ] `diffConfigSchema` accepts `stories.type: 'storybook'` (with an optional `index` path, default `index.json`) next to `static-site`
- [ ] Adapter maps Storybook `index.json` (v5) entries of type `story` to `StoryRef`s (`iframe.html?id=<id>&viewMode=story`), docs entries skipped; tags or a filter option to exclude stories
- [ ] Package tests on a recorded `index.json`; `dta diff --list` works on a fixture Storybook build
- [ ] Docs page "dta diff with Storybook"
- [ ] All gates pass, and the GitHub run is green
