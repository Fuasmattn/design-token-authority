# TICKET-089: Storybook adapter for `dta diff`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** M
**Blocked by:** 082
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 3)

## What to build

Projects with a static Storybook build use `dta diff` without writing a stories manifest: `diff.stories: { type: 'storybook' }` reads `index.json` of the built Storybook and renders each story through its iframe URL.

## Acceptance criteria

- [x] `diffConfigSchema` accepts `stories.type: 'storybook'` (with an optional `index` path, default `index.json`) next to `static-site`
- [x] Adapter maps Storybook `index.json` (v5) entries of type `story` to `StoryRef`s (`iframe.html?id=<id>&viewMode=story`), docs entries skipped; tags or a filter option to exclude stories
- [x] Package tests on a recorded `index.json`; `dta diff --list` works on a fixture Storybook build
- [x] Docs page "dta diff with Storybook"
- [x] All gates pass, and the GitHub run is green

## Notes

- Config: `diff.stories` is a union on `type`: `static-site` (default, also when `type` is left out) or `storybook` with `index` (default `index.json`), `excludeTags` (default `['skip-dta-diff']`) and `exclude` (regular expressions on story ids, validated).
- `readStorybookIndex` in `@dta/visual-diff`: v4 and v5 `index.json`, entries of type `story` only, title `Title / Name`, URL `/iframe.html?id=<id>&viewMode=story`; Storybook 6 `stories.json` and other files come back as a diagnostic. `StoryRef.ready` (new, optional): an expression the capture waits for after network idle; Storybook stories wait for the iframe's `sb-show-main` (or error / no-preview) body class. The CLI's screenshot and attribution pages both wait for it.
- Recorded fixture: `test/storybook/storybook-static/index.json` from a real Storybook 10.6.1 build (`@storybook/html-vite`; outside `test/fixtures` so the snapshot harness does not pick it up). Package tests and `dta diff --list` tests use it.
- Checked once for real on that Storybook project at two commits (DTA tokens built into `.storybook`, `setup: npm ci`): `space` 8 → 12 explains both Button stories, the Card's literal radius change is unexplained, verdict fail; the same commit against itself: 3 of 3 unchanged. About 30 s including the base install.
- Docs page: `site/src/content/docs/guides/dta-diff-with-storybook.mdx`.
