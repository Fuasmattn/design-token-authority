# Manual Figma smoke test

CI never talks to real Figma: it uses the fake in `@dta/testkit` with the recording in
`test/recordings/`. Before each release, run this once against a real file to catch drift
between the recording and the live API.

Requires a Figma **Enterprise** plan (Variables REST API) and a throwaway test file.

1. Create a Figma file with three collections: `Primitives` (mode `Value`), `Brand(Alias)`
   (`BrandA`, `BrandB`) and `ScreenType` (`Desktop`, `Tablet`, `Mobile`). Importing
   `test/fixtures/brand-ab/tokens` with `dta push` into an empty file is the quickest way.
2. In a scratch directory create `.env` with `FIGMA_PERSONAL_ACCESS_TOKEN` and
   `FIGMA_FILE_KEY` (never commit these) and a `dta.config.ts` with `figma.source: 'api'`.
3. `dta pull` — token files appear and match the fixture (ignoring empty `$description`).
4. Change one color in Figma, `dta pull` — only that token changes.
5. Edit the same token locally, `dta push` — the diff shows one change; confirm; check Figma.
6. `dta push` again — "nothing to change".
7. Compare a fresh `GET /v1/files/:key/variables/local` response with
   `test/recordings/brand-ab/variables-local.json`. If the shape differs, update
   `scripts/figma/build-recording.ts` and run `pnpm figma:recording`.

Record the date and result in the release PR.
