# TICKET-044: Figma: package scaffold, validated HTTP client

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033, TICKET-037
**Status:** done
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

Create `packages/figma` (`@dta/figma`, private, depends on `@dta/core` and `zod`) with a small Figma Variables client that can talk to the real API or the fake, and that validates what it receives.

## Acceptance Criteria

- [x] `createFigmaClient({ token, baseUrl? })` with `getLocalVariables(fileKey)` and `postVariables(fileKey, payload)` using built-in `fetch`; default base URL `https://api.figma.com`; sends `X-Figma-Token`
- [x] Tested against `startFigmaFake` (from `@dta/testkit`, dev dependency) over real HTTP: GET returns the recording, POST payload is recorded by the fake and the response is returned
- [x] Non-2xx responses reject with `FigmaApiError` carrying status and Figma's message (403 and 404 covered); network failure rejects with a clear error; the token never appears in any error message
- [x] Zod schemas for the local-variables response (the fields the package reads: collections, modes, variables, value shapes, aliases, metadata) and for the POST response; unknown extra fields are allowed; types are derived from the schemas and stay compatible with `@figma/rest-api-spec`
- [x] `parseVariablesResponse(unknown)` returns the validated response or throws `FigmaApiError` with code `invalid-response` listing the failing paths; `getLocalVariables` uses it, so a malformed response (missing `meta`, wrong value shape, wrong type) is rejected with a clear message instead of failing later
- [x] The committed recording validates against the schema
- [x] Types come from `@figma/rest-api-spec`; the package index exports a small surface; boundary check passes
- [x] 039 parity table: `figma_api.ts` row added/updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/figma/src/{schemas,errors,client,index}.ts`. Public API: `createFigmaClient`, `parseVariablesResponse`, `FigmaApiError`, and the schema-derived types `LocalVariablesResponse`, `LocalVariable`, `LocalVariableCollection`, `PostVariablesResult`.
- Schemas read only the fields DTA uses; unknown fields are dropped. A compile-time assignment in the tests proves the official `GetLocalVariablesResponse` type is accepted by the derived type.
- Error codes: `http-error` (with `status`), `network-error`, `invalid-response` (with `issues`: dot path + message). Messages never contain the token (tested for 403 and network failure).
- `fetch` is injectable (`options.fetch`) and `baseUrl` defaults to `https://api.figma.com`, so tests talk real HTTP to `startFigmaFake`, no preload hack.
- The committed `brand-ab` recording validates.
- Request payloads for `postVariables` are typed with the official `PostVariablesRequestBody` (we build them ourselves, so they are trusted); the response is validated.
- 039 parity table: `figma_api.ts` row now points to this package.
