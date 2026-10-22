# TICKET-136: Resolver documents

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** 133, 135
**Status:** done
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 7, 12; slice 5)

## What to build

- Reader for `*.resolver.json` (version `2025.10`): `sets`, `modifiers` (`contexts`, `default`), `resolutionOrder` with `$ref` to root sets and modifiers or inline items (`name`, `type`); sources as inline tokens or `$ref` to files relative to the resolver; sibling keys next to `$ref` replace shallowly; `$defs` ignored.
- Validation with the report's error list (missing `resolutionOrder`, zero contexts, `default` not a context, modifier referenced from a set or modifier, pointer into `resolutionOrder`, unresolvable or circular references).
- Mapping onto the model: sets → single-mode collections, modifiers → multi-mode collections with one mode per context and `default` as default mode; overridden tokens move into the modifier's collection with a value per context.
- Inputs: `brands` selects the brand modifier's contexts; a new `modifiers` config key selects others; unknown keys, unknown contexts and missing required modifiers are errors.
- Discovery: exactly one `*.resolver.json` in `tokens.dir` is used automatically, `tokens.resolver` in the config wins, several without it are an error listing them; files outside the resolver's sets are a warning.
- Until TICKET-137: a token overridden by two modifiers is a clear error naming both.

## Acceptance criteria

- [x] Package tests for every error condition and for the report's example resolver
- [x] A resolver fixture with one modifier: `lint`, `build`, `graph`, `token get` recorded by name
- [x] Config reference generated with the new keys
- [x] All gates pass, and the GitHub run is green

## Notes

Decisions made while building it, for review:

- **Where it plugs in:** `parseTokenFiles(files, options)` reads a resolver document when there is one among the files, so every command (lint, build, graph, token, audit, context, push, diff and its base) gets it without its own code. `readTokenDir` and the `dta diff` base reader return `*.resolver.json` and, when there is one, the files in folders below (`sets/color.json`), since the document may name them. Without a resolver document nothing changes (folders stay unread, as before).
- **Mapping** (`resolver.ts`): every context of every modifier is flattened with the other modifiers at their default; a token whose value differs between a modifier's contexts goes into that modifier's collection, every other token into the last set that defines it (a token a group inherits through `$extends` goes to the set holding its nearest group). The parser then reads one generated tree per collection and mode, so diagnostics name them like `app.resolver.json#modifiers/theme/dark`.
- **`Collection.defaultMode`** (new, optional): a modifier's `default`, or the context `modifiers` in the config names. `resolve`, the graph and the build read it where they used the first mode.
- **Config:** `tokens.resolver` (which document, when there are several) and `modifiers` (`{ theme: 'dark' }`); both validated (an unknown modifier or context is an error).
- **One deviation from the report:** it says a tool should error when a modifier has no `default` and no input is given. DTA builds every context anyway (that is what the modes are for), so it warns (`resolver-default`) and reads the first context where one is needed.
- **Until TICKET-137:** a token two modifiers change is `resolver-several-modifiers`. A modifier's contexts become theme files through `brands` (`brands: ['light', 'dark']`), so a theme is still selected with `data-brand`; TICKET-137 gives each modifier its own attribute. (Done in TICKET-137: the error is gone.)
- **Build fix found here:** the theme files repeat tokens that reach the brand through single-mode tokens (TICKET-093); that now follows every reference inside a composite too, so a component shadow coloured by a theme token follows the theme.
- **Not covered:** `dta pull` into a folder that has a resolver document still writes per-mode files; the playground reads a resolver document only together with the files it names, dropped next to it (folders are lost on drop).
- **Fixture `dtcg-resolver`** with all generic scenarios plus `token-get-resolver`, each recorded by name.
- **Budgets:** `@dta/core` grew to 45.9 KB minified, the playground's analysis chunk to 46.5 KB gzip and its Outputs chunk to 631.4 KB gzip (Style Dictionary 5, TICKET-134); the budgets in `site/browser-packages.test.ts` and `site/playground.e2e.test.ts` are now 50 KB, 50 KB and 635 KB (measured, rounded up to the next 5 KB as before). The first load is unchanged at 22.1 KB.
