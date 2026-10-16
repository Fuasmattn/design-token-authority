# TICKET-091: Breakpoint modes in the build output

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** M
**Blocked by:** —
**Status:** open

## What to build

Collections whose modes are not brands (the dimension layer, e.g. `ScreenType` with `Desktop`, `Tablet`, `Mobile`) become CSS that switches by breakpoint. Today `dta build` reads them only to resolve aliases (documented on the Outputs and Core concepts pages, 072).

## Acceptance criteria

- [ ] Config names the breakpoint collection and maps each mode to a media query (or a selector), e.g. `breakpoints: { collection: 'ScreenType', modes: { Desktop: '(min-width: 1024px)', … } }`
- [ ] `dta build` writes the tokens of each mode inside its media query (default mode on `:root`), as `var()` references where they alias
- [ ] Tailwind v4 output covers them; snapshot of `build` on `brand-ab` re-recorded and reviewed
- [ ] `outputs.css.prefix` and `outputs.tailwind.version` either take effect or are removed from the schema with a clear message (accepted but unused today)
- [ ] Docs pages updated; all gates pass, and the GitHub run is green
