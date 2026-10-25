# TICKET-128: Stories as a page list

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** done (2026-10-24)
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

- [x] `diffConfigSchema` accepts an array of paths; invalid entries (not starting with `/`) are a config error
- [x] `dta diff --list` shows the pages
- [x] Docs: the page list is the first option for sites; the manifest format is documented as the advanced option
- [x] All gates pass, and the GitHub run is green

## Notes

- `diff.stories` also takes a list of paths (`z.array(z.string().startsWith('/'))`, at least one). `pageStories` in `@dta/visual-diff`: the path is the title, the id is file-safe (`/` → `home`, `/docs/intro/` → `docs-intro`); two paths with the same id are an error.
- A page is served from `outDir` as `/` → `index.html`, `/a` → `a`, `a.html` or `a/index.html`. A page the head's build does not have stops the run; one the base does not have yet counts as added.
- `dta diff --list` prints "Pages in: dist" and the pages; the guide's "Which pages it renders" leads with the page list, then Storybook, then the manifest (with its format) as the advanced option.

## Review (2026-10-24)

- `diff.stories` takes page paths starting with `/` (schema and CLI tests), `dta diff --list` prints them, and the diff guide leads with the page list, the manifest as the advanced option. CI green on 3bdd228.
- Follow-up in TICKET-148: an end-to-end run on a page list (today only a manifest is rendered end to end).
