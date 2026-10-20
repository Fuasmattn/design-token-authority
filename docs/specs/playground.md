# Spec: Playground — DTA in the browser, embedded in the website

**Status:** approved (2026-10-16); open questions settled by the maintainer 2026-10-19 (decisions 8–11); Graph view built 2026-10-20 (decision 16)
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 7b (between the website and visual-diff, maintainer decision)
**Depends on:** Epic 7 ([website](./docs-site.md): site shell, components, design tokens)
**Design sources:** concept doc "Visual Regression Module — Concept Sketch" (sections Playground and visualizer, Product story: Try); landing mockup "J · Drafting Table" (Try card, Playground card)

## Problem

The "Try" path of the product story has no entry point that needs zero setup. Someone with a token file (from a plugin export, Figma's native DTCG export or a colleague) has to install Node and run the CLI to see whether their structure holds, what the outputs look like and what a config would be. The v1 answer, HTML pages generated inside TypeScript strings (`graph.ts`, `docs-html.ts`), is gone or frozen.

## Solution

A static, client-side app embedded in the website as an Astro island: drop or paste a token file, see the structure, the dependency graph and lint findings, preview and download the outputs, and get a generated `dta.config.ts` with the matching `npx dta` command. Everything runs in the browser on the same `@dta/*` packages the CLI uses; tokens never leave the device. Running the packages in a browser also proves their boundaries are right (pure, no Node I/O).

## Decisions

1. **Same engine, no fork.** The playground calls the public APIs of `@dta/core` (parse, resolve, graph, structure), `@dta/figma` (plugin-export import and format detection), `@dta/lint` and `@dta/build`. If a package cannot run in the browser, the fix goes into the package (an injectable file system or a pure entry point), not a playground copy.
2. **Input:** drag-and-drop (or file picker) or paste of DTA's per-mode DTCG files (several files at once) or a single plugin export (auto-detected, as `pull --from-file`). Invalid input yields the same diagnostics the CLI prints.
3. **Views:** structure (collections, modes, detected layer roles), dependency graph with a brand and breakpoint switcher, lint findings inline, outputs (CSS, Tailwind v4/v3, JS) with copy and download, and a "take it to the CLI" panel with a generated `dta.config.ts` and the commands to run.
4. **No server, no storage, no accounts.** Nothing is uploaded or persisted beyond an optional per-browser "last session" convenience (local storage, safe to lose). No Figma pull (the REST API needs Enterprise and a token in the browser).
5. **Design:** the site's Drafting Table components and tokens; the graph uses the same visual language (ink lines, blueprint selection, redline highlights for findings).
6. **Example data:** the brand-ab fixture as the one-click example (BrandA/BrandB only); it is the one that exercises the brand and breakpoint switcher. The Orbit Burger example (TICKET-105, one brand, one mode) may be offered as a second, smaller example. Next to it, "Example with problems" (TICKET-113): the same tokens with one flaw per default lint rule (fixture `brand-ab-problems`), so the findings have something to show.
7. **Static and island-loaded:** the app loads only on the playground page; the rest of the site stays light.

8. **CLI graph HTML stays as it is in this epic.** Reusing the playground UI for `dta graph --format html` is a separate, later ticket (was open question 1).
9. **Outputs load lazily.** `@dta/build` (Style Dictionary) is loaded when the outputs tab opens, so the playground's first load stays light; outputs are in the first version (was open question 2).
10. **Blueprints come later**, after the bootstrap-skill work, not in this epic (was open question 3).
11. **The packages are already close to browser-ready** (checked 2026-10-19): outside test helpers, `@dta/core`, `@dta/figma`, `@dta/lint` and `@dta/build` import no Node built-ins, and `buildOutputs` runs Style Dictionary in memory (`formatAllPlatforms`) and writes nothing. TICKET-076 is mainly the proof (browser-environment tests) and the bundle-size measurement.
12. **Own route, not a Starlight page** (maintainer, 2026-10-19). The playground is a standalone page at `/playground` (`site/src/pages/playground.astro`) with the site's Nav and theme, full width and its own layout, outside the Starlight frame. The placeholder docs page and its sidebar group go; docs pages and the landing page link to `/playground`. The landing page and the playground share one page layout (`SiteLayout.astro`: token CSS, themes, fonts, Nav, theme switch) instead of copying it. "Playground" joins the site nav when 077 ships.
13. **Preact island** (maintainer, 2026-10-19). The interactive app is a Preact component loaded as an Astro island (`client:load` or `client:visible`) on the playground page only. Design-system rules still apply: what the app renders is styled with the Drafting Table tokens and design-system components; UI the design system lacks becomes a component first (docs page + story).
14. **Input:** a drop area for files (drag and drop) that is also a button opening the file picker (keyboard and phones, where dragging is not an option), a paste field for JSON, and "Load example". Several files at once.
15. **A workspace, not a stacked page** (maintainer, 2026-10-19, after reviewing the layout canvas). Before loading: the drop area takes the page, with "Load example", "Example with problems" (113) and "Paste JSON instead" behind a button. After loading: the input shrinks to a one-line source bar ("brand-ab example · 6 files", "Replace files", "Paste JSON instead"); under it a summary line that stays visible (collections, brands, breakpoints, tokens, findings, output files; each part jumps to its view); then tabs Structure · Lint · Graph · Outputs (a sticky bar on phones). Details open in a side panel on desktop and in a bottom sheet on phones (collection → its tokens and alias chains; finding → full message and chain; output file → preview), so the view behind stays in place. Summaries first: lint grouped by rule with counts. No modal dialogs for the views themselves. Reference boards: `playground/prototypes/` (Start, Main, PhoneLint, PhoneOutputs; literal colours, the look, not the code).
16. **The Graph view (TICKET-078, board `playground/prototypes/Graph.dc.html`, approved 2026-10-20).** `analyzeGraph` from `@dta/core` (run once by the analysis, beside lint) drawn for one mode per multi-mode collection: a Graph switcher (brand, breakpoint; segments on desktop, native selects on phones), layer columns with an arrow from each alias to the token it uses (Graph canvas, layout in `graph-layout.ts`), a list of layers and chains on phones (Graph list, from the site's 760 px break). Findings in the status colours with shape + word (dangling and circular aliases are errors; a dangling alias ends in a "missing" row built from its target name), the selection and its chain in the action colours. A token opens in the Detail panel with every reading as `dta token get` gives them (its CSS and Tailwind names from `@dta/build`'s pure `codeNames`), its findings, "Show in lint" and "Show <brand>"; a lint finding about a token has "Show in graph". The hash keeps the selected token (`#graph/<id>`, the id's mode chosen). Keyboard: one row in the tab order, arrows along columns and aliases, Enter opens. The graph's code loads with the tab (lazy chunk), like the outputs. Reusing it for `dta graph --format html` stays a later, separate ticket (decision 8).

## Open questions

None.

## Testing decisions

- Package seam: a browser-environment test (Vitest browser mode or a jsdom/happy-dom run, whichever the packages need) proves each used package API runs without Node built-ins.
- App: component tests for the input → views flow on the brand-ab fixture; the playground's own story pages are rendered by Epic 8's `dta diff` once it lands.
- The generated config is loaded by the real CLI config loader in a test (it must be valid).

## Out of scope

Editing tokens, saving or sharing sessions, Figma API access, accounts, AI features, the bootstrap skill.

## Tickets

[076](../tickets/076-playground-browser-packages.md) · [077](../tickets/077-playground-input-structure-lint.md) · [078](../tickets/078-playground-graph.md) · [079](../tickets/079-playground-outputs-config.md)
