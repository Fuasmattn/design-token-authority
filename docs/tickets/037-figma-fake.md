# TICKET-037: Figma API fake with recorded responses

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** Medium
**Effort:** M
**Blocked by:** TICKET-033, TICKET-034
**Status:** done (in review)
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A fake Figma Variables API that replays recorded responses for the fixture projects, so pull and push can be tested in CI without secrets or an Enterprise plan. Push is verified by asserting the request payload the fake receives.

## Acceptance Criteria

- [x] Recorded responses exist for the BrandA/BrandB fixture (GET local variables)
- [x] Legacy `pull` against the fake produces the fixture's token files
- [x] Legacy `push` against the fake records a payload that can be asserted in tests
- [x] Recordings contain no real file keys, tokens or customer names
- [x] CI uses only the fake; a documented manual smoke test covers real Figma before release

## Implementation notes

- `startFigmaFake` (`@dta/testkit`) serves recorded `GET /v1/files/:key/variables/local` responses and records `POST /v1/files/:key/variables` payloads in `fake.requests`.
- The legacy client hardcodes `https://api.figma.com` and is frozen, so `captureScenario({ figmaApiUrl })` preloads `figma-redirect.mjs` (via `NODE_OPTIONS --import`) to route that host to the fake, and drops proxy environment variables for that run. `captureScenario` is now async.
- The recording is synthesized from the fixture token files (no real Figma file is involved): `pnpm figma:recording` regenerates `test/recordings/brand-ab/variables-local.json` with the fake file key `TESTFILEKEY-brand-ab`.
- `packages/testkit/test/legacy-roundtrip.test.ts` proves it faithful with the legacy CLI: `pull` reproduces the fixture (ignoring the empty `$description` legacy always writes), `push` of unchanged tokens sends nothing, and `push` of one edited token sends exactly one `variableModeValues` entry. Legacy omits the alpha channel when it is 1.
- Manual smoke test against real Figma: [docs/testing/figma-smoke-test.md](../testing/figma-smoke-test.md).
- Pull/push are not part of the CLI snapshot scenarios yet; that belongs to the figma epic.
