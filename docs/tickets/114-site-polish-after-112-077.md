# TICKET-114: Site polish after 112 and 077

**Phase:** 10 — Landing redesign
**Priority:** Low
**Effort:** S
**Blocked by:** 112, 077, 079
**Status:** open

## What to build

Small things noticed on the 112 and 077 screenshots (2026-10-19):

1. **Workflow strip label:** at 1280 px, "where the change is made" wraps onto two lines above "Change"; it should stay on one line (or the label gets shorter).
2. **Nav marks the current page:** `aria-current="page"` and a visible current state in `Nav` (landing page sections excluded), with a story.
3. **Diagnostic links on the website:** the `unknown-format` diagnostic points to `docs/token-files/input-format.md`, a repository path that means nothing in the playground. Either the message names the website page (Token files reference) or the playground renders known doc paths as links to it. The CLI wording stays shared (077), so decide where the mapping lives.
4. **Playground outputs (from 079):** the Tailwind group mixes v4 (`tailwind.css`) and v3 (`tailwind.tokens.ts`) files without saying which is which; label them. The file preview wraps code mid-token on phones (`var(--` breaks); code should keep its lines and scroll inside its box instead.
5. **Scene order (needs the maintainer):** the scene chips read pull → diff → lint while the strip runs lint before diff (recorded in 112's outcome). Keep, or swap scenes 02 and 03?

## Acceptance criteria

- [ ] Items 1–4 done; item 5 decided and applied
- [ ] Contrast, phone-width and layout-shift checks still green
- [ ] All gates pass plus the site job, and the GitHub run is green
