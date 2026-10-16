# DTA website

The Design Token Authority website (spec: [docs/specs/docs-site.md](../docs/specs/docs-site.md)): Astro + Starlight, static, no tracking.

```bash
pnpm site:dev     # from the repo root: dta build on site/tokens, then astro dev
pnpm site:build   # dta build, astro build, internal link check (CI runs this)
```

## Theme

- `src/styles/theme.css` maps Starlight's variables onto the semantic token variables only (a test fails on raw colours). Asides follow the system: note → action, tip → success, caution and danger → signal; no shadows.
- Starlight's theme switch sets `data-theme`; `src/components/ThemeProvider.astro` mirrors it to `data-brand` (`light` / `graphite`), which selects DTA's theme CSS.
- Fonts are self-hosted from `@fontsource-variable` under the family names the tokens use (`src/styles/fonts.css`); nothing is loaded from Google.

## Design tokens

`tokens/` is the **DTA Drafting Table** design system as DTA token files, the first real token set DTA builds besides the test fixtures:

| File                                      | Content                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Primitives.Value.json`                   | colour scales (`paper`, `ink`, `graphite`, `blueprint`, `redline`, `sage`), `space`, `radius`, `stroke`, `font` families and the `type` scale |
| `Theme.Light.json`, `Theme.Graphite.json` | semantic colours (`bg-*`, `fg-*`, `border-*`, `action-*`, `signal-*`, `success-*`, `rail`, `terminal-*`), all aliases into the primitives     |

```bash
pnpm --filter dta-site tokens   # dta build → output/css/base.css, themes/light.css, themes/graphite.css
```

The theme files set the semantic variables under `[data-brand="light"]` and `[data-brand="graphite"]`.

Known limitations, both from DTA's current model:

- The themes use DTA's brand layer (one mode per theme). User-defined structure (DTCG resolver modifiers such as `theme`) is a later epic; the site migrates then.
- Font sizes are unitless in the CSS (`--type-body-size: 17`), as DTA only adds `px` to spacing, sizes, radii, strokes and effects; the site multiplies with `1px`.

The design reference stays the design system on claude.ai ("DTA Drafting Table"); from now on these files are the source of truth for the site, and changes to them are reviewed like any token change.

## Design system section and stories

- `src/components/ds/` — the DTA Drafting Table components (Astro, token variables only; a test fails on colour literals and drop shadows).
- `src/examples/stories.ts` — every story once (component, variant, example file, viewports). The docs pages (`src/content/docs/design-system/`) render them in Light and Graphite, `/stories/<component>/<variant>/` renders each alone without site chrome, and `/stories/manifest.json` (`dta.stories/1`) lists them for `dta diff`.
- `src/lib/design-tokens.ts` — the token pages read `site/tokens` through `@dta/core`; swatches use the built CSS variables.
- Adding a story: write `src/examples/<Name>.astro`, add an entry to `stories.ts`, reference it from the component's docs page via `<Examples component="…" />`.
