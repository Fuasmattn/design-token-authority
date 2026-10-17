# TICKET-099: Landing page: GitHub and agents instead of the review demo; token cycle in the headline

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** S
**Blocked by:** 098
**Status:** done

## Background

Maintainer feedback on the preview: the interactive review demo ("See it") is confusing at first sight, above all on phones, and gives one part of the system too much weight. The headline promises "built for humans and agents", so the page should show how DTA fits into GitHub and how agents use it. The redline tag under "agents." said `color.action`, which is semantically wrong for that word.

## What changed

- **Removed:** the review demo (`components/landing/ReviewDemo.astro`, `REVIEW_TABS`) and the "Ways to use it" section, whose Try / Govern / Delegate cards repeated what the new sections say.
- **In your pull requests** (`#github`): status check, one comment per pull request, approval by label (all shipped), the action line, other CIs through a publish hook, a link to the guide, and a `DiffCard` marked as example.
- **With your agent** (`#agents`): deterministic checks with JSON output and exit codes, `llms.txt` and the JSON Schemas (shipped), skill and MCP server marked coming; the agent example and `dta skill add` (coming).
- **Navigation:** How it works · GitHub · Agents · Docs.
- **Headline:** new design-system component `TokenCycle` (docs page, story with `autoplay={false}`): "agents." cycles through type styles every two seconds and on click: `font-weight.bold` → `font-style.italic` → `font-weight.regular` (maintainer's idea, more elegant than colours). Weight glides along the variable font's axis; italic is its own font file (now loaded and preloaded, not synthesized), so the switch to and from it happens under a short fade. The redline is drawn again and the tag pops in on every change. Pauses on hover; reduced motion turns autoplay and animation off. Plain text inside the heading (not a button), so the heading reads as written.
- The page sections that place text next to a visual share one layout (`.split`).

## Acceptance criteria

- [x] Checked at 1280px and 390px; the cycle checked in Chromium (order, hover pause, click)
- [x] All gates pass plus the site job, and the GitHub run is green
