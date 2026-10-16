# Spec: Playground — DTA in the browser, embedded in the website

**Status:** approved (2026-10-16); open questions below are settled in the tickets that need them
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 7b (between the website and visual-diff, maintainer decision)
**Depends on:** Epic 7 ([website](./docs-site.md): site shell, components, design tokens)
**Design sources:** concept doc "Visual Regression Module — Concept Sketch" (sections Playground and visualizer, Product story: Try); landing mockup "J · Drafting Table" (Try card, Playground card)

## Problem

The "Try" path of the product story has no entry point that needs zero setup. Someone with a token file (from a plugin export, Figma's native DTCG export or a colleague) has to install Node and run the CLI to see whether their structure holds, what the outputs look like and what a config would be. The v1 answer, HTML pages generated inside TypeScript strings (`graph.ts`, `docs-html.ts`), is gone or frozen.

## Solution

A static, client-side app embedded in the website as an Astro island: drop or paste a token file, see the structure, the dependency graph and lint findings, preview and download the outputs, and get a generated `dta.config.ts` with the matching `npx dta` command. Everything runs in the browser on the same `@dta/*` packages the CLI uses; tokens never leave the device. Running the packages in a browser also proves their boundaries are right (pure, no Node I/O).

## Decisions

1. **Same engine, no fork.** The playground calls the public APIs of `@dta/core` (parse, resolve, graph, structure), `@dta/figma` (plugin-export import and format detection), `@dta/lint` and `@dta/build`. If a package cannot run in the browser, the fix goes into the package (an injectable file system or a pure entry point), not a playground copy.
2. **Input:** drag-and-drop or paste of DTA's per-mode DTCG files (several files at once) or a single plugin export (auto-detected, as `pull --from-file`). Invalid input yields the same diagnostics the CLI prints.
3. **Views:** structure (collections, modes, detected layer roles), dependency graph with a brand and breakpoint switcher, lint findings inline, outputs (CSS, Tailwind v4/v3, JS) with copy and download, and a "take it to the CLI" panel with a generated `dta.config.ts` and the commands to run.
4. **No server, no storage, no accounts.** Nothing is uploaded or persisted beyond an optional per-browser "last session" convenience (local storage, safe to lose). No Figma pull (the REST API needs Enterprise and a token in the browser).
5. **Design:** the site's Drafting Table components and tokens; the graph uses the same visual language (ink lines, blueprint selection, redline highlights for findings).
6. **Example data:** the brand-ab fixture as a one-click example (BrandA/BrandB only).
7. **Static and island-loaded:** the app loads only on the playground page; the rest of the site stays light.

## Open questions

1. **CLI graph HTML:** the concept says the CLI should reuse the playground UI for `dta graph --format html`. Do that in this epic (the CLI then ships a built bundle and the `graph-html` snapshots change by name), or keep the ported v1 HTML until later (recommended: later, separate ticket)?
2. **Style Dictionary in the browser:** `@dta/build` uses Style Dictionary v4, which supports browser use with an in-memory file system. If that turns out heavy (bundle size), is it acceptable to load outputs lazily on the outputs tab (recommended), or should outputs be dropped from the first version?
3. **Learn tie-in:** should the blueprints (pattern catalogue starters, concept's `@dta/blueprints`) be loadable examples here in this epic, or after the bootstrap-skill work?

## Testing decisions

- Package seam: a browser-environment test (Vitest browser mode or a jsdom/happy-dom run, whichever the packages need) proves each used package API runs without Node built-ins.
- App: component tests for the input → views flow on the brand-ab fixture; the playground's own story pages are rendered by Epic 8's `dta diff` once it lands.
- The generated config is loaded by the real CLI config loader in a test (it must be valid).

## Out of scope

Editing tokens, saving or sharing sessions, Figma API access, accounts, AI features, the bootstrap skill.

## Tickets

[076](../tickets/076-playground-browser-packages.md) · [077](../tickets/077-playground-input-structure-lint.md) · [078](../tickets/078-playground-graph.md) · [079](../tickets/079-playground-outputs-config.md)
