# TICKET-044: Figma: package scaffold, validated HTTP client

**Phase:** 8 — Token Engine Overhaul, Epic 3 (@dta/figma)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-033, TICKET-037
**Status:** ready-for-agent
**Spec:** [figma-package](../specs/figma-package.md)

## What to build

Create `packages/figma` (`@dta/figma`, private, depends on `@dta/core` and `zod`) with a small Figma Variables client that can talk to the real API or the fake, and that validates what it receives.

## Acceptance Criteria

- [ ] `createFigmaClient({ token, baseUrl? })` with `getLocalVariables(fileKey)` and `postVariables(fileKey, payload)` using built-in `fetch`; default base URL `https://api.figma.com`; sends `X-Figma-Token`
- [ ] Tested against `startFigmaFake` (from `@dta/testkit`, dev dependency) over real HTTP: GET returns the recording, POST payload is recorded by the fake and the response is returned
- [ ] Non-2xx responses reject with `FigmaApiError` carrying status and Figma's message (403 and 404 covered); network failure rejects with a clear error; the token never appears in any error message
- [ ] Zod schemas for the local-variables response (the fields the package reads: collections, modes, variables, value shapes, aliases, metadata) and for the POST response; unknown extra fields are allowed; types are derived from the schemas and stay compatible with `@figma/rest-api-spec`
- [ ] `parseVariablesResponse(unknown)` returns the validated response or throws `FigmaApiError` with code `invalid-response` listing the failing paths; `getLocalVariables` uses it, so a malformed response (missing `meta`, wrong value shape, wrong type) is rejected with a clear message instead of failing later
- [ ] The committed recording validates against the schema
- [ ] Types come from `@figma/rest-api-spec`; the package index exports a small surface; boundary check passes
- [ ] 039 parity table: `figma_api.ts` row added/updated
- [ ] All gates pass, and the GitHub run is green
