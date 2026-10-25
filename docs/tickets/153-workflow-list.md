# TICKET-153: Landing page: the workflow as a numbered list grouped by place (`WorkflowList`)

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** S
**Blocked by:** 112 (done)
**Status:** in progress (2026-10-25)
**Spec:** [landing-redesign](../specs/landing-redesign.md) (revision 2026-10-25, decision 12); design system: DTA Drafting Table, component _WorkflowList_ and principle 6 "One rhythm per list"

## Problem

The workflow strip of TICKET-112 is right in content and wrong in rhythm: on a phone it stacks five steps with five different vertical shapes (side label, label, text, chip, gap), the command chips vary in width, the chip on every step repeats the hero's call to action four times, and "in the pull request" is both a label and a 500 px left rule. The maintainer is not happy with the phone rendering (2026-10-25, three drafts compared on the Design canvas; draft A "Rail" chosen).

## What to build

Replace `WorkflowRail` with `WorkflowList`: the same content, one shape per row, grouped by where each step happens. The design system got the component first (DTA Drafting Table → Workflow → WorkflowList) and its rules are the spec:

1. **Three places, in order.** _Change_ (where the change is made: Figma, a token file, an agent) → the crossing into the repository (`dta pull` on a dashed `rail` connector) → _in the pull request_: one `bg-surface` card with a `border-default` hairline, `radius-lg`, and a mono eyebrow in `signal-text`.
2. **One row per step.** A number in a 28 px mono column; the one-word label in `title` style; the command as **plain mono text on the label's baseline, right-aligned** (not a chip: the section explains, it does not install); one `body-sm` line in `fg-muted` below. Rows in the card are separated by `border-default` hairlines, `space-4`–ish padding above and below. Nothing else varies between rows.
3. **Number treatment.** Step 1 (the human starts it) is a 2 px `border-strong` box, `radius-sm`; steps 2–5 are plain `fg-muted` numerals. _Decide_ has no command: its right slot says "a person" in `meta` style, `action-text`.
4. **Blueprint accent, no redline:** the `$` prompts in `action-bg`, the eyebrow and "a person" in `action-text`; nothing here has changed yet, so `signal` stays out (maintainer, 2026-10-25: the redline-on-graphite pairing read as generic AI styling). The return line ("A fix goes back to whichever side caused it …") is `fg-muted` body copy under the card, with `dta audit` as the only chip besides `dta pull`.
5. **Layout.** Phone first: everything in one column, the card full width. From 960 px of container: two columns, the change and the crossing left (`1fr`), the card right (`2fr`, max 640 px); rows stay rows. No motion.
6. **Rename, everywhere:** `WorkflowList.astro`, `WorkflowListDefault.astro`, story `workflow-list--default` (desktop and phone), docs page `design-system/components/workflow-list.mdx` (`WorkflowRail` page removed), `index.astro`, comments in `content.ts`. Props stay as they are (`change`, `crossing`, `pullRequest`, `steps`, `back`), so `WORKFLOW` in `content.ts` and the honesty test are untouched.

Revision of decision 12: the strip is now numbered and the pull request is a card. "Nothing numbered beyond the scene kickers" is dropped for this one section; the numbers are the rhythm, not a list of features. Recorded in the spec's revision note.

## Acceptance criteria

- [ ] `WorkflowList` renders the design-system rules above in both themes, 390 px and 1280 px; `WorkflowRail` is gone from site, docs and stories
- [ ] Docs page `workflow-list` with guidelines and tokens used; stories at both widths; `stories.test.ts` and `components.test.ts` green (token variables only, complete borders)
- [ ] AAA contrast test green: numerals, eyebrow and "a person" are `fg-muted` and `action-text`, never `fg-subtle`
- [ ] No horizontal scroll at 390 px; the command never wraps under the label (right slot `white-space: nowrap`, label `min-width: 0`)
- [ ] Spec revision note added to `landing-redesign.md`; `000-index.md` row added
- [ ] All gates pass; Vercel preview reviewed by the maintainer before merge

## Notes

- Design canvas "DTA Workflow Section Alternatives": draft A is the reference; B (one terminal) and C (places as tiles) were not chosen.
- Keep `CommandButton` for `dta pull` and `dta audit` only; the rows use `font-mono` text with a `signal-bg` prompt glyph.
