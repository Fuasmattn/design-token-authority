# TICKET-178: Code blocks dark in both themes

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** review (2026-11-02)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

In the light theme the docs' code blocks barely stand out from the page. Expressive Code draws the frame border, the line under the title bar and the terminal dots in `--border-default` at 75% opacity: about 1.1:1 on `--bg-canvas`. The light syntax theme also renders a shell command in a single colour.

The rendered contrast test never saw it: it audits the landing page, the playground and the stories, not the docs pages.

## What to build

- Code blocks (Expressive Code, `site/ec.config.mjs`) use the Graphite theme in both site themes: one dark syntax theme (`starlight-dark`), and the frame colours mapped onto DTA's semantic tokens resolved in Graphite (`data-brand="graphite"` on each block group, Expressive Code's variables declared on the block, not `:root`). No raw colours; syntax colours raised to 7:1 against the built `bg-subtle`.
- Inline code stays as it is (light on the light theme).
- The rendered contrast test audits docs pages with a terminal block and a TypeScript block, in both themes.
- Design system docs: code blocks are always dark.

## Acceptance criteria

- [x] In the light theme, code blocks render with Graphite backgrounds, frame and text; dark theme unchanged in look
- [x] Code text, tab labels and the copy button reach AAA on the docs pages checked, both themes
- [x] Gates and site checks green

## Notes

- The options live in `site/ec.config.mjs`, not `astro.config.mjs`: the `<Code>` component needs them and they hold functions. Astro bundles that file, so it reads the built token CSS from the working directory (`site/`).
- Found while auditing the docs pages, left for their own tickets: Starlight's screen-reader-only "Section titled …" heading labels count as 1:1 in the audit (a false positive, the text is clipped); an inline-code link (`dta pull` on the quick start) is 6.7:1 in the light theme, under AAA. The new test audits the code blocks only.
- `motion.e2e.test.ts`: two layout-shift checks on the playground fail in a local Chrome on Node 22, on main as well (shift about 0.001); CI passes them.
