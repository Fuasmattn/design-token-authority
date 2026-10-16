# @dta/docs

Generates the token documentation page: one self-contained HTML file with colour swatches, typography, spacing and effects previews, a searchable table of all tokens, alias chains and a brand switcher. Pure: token files in, HTML string out.

```ts
import { generateDocsHtml } from '@dta/docs'

const html = generateDocsHtml(tokenFiles, ['BrandA', 'BrandB']) // [{ fileName, content }], brand modes
```

This is a straight port of the v1 generator (output is byte-identical to the recorded `build` snapshots). The redesign belongs to the docs site epic. Files that are not valid JSON are skipped; validate with `@dta/core` first to report them.
