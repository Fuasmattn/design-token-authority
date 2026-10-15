# Spec: @dta/figma — everything that touches Figma or a Figma export

**Status:** ready-for-agent
**Part of:** [Token Engine Overhaul](./token-engine-overhaul.md), Epic 3
**Depends on:** [@dta/core](./core-token-model.md) (Epic 2)
**Related:** ADR 0001, TICKET-039 (parity table), TICKET-037 (Figma fake)

## Problem

In legacy, Figma knowledge is spread over `figma_api.ts` (hardcoded `https://api.figma.com`, axios), `token_export.ts`, `token_import.ts` (payload generation mixed with file reading and alias handling), `importers/*`, `analyze.ts` and parts of the `pull`/`push` commands (diffing, confirmation, linting, printing). Conversion logic cannot be tested without files or network, nothing validates what Figma or a plugin actually sends (the types are compile-time only), and the `Token`/`TokensFile` shapes leak everywhere.

## Solution

`@dta/figma` owns the Figma boundary and nothing else: a small HTTP client, **runtime validation of everything that comes back from Figma or a Figma plugin**, conversion between the Figma Variables API shapes and the `@dta/core` token model, push planning (model + Figma state → payload + structured change list) and plugin-export importers. Conversions are pure functions over plain data. Interpreting a token model (for example which collection is the primitives layer) is not Figma knowledge and lives in core. Prompts, confirmation, file reading/writing, diff formatting and linting stay in `@dta/cli`.

## Decisions

1. **Scope.** `@dta/figma` = client, boundary validation, export (Figma → model), push planning, plugin importers with format detection. Structure analysis is not here (decision 12). Report/diff formatting, confirmation, lint gating and file I/O are CLI.
2. **Dependencies.** Depends on `@dta/core`, `zod` and the types in `@figma/rest-api-spec`; never on `@dta/cli`. Core stays free of Figma types.
3. **Validate at the boundary (Zod).** Data from outside is untrusted. Every Figma API response and every plugin export is parsed with a Zod schema before anything else touches it. `@figma/rest-api-spec` only gives compile-time types, so the package defines runtime schemas for the parts it reads (strict about the fields it relies on, lenient about unknown extra fields) and derives its types from them. A response that fails validation is a typed `FigmaApiError` with code `invalid-response` and the failing paths; a plugin export that fails is a diagnostic. `parseVariablesResponse(unknown)` is the public entry for raw data; conversion functions take the validated type. Inside the process, packages trust each other's TypeScript types. Data is validated where it enters from outside or from a serialized form (files, JSON, later an MCP server or a cache), not on every in-process call.
4. **Client.** `createFigmaClient({ token, baseUrl? })` with `getLocalVariables(fileKey)` (validated) and `postVariables(fileKey, payload)`, using Node's built-in `fetch` (no axios). `baseUrl` defaults to `https://api.figma.com` and can point at the fake in tests, so the new code needs no preload hack. HTTP failures reject with a typed `FigmaApiError` (status, code, Figma message); the token never appears in errors or logs. Network I/O is the one place exceptions are acceptable.
5. **Everything else returns diagnostics**, like core: conversions return data plus `Diagnostic[]` (unresolvable alias, unsupported variable type, duplicate names, unknown alias target).
6. **Export keeps Figma's order.** `variablesToModel` builds the model directly from the validated response, so collection and mode order follow Figma (core's file parser sorts by name). Remote variables are skipped, as in legacy. The output file shape stays the legacy one (`$description` always written, `com.figma` with `hiddenFromPublishing`, `scopes`, `codeSyntax`) so existing token repos do not churn.
7. **Existing files are preserved.** `variablesToModel(response, { existing })` reuses the `sources` of an existing model so untouched files serialize byte-identical (the core round-trip guarantee), while changed values update in place.
8. **Push is planned, not performed.** `planPush(model, response)` returns `{ payload, changes, diagnostics }`. `changes` is structured data (create collection/mode/variable, update value, update metadata) that the CLI formats as the human diff (TICKET-020 behaviour). An unchanged model yields no changes and no payload. The CLI decides whether to send.
9. **Push never deletes** (existing invariant), tested as a property: the payload contains only create and update operations, even when Figma has variables the model lacks.
10. **Names are unique across collections** (existing invariant). Duplicate names are an error diagnostic from `planPush` (using core's `checkUniqueNames`) instead of silently picking one. Colors compare approximately (hex equality via core) so float noise does not cause spurious updates.
11. **Where the file comes from is the user's problem; DTA defines what it accepts.** DTA does not depend on any community plugin. Its contract is the documented one-file-per-mode DTCG format (`{Collection}.{Mode}.json`, `com.figma` extensions), validated on entry (`parseTokenFiles` in core). A JSON Schema generated from the Zod schema is published so anyone can write or adapt an exporter, and the docs list ways to get the data (Enterprise REST API, a plugin of the user's choice plus a converter, Figma's native DTCG export once available: TICKET-032) as guidance, not as supported dependencies. Third-party export formats are handled by small, isolated **adapters** behind one function (`importPluginExport`), each best effort, covered by fixture tests, and removable without touching the rest. The tokenHaus adapter is kept only for parity with legacy until TICKET-039 decides whether it stays.
12. **Structure analysis moves to core and works on the model.** Legacy has two analyses (`analyze.ts` on the Figma response, `importers/analyze-tokens.ts` on token files) that infer layer roles from collections and modes. That is interpretation of tokens, not Figma I/O. As `analyzeStructure(model)` in `@dta/core` it works for Figma API data, plugin imports and plain token files alike (so `dta analyze` also works on non-Enterprise plans), and replaces both legacy versions.
13. **Testing seam.** The package is tested through its public API: client against `startFigmaFake` (real HTTP on localhost), including malformed responses; conversions against `test/recordings/brand-ab/variables-local.json` and the fixtures; and the pull/push roundtrip proven for legacy in TICKET-037 is repeated for the new package.

## Public API sketch (names may change in the tickets)

- `createFigmaClient`, `FigmaApiError`, `parseVariablesResponse`
- `variablesToModel(response, options?)` → `{ model, diagnostics }`
- `planPush(model, response)` → `{ payload, changes, diagnostics }`
- `importPluginExport(json)` → `{ format, model, diagnostics }`, `detectFormat(json)`
- In `@dta/core`: `analyzeStructure(model)` → structure data

## Out of scope

CLI commands and prompts (Epic 6), diff/report formatting, lint, writing token files, Figma's native DTCG export (TICKET-032), prune/delete (TICKET-021), migrating core's hand-written file validation to Zod (it produces precise diagnostics today; a Zod schema for the model can be added when something deserializes it).

## Tickets

[044](../tickets/044-figma-client.md) · [045](../tickets/045-figma-export.md) · [046](../tickets/046-figma-push-planning.md) · [047](../tickets/047-figma-plugin-importers.md) · [048](../tickets/048-core-structure-analysis.md)
