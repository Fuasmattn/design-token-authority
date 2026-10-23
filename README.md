# Design Token Authority

The deterministic backbone for design token workflows, built for humans and agents.

DTA reads your design tokens as plain [DTCG](https://tr.designtokens.org/format/) JSON files (pulled from Figma or written by hand), checks their structure, builds them into CSS, JavaScript and Tailwind, and shows what a change does to your UI before it ships: base and head rendered, compared and explained by the token that caused each difference. Same input, same result, on your machine, in CI or when an agent runs it.

> **Status:** not on npm yet. `npx dta` would run an unrelated package with the same name. Until the first release, run DTA from a clone (below).

## Quick start

Node.js 24 or newer and pnpm:

```sh
git clone https://github.com/Fuasmattn/design-token-authority.git
cd design-token-authority && pnpm install
alias dta="node $PWD/bin/dta.js"
```

Then, in your project:

```sh
dta init     # writes dta.config.ts, then sets up dta diff (run again to update it)
dta pull     # Figma variables → tokens/ (Enterprise; otherwise: dta pull --from-file <export.json>)
dta build    # tokens/ → output/css, output/js, output/tailwind
dta lint     # structure checks; exits 2 on errors
dta diff     # token changes against the merge base with main, and screenshots explained by token
```

The config `dta init` writes imports `defineConfig` from `design-token-authority`; until the release, drop the import and export the object directly.

## Commands

| Command       | What it does                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `dta init`    | Wizard that writes `dta.config.ts` and sets up `dta diff`; with a config, sets up or updates `dta diff` |
| `dta pull`    | Figma → token files (REST API on Enterprise, `--from-file` with a plugin export)                        |
| `dta push`    | Token files → Figma; dry run, typed confirmation, never deletes                                         |
| `dta build`   | CSS custom properties, JavaScript, Tailwind v3 and v4, one theme per brand                              |
| `dta lint`    | Dangling and circular aliases, default mode names, configurable rules                                   |
| `dta graph`   | Alias graph: console, Markdown, DOT or interactive HTML                                                 |
| `dta diff`    | Token changes against a base; stories rendered at base and head, explained by token                     |
| `dta analyze` | Which role each Figma collection plays                                                                  |
| `dta clean`   | Removes token files and build output                                                                    |

## Documentation

The website in `site/` holds the docs (`pnpm site:dev`):

- [What DTA is](site/src/content/docs/start/index.mdx), [Quick start](site/src/content/docs/start/quick-start.mdx), [Core concepts](site/src/content/docs/start/concepts.mdx)
- Guides: [Figma](site/src/content/docs/guides/figma.mdx), [Brands and themes](site/src/content/docs/guides/brands-and-themes.mdx), [Tailwind](site/src/content/docs/guides/tailwind.mdx), [CI](site/src/content/docs/guides/ci.mdx), [dta diff in pull requests](site/src/content/docs/guides/dta-diff-in-pull-requests.mdx), [dta diff with Storybook](site/src/content/docs/guides/dta-diff-with-storybook.mdx), [Migrating from v1](site/src/content/docs/guides/migrate-from-v1.mdx)
- Reference: [Token files](site/src/content/docs/reference/token-files.mdx), [Outputs](site/src/content/docs/reference/outputs.mdx), [Lint rules](site/src/content/docs/reference/lint-rules.mdx), [Exit codes](site/src/content/docs/reference/exit-codes.mdx)
- [Contribute](site/src/content/docs/contribute/index.mdx): architecture, package boundaries, tests, specs and tickets

## License

MIT
