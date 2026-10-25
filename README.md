# Design Token Authority

The deterministic backbone for design token workflows, built for humans and agents.

DTA reads your design tokens as plain [DTCG](https://tr.designtokens.org/format/) JSON files (pulled from Figma or written by hand), checks their structure, builds them into CSS, JavaScript and Tailwind, and shows what a change does to your UI before it ships: base and head rendered, compared and explained by the token that caused each difference. Same input, same result, on your machine, in CI or when an agent runs it.

## Quick start

Node.js 24.22.1 or newer. In your project:

```sh
npm create dta                        # installs design-token-authority, then dta init
npx design-token-authority pull       # Figma variables → tokens/ (Enterprise; otherwise: pull --from-file <export.json>)
npx design-token-authority build      # tokens/ → output/css, output/js, output/tailwind
npx design-token-authority lint       # structure checks; exits 2 on errors
npx design-token-authority diff       # token changes against the merge base with main, and screenshots explained by token
```

Once installed, `dta` is the short name in package scripts and `npx dta` finds it. Never run `npx dta` in a project without DTA installed: the npm name `dta` belongs to an unrelated package.

## Commands

| Command       | What it does                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `dta init`    | Wizard that writes `dta.config.ts` and sets up `dta diff`; with a config, sets up or updates `dta diff`                |
| `dta pull`    | Figma → token files (REST API on Enterprise, `--from-file` with a plugin export)                                       |
| `dta push`    | Token files → Figma; dry run, typed confirmation, never deletes                                                        |
| `dta prune`   | Figma variables without a token → deleted, after a dry run or a typed confirmation                                     |
| `dta build`   | CSS custom properties, JavaScript, Tailwind v3 and v4, one theme per brand; Swift, Android XML and Compose when chosen |
| `dta lint`    | Dangling and circular aliases, default mode names, configurable rules                                                  |
| `dta graph`   | Alias graph: console, Markdown, DOT or interactive HTML                                                                |
| `dta diff`    | Token changes against a base; stories rendered at base and head, explained by token                                    |
| `dta analyze` | Which role each Figma collection plays                                                                                 |
| `dta clean`   | Removes token files and build output                                                                                   |

## Documentation

The docs are on the website, **[dta.martinprinz.dev](https://dta.martinprinz.dev)**; its source is in `site/` (`pnpm site:dev`):

- [What DTA is](site/src/content/docs/start/index.mdx), [Quick start](site/src/content/docs/start/quick-start.mdx), [Core concepts](site/src/content/docs/start/concepts.mdx)
- Guides: [Figma](site/src/content/docs/guides/figma.mdx), [Brands and themes](site/src/content/docs/guides/brands-and-themes.mdx), [Tailwind](site/src/content/docs/guides/tailwind.mdx), [CI](site/src/content/docs/guides/ci.mdx), [dta diff in pull requests](site/src/content/docs/guides/dta-diff-in-pull-requests.mdx), [dta diff with Storybook](site/src/content/docs/guides/dta-diff-with-storybook.mdx)
- Reference: [Token files](site/src/content/docs/reference/token-files.mdx), [Outputs](site/src/content/docs/reference/outputs.mdx), [Lint rules](site/src/content/docs/reference/lint-rules.mdx), [Exit codes](site/src/content/docs/reference/exit-codes.mdx)
- [Contribute](site/src/content/docs/contribute/index.mdx): architecture, package boundaries, tests, specs and tickets

## License

MIT
