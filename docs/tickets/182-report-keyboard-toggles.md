# TICKET-182: Keyboard shortcuts for "Show before" and "Diff overlay"

**Phase:** 14 — Launch
**Priority:** Low
**Effort:** S
**Status:** open (2026-11-02)
**Spec:** [visual-diff](../specs/visual-diff.md)
**Issue:** #64 (good first issue)

## Problem

Reviewing a long `dta diff` report means moving the pointer to each story's toggles. Reviewers who go through dozens of stories want to stay on the keyboard.

## What to build

- While focus is inside a story (its toggles, its image or its token table), `B` toggles "Show before" and `O` toggles "Diff overlay" (when the story has one).
- No shortcut fires while focus is in a text field, or with Ctrl, Cmd or Alt held.
- The shortcuts are discoverable: shown in the toggles' `title` and listed once at the top of the report.
- The same in the design system's Diff card (`site/src/components/ds/DiffCard.astro`), which mirrors the report's script.
- Docs: the shortcuts in the "Reading the report" section of the pull request guide and on the Diff card page.

## Acceptance criteria

- [ ] `B` and `O` toggle the focused story only, exactly as a click does (`aria-pressed` and the on/off word update)
- [ ] Nothing happens with modifier keys or in a text field
- [ ] Shortcuts visible in the report and documented; Diff card matches
- [ ] Gates green

## Notes

- The toggle script is in `packages/visual-diff/src/report/html.ts` (search for `data-toggle`); the shortcut can click the story's existing button so both paths stay one.
