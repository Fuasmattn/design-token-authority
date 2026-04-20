# TICKET-031: Brand brief export for AI design generators

**Phase:** 7 — AI Interop
**Priority:** Medium
**Effort:** S

## Summary

Add a `dta brief` command that emits a compact, prompt-ready brand and design-system brief consumable by AI design generators — Google Stitch, Claude artifacts, v0, Galileo, Uizard, and similar tools that produce UI from text prompts. The brief lands the generator on-brand from the first prompt instead of drifting into generic color palettes.

## Background

AI design generators produce output that ignores the team's actual tokens because the user never thinks to paste them in. The result is a workflow where the generator makes a nice-looking but off-brand screen, and a human re-skins it afterward with the correct tokens — losing most of the speed benefit.

A well-structured brief, copy-pasted into the design tool as part of the prompt, pulls the output into brand space before the generator commits to values. This works today with Stitch, Claude, and v0, and the format is simple enough to remain useful as those tools evolve.

## Acceptance Criteria

- [ ] New command: `dta brief [--brand <name>] [--format markdown|json]`
- [ ] Markdown format (default) is prompt-ready — copy-pasted into any AI design tool
- [ ] Content:
  - Brand name + short identity statement (from config)
  - Primary, secondary, accent colors (resolved values + "use this for..." one-liners)
  - Neutrals palette (resolved values only)
  - Typography: font family, 3–5 representative sizes, weights available
  - Spacing scale: representative values
  - Border radius scale
  - Breakpoints (for responsive generators)
  - "Rules" section: one-liners like "Never use pure black — use `Colors.Text.Default`"
- [ ] JSON format is structured for programmatic piping into tool APIs (e.g. a Stitch MCP)
- [ ] `--brand <name>` restricts to one brand; default behavior emits one brief per brand
- [ ] Stays under ~400 tokens rendered so it fits comfortably at the top of any prompt
- [ ] Config option `brief.identity` lets teams set the one-line brand identity string (not derivable from tokens)
- [ ] `--copy` flag writes the brief to the system clipboard on supported platforms

## Implementation Notes

**Markdown output example:**

```markdown
# BrandA Design System Brief

**Identity:** Calm, trustworthy, institutional. (Example string — set via `brief.identity` in config.)

## Colors
- Primary: `#003F8A` — use for CTAs, headers, branded surfaces
- Secondary: `#6AA6D9` — supporting surfaces, info states
- Accent: `#E2A82F` — used sparingly, for emphasis only
- Success / Warning / Error: `#2E7D32` / `#F9A825` / `#C62828`
- Neutrals: `#0A0A0A` `#3B3B3B` `#8A8A8A` `#E5E5E5` `#FAFAFA`

## Typography
- Font: Inter
- Sizes: 12, 14, 16, 20, 28, 40 (px)
- Weights: 400, 500, 700

## Spacing
4, 8, 12, 16, 24, 32, 48, 64 (px)

## Radius
4, 8, 12, 24 (px)

## Breakpoints
Mobile <768, Tablet 768–1024, Desktop 1024+

## Rules
- Never use pure black — use `#0A0A0A`
- Primary color is the only blue; all other blues must defer to secondary
- Radius is never 0 on interactive surfaces
```

**Token → brief compression:** This is *selective export*, not full dump. Heuristics:

- Colors with a role name (`primary`, `secondary`, `accent`, `success`, etc.) → featured
- Spacing: show the unique resolved values, not the semantic names
- Typography: if there are 20 sizes, show 3–5 representative ones (the modular scale steps)

**Editing pass:** The `rules` section is not auto-generatable from tokens. Pull from `brief.rules` in config; fall back to a single generic rule if absent.

**JSON format:** Same content, keyed structure, suitable for an eventual `stitch` MCP or programmatic injection into a design tool's "system context" field.

## Dependencies

- TICKET-008 (config — `brief.identity`, `brief.rules`)
- TICKET-016 (multi-brand — per-brand briefs)
- TICKET-028 (DESIGN.md — shares compression heuristics)
