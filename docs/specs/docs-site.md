# Spec: DTA website — landing page, docs and Learn on Astro + Starlight, styled by DTA's own tokens

**Status:** approved (2026-10-16); open questions below are settled in the tickets that need them
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 7
**Depends on:** Epic 6 and TICKET-039 (`pnpm snapshot:record`)
**Followed by:** Epic 7b, [playground](./playground.md) (embedded into this site), Epic 8, [visual-diff](./visual-diff.md) (guards this site in CI)
**Design sources (maintainer's drafts on claude.ai):** concept doc "Visual Regression Module — Concept Sketch" (sections Website, Docs structure, Product story); design system **DTA Drafting Table**; canvas **DTA Landing Page Mockup**, artboards "J · Drafting Table — light / dark (Graphite)" and "J refined — phone 390"
**Related:** TICKET-022/061 (`@dta/docs`, removed here), [cli-parity spec](./cli-parity.md) decision 9, [v1 → v2 migration note](../migration/v1-to-v2.md)

## Problem

DTA has no public home. Its documentation is a README that has drifted from the CLI (it lists `build/…` paths while the build writes `output/…`, and advertises `dta lint --fix`, which is not supported), plus maintainer docs scattered over `docs/`. Nothing explains the product story (Try, Govern, Delegate), the DTCG format or how to structure tokens, and nothing shows what DTA does before someone installs it.

Meanwhile `dta build` still writes `output/docs/index.html`, a 1.5k-line page ported verbatim from v1 only for parity. The concept replaces generated HTML pages with one site and the playground (Epic 7b), so it goes.

## Solution

One site, not three: landing page, docs and Learn under one navigation, built with Astro + Starlight, static, hosted on Vercel, no tracking. The playground (Epic 7b) is embedded later as an island.

- **Design:** the DTA Drafting Table design system (paper, ink, blueprint blue, orange redlines; Instrument Sans and Martian Mono; light and Graphite dark). The landing page implements the "J · Drafting Table" mockup.
- **Dogfooding:** the site's colours, type, spacing, radii and strokes come from DTA token files in this repo, built with `dta build`. The site is the live demo of the pipeline, and Epic 8 guards it with `dta diff`.
- **Docs that cannot drift:** reference pages (commands, config, schemas) are generated from the code; `llms.txt` gives agents the same content.
- **`@dta/docs` is removed** from the CLI.

## Decisions

1. **`@dta/docs` is deleted** (maintainer decision). `build` stops writing `output/docs/`; `outputs.docs` in a config is an error with a targeted message ("removed in v2, delete the key"), exit code 2; `init` no longer opens a docs page; `clean` drops `output/docs` from its defaults. The `build` snapshots of both fixtures are re-recorded by name; no other scenario changes.
2. **The site is a private workspace app** outside `packages/` (`site/`), not a `@dta/*` package, never published, outside Changesets. It imports `@dta/*` public APIs only (boundary guardrail applies).
3. **Astro + Starlight, static output** (decided in the concept). The landing page is a custom Astro page using the site's components; docs pages use Starlight with a theme mapped onto the design system. Hosted on Vercel, pipelines in GitHub Actions, no analytics or tracking scripts.
4. **Design tokens as DTA token files.** The Drafting Table tokens live in the repo as DTCG token files following DTA's model: a primitives file (`paper`, `ink`, `graphite`, `blueprint`, `redline`, `sage` scales, spacing, radius, stroke, type) and a semantic layer with one mode per theme (`Light`, `Graphite`) holding the semantic names (`bg-canvas`, `fg-default`, `action-bg`, `signal-bg`, …) as aliases. `dta build` turns them into CSS custom properties the site uses; the build runs before `astro build`, its output is not committed. `dta lint` must pass on them. The design system artifact stays the design reference; the repo files are the source of truth for the site from now on, and changes to them are reviewed like any token change.
5. **Theme switch = mode switch.** The Light/Graphite toggle switches the semantic mode's CSS (per-brand output, the theme modes taking the brand role); it is wired to Starlight's own theme toggle so docs and landing agree. Known limitation, recorded in the ticket: DTA's model still calls this layer "brand"; the concept's user-defined structure (DTCG resolver modifiers such as theme) is a later epic, and the site migrates then.
6. **Design system section, in Starlight (no Storybook).** A "Design system" group in the docs presents DTA Drafting Table: principles and voice; token pages per family (colours as swatches in Light and Graphite, type scale, spacing, radius, stroke) generated at build time from the site's DTA token files through `@dta/core`, so the section is also a live demo of DTA reading a token set; and one MDX page per component (Button, CommandButton, Chip, TextField, Terminal, Redline, DiffCard, WorkflowRail) with live examples in both themes, usage guidelines and the tokens it uses. The components are Astro components using only semantic token variables. The same example definitions also render isolated story routes (`/stories/<component>/<variant>/`: no site chrome, excluded from search and sitemap) and a stories manifest: what `dta diff` captures. One source for docs and visual tests; motion follows the system (redline draw-in, label pop, rail packet) and stops under `prefers-reduced-motion`. Storybook is not used: the site is static Astro, and MDX in Starlight covers live examples (maintainer decision).
7. **Landing page = mockup J · Drafting Table**, sections in the concept's arc: Hero (pitch "The deterministic backbone for design token workflows, built for humans and agents", `npx dta init` command button) → Problem → How it works (workflow rail Change → Check → See → Decide → Ship) → See it (interactive review demo with structure, breaking and visual-diff findings and the drag-to-compare slider) → Ways to use it (Try, Govern, Delegate) → Why trust it → Learn / Docs / Playground cards → footer. Responsive down to 390 px (artboard "J refined — phone 390"). **Honesty rule:** the mockup shows commands that do not exist yet (`dta check`, `dta diff`, `dta skill add`); the page shows a command only once it ships, otherwise the block is labelled as coming, and demo numbers are clearly example data. (Exception, TICKET-098: the hero shows `npm create dta` unlabelled before the release.) (Changed in TICKET-099: "See it" and "Ways to use it" are replaced by "In your pull requests" and "With your agent".)
8. **Docs structure (Diátaxis, from the concept):** Start (what DTA is, why automate, quick start, core concepts), Learn (DTCG intro, pattern catalogue, how large public systems structure tokens), Guides (getting tokens out of Figma per plan, multi-brand and theming, Tailwind v4 setup, CI with GitHub Actions, migrating from v1; later visual-diff in PRs and the bootstrap skill), Reference (commands, config, token-file format, outputs, lint rules, exit codes), Design system (decision 6), Playground (Epic 7b), Contribute (architecture and package boundaries, ADRs, spec and ticket workflow, release). User docs move into the site; the README shrinks to pitch, quick start and links; maintainer docs (`docs/specs`, `docs/adr`, `docs/tickets`, `CLAUDE.md`) stay in the repo and are linked from Contribute.
9. **Generated reference.** At site build a generator writes: the commands reference from `dta <command> --help` of the real CLI; the config reference and `dta.config.schema.json` from the Zod config schema (exposed through the `@dta/cli` public API); the token-file schema as is; `llms.txt` (and `llms-full.txt`) from the docs content. Generated files are git-ignored; tests pin that every registered command appears and that the JSON Schema accepts both fixture configs and rejects unknown keys and `outputs.docs`.
10. **CI:** a site job on every push runs `dta build` on the site tokens, `astro build`, and an internal link check. The site's Prettier and typecheck are part of the existing gates.
11. **Deploy on Vercel:** preview per pull request, production from `main`.
12. **Brands and copy:** BrandA/BrandB in every example; no real customer names; placeholder copy from the mockup stays visibly marked until replaced.

## Open questions (need a maintainer call before the tickets start)

1. **Deploy mechanism:** Vercel GitHub integration (recommended: no secrets in the repo, previews out of the box, one manual project setup) or GitHub Actions + Vercel CLI (secrets `VERCEL_TOKEN`, org and project id). (Epic 8's report hosting is independent: it goes through a user-configured publish hook; DTA's own repo will use a Vercel recipe there.)
2. **Domain:** `*.vercel.app` for now, or a custom (sub)domain?
3. **Logo:** the design system has only a working mark (two overlapping rounded squares + "dta"). Use it as is for launch?
4. **Hero visual:** the canvas has several hero drafts (the J review demo, robot/mascot and isometric workbench explorations). Superseded by [landing-redesign](./landing-redesign.md) (2026-10-17): no hero visual; the loop diagram is the first picture.
5. **Learn content depth:** the concept wants references to how large public systems structure tokens (Material, Primer, Spectrum, Atlassian, Salesforce Lightning). Write that research into the Learn ticket (recommended), or ship Learn with the DTCG intro and pattern catalogue first?

## Public API changes

- `@dta/docs`: removed.
- `@dta/cli`: adds the config JSON Schema to its public API (for the generator).

## Testing decisions

- Removal: CLI snapshot suite (re-recorded `build` scenarios only) plus CLI tests for the `outputs.docs` error, `init` and `clean`.
- Site tokens: `dta lint` and `dta build` on them in CI; a test pins that every semantic name the components use exists in the build output (no dangling `var(--…)`).
- Generator: tests through its output (commands, schema, `llms.txt` present and complete).
- Components and landing page: story pages render in both themes (checked by `astro build` now; visually by Epic 8's `dta diff` once it lands). No Playwright suite of our own in this epic.
- Accessibility: text contrast pairs from the design system README are respected (the system already flags `paper-500` and white-on-redline); an automated contrast check over the built CSS is a cheap test to add.

## Out of scope

The playground (Epic 7b), visual-diff (Epic 8), the bootstrap skill and its install command, `dta check` / `dta audit` / `dta inspect`, user-defined structure via the DTCG resolver, versioned docs, i18n, blog, search beyond Starlight's built-in Pagefind, npm publishing and the compiled CLI (release ticket).

## Tickets

[067](../tickets/067-site-remove-dta-docs.md) · [068](../tickets/068-site-design-tokens.md) · [069](../tickets/069-site-scaffold-theme.md) · [070](../tickets/070-site-components-stories.md) · [071](../tickets/071-site-landing-page.md) · [072](../tickets/072-site-docs-content.md) · [073](../tickets/073-site-learn.md) · [074](../tickets/074-site-generated-reference.md) · [075](../tickets/075-site-deploy.md)
