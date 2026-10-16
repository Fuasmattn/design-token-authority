# Figma recordings

Responses of `GET /v1/files/:key/variables/local` for the fake Figma API (`startFigmaFake` in `@dta/testkit`).

- `<fixture>/variables-local.json` is synthesized from the fixture's tokens by `pnpm figma:recording`, so pulling it reproduces the tokens and pushing the tokens changes nothing.
- `brand-ab/variables-local.drifted.json` is the same file after someone changed Figma: `Colors/Foundation/Blue/500` has another red value, `Dimensions/spacing/2` is 10 instead of 8, and `Dimensions/radius/pill` is missing. Pushing the fixture's tokens against it shows modified and added variables.
