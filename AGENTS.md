# AGENTS.md — design-token-authority (DTA)

Instructions for coding agents. Keep this file short: details live in the linked docs.

## What DTA is

A CLI (`npx dta`) that syncs design tokens between Figma and DTCG files, builds outputs (CSS, JS, Tailwind, Swift, Android), checks tokens and shows token changes in pull requests (`dta diff`).

**DTA does not dictate structure or naming.** It takes whatever collections, modes and axes a team has and derives its checks from them. Never hard-code a layer, collection or mode name (the fixtures' Primitives → Brand → ScreenType is one example).

## Where things are

- Packages, rules, tests, releases: [Contribute](site/src/content/docs/contribute/index.mdx)
- Token model and formats: [core-token-model spec](docs/specs/core-token-model.md), [DTCG 2025.10 spec](docs/specs/dtcg-2025-10.md), [Token files reference](site/src/content/docs/reference/token-files.mdx)
- Commands: `pnpm dta --help`; Figma plans and `--from-file`: [Figma guide](site/src/content/docs/guides/figma.mdx)
- Website UI: [Design system](site/src/content/docs/design-system/index.mdx)
- Decisions: `docs/adr/`, `docs/specs/`; work: `docs/tickets/000-index.md`

## Rules

- **Tickets and specs first.** Every change starts from a ticket in `docs/tickets/`; bigger work gets a spec first. One ticket at a time; when done, update its `**Status:**` line and its index row.
- **No new features for now** (October 2026). Ask the maintainer before starting anything that has no ticket.
- **Never commit or push without the maintainer's explicit go-ahead.**
- **Package boundaries:** import packages by name (`@dta/core`), never by path; `@dta/core` depends on no other `@dta/*` package. Only `@dta/cli` is user-facing.
- **Validate data at boundaries** (Figma responses, token files, config) with Zod before use.
- **Figma safety:** push never deletes (that is `dta prune`); variable names are unique across collections.
- **Values:** use `formatValue` / `sameValue` from `@dta/core`, never `String(value)` or `===`.
- **TypeScript:** strict, no `any`, `.js` extensions in imports, Prettier (no semicolons, single quotes, 100 chars).
- **Website UI** uses only `site/tokens` and the components in `site/src/components/ds`. Anything new becomes a design-system component first, with a docs page and a story.
- **Docs:** update the website docs with every user-visible change. Reference pages, schemas and `llms.txt` are generated from `--help` and the config schema: change the code, never the generated files.
- **Names:** no real customer brand names (use BrandA/BrandB); say "snapshot", not "golden".

## Tests and gates

Test each package through its public API (`*.test.ts` next to the source). A failing CLI snapshot means the output changed: fix the code, or re-record that one scenario on purpose with `pnpm snapshot:record --scenario <fixture>/<scenario>`, never to make it pass. Figma is faked from `test/recordings/`.

Every ticket passes the CI gates:

```bash
pnpm run prettier:check
pnpm run typecheck
pnpm run guardrails:boundaries
pnpm test
pnpm run snapshot:check
```
