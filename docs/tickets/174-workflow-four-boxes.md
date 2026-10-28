# TICKET-174: The workflow section as four plain boxes

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** in review (2026-10-28), branch `174-workflow-four-boxes`
**Spec:** [landing-redesign](../specs/landing-redesign.md) (revision note 2026-10-28)

## Problem

People who read the landing page did not get what DTA does from the second section. It talks in metaphors ("Tokens change", "Checked, built, rendered", "The team decides"), its three sentences run 25 to 30 words each, and its titles exist because the layout has room for them. The animation (a token travelling a line, dust, "Merged") is what people remember, not what the tool does.

## What to build

- `Workflow` becomes four boxes, one sentence each, no titles beyond the command:
  - `dta lint`: Validates names and structure against your rules, and finds broken aliases and low contrast.
  - `dta build`: Rebuilds every output for every brand and mode.
  - `dta diff`: Shows which stories look different, and which token did it.
  - You: Look once per token change and approve it.
- Headline (the benefit): "Catch naming, structure and visual mistakes before a token change merges." Kicker stays "How it works" (the anchor).
- A link to the command reference (`/reference/commands/`) after the boxes.
- Two columns on phones, four from 960px of container. The person's box has the strong outline.
- No motion: the line, the token, the dust, the end and their script go.
- Docs page and story updated; tests that pinned the old beats rewritten for the new content.

## Acceptance criteria

- [ ] Every sentence true for every user: checked against `--help`, the lint rules and the approve guide
- [ ] Safety check of the maintenance spec green; `dta diff` shows only the Workflow stories changed
- [ ] Vercel preview checked by the maintainer at 1280 and 390, light and dark

## Notes
