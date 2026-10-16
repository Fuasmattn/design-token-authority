# DTA website

The Design Token Authority website (spec: [docs/specs/docs-site.md](../docs/specs/docs-site.md)). Astro + Starlight arrive with TICKET-069; for now this folder holds the site's design tokens.

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
