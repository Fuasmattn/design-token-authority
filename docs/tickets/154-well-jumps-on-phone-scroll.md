# TICKET-154: Gravity well flashes and jumps while scrolling on phones

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** XS
**Blocked by:** —
**Status:** in review (2026-10-25, on the TICKET-153 branch)

## Problem

On a phone the hero's key visual (`GravityWell`) moves oddly while scrolling down and back up (maintainer, 2026-10-25, Vercel preview of PR #32). The browser's toolbar collapses and expands with the scroll and fires `resize` each time; the hero answered every `resize` (and the matching `ResizeObserver` call) with a full `apply()`: the canvas was re-sized, which clears it, and the orbit objects were re-placed, although the hero's own box had not changed.

## What to build

- `layout()` returns early when the hero's rounded width and height are what it laid out last; colours and the animation still refresh on `apply()`.
- No change to the parallax, the first paint, theme changes or `prefers-reduced-motion`.

## Acceptance criteria

- [x] Scrolling a phone up and down over the hero no longer flashes or moves the well
- [x] Rotating the phone, resizing the window and switching the theme still re-lay out and recolour as before
- [ ] All gates pass; Vercel preview checked on a phone
