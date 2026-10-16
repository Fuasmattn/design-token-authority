# @dta/build

Turns a `@dta/core` token model into output files: CSS variables, a JS colour palette and Tailwind v3/v4 files. Pure and in memory: nothing is read or written, the caller writes the returned files. Spec: [docs/specs/build-package.md](../../docs/specs/build-package.md).

```ts
import { parseTokenFiles } from '@dta/core'
import { buildOutputs } from '@dta/build'

const { model } = parseTokenFiles(tokenFiles)
const { files, diagnostics } = await buildOutputs(model, { brands: ['BrandA', 'BrandB'] })
// files: [{ path: 'output/css/base.css', content: '…' }, …], sorted by path
```

## Options

| Option            | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `brands`          | Modes of the multi-mode collections to build themes for (default: none) |
| `collections`     | Only build from these collections (default: all)                        |
| `css.outDir`      | CSS directory (default `output/css`)                                    |
| `tailwind.outDir` | Tailwind directory (default `output/tailwind`)                          |

The JS palette is always `output/js/colorpalette.js` (same as the legacy build).

## Files

- `base.css`, `variables.css`, `colorpalette.js`, `tailwind.css`, `tailwind.tokens.ts` from the single-mode collections.
- Per brand: `themes/<brand>.css` and `<brand>/tailwind.css`, `<brand>/tailwind.tokens.ts` in the Tailwind directory.

## Contract

- **Parity:** for both fixtures the files are byte-identical to the legacy `build` snapshots in `test/snapshots/*/build/files/output/{css,js,tailwind}`. The docs HTML (`output/docs`) is not part of this package; the docs site is Epic 7.
- **Deterministic:** the same model gives the same files in the same order.
- **No throwing for data problems:** diagnostics with codes `broken-reference`, `unknown-brand`, `unknown-collection`, `invalid-option` (all warnings).
- Known output quirks of the legacy build are kept on purpose and listed in TICKET-039.
