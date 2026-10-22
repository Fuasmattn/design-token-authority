# TICKET-128: Stories as a page list

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md)

## What to build

Projects without Storybook today need a `dta.stories/1` manifest, which the user docs do not describe. Add the simplest form: a list of pages, served from `diff.outDir`.

```ts
diff: {
  outDir: 'dist',
  stories: ['/', '/pricing', '/checkout'],
}
```

Each entry becomes a story with the path as id and title. The manifest (`type: 'static-site'`) and Storybook (`type: 'storybook'`) stay as they are.

## Acceptance criteria

- [ ] `diffConfigSchema` accepts an array of paths; invalid entries (not starting with `/`) are a config error
- [ ] `dta diff --list` shows the pages
- [ ] Docs: the page list is the first option for sites; the manifest format is documented as the advanced option
- [ ] All gates pass, and the GitHub run is green
