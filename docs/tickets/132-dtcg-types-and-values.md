# TICKET-132: All DTCG 2025.10 types and structured values in core

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** —
**Status:** in review
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 2, 3, 4; slice 1)

## What to build

`@dta/core` reads every type of the 2025.10 Format and Color modules and stores values as written, typed.

- `TokenType` covers `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, plus `string` and `boolean` (kept for Figma variables).
- `TokenValue` becomes a union per type: the colour object (`colorSpace`, `components` with `"none"`, `alpha`, `hex`) next to the hex string DTA writes today, `{ value, unit }` for `dimension` (`px`, `rem`) and `duration` (`ms`, `s`), and the composite objects and arrays.
- Validation per type with `invalid-value` messages that name the rule (for example "hue must be below 360").
- Group `$type` inheritance and `$deprecated` (token and group, `false` overrides).
- Name rules: no `{`, `}` or `.`, not starting with `$`; an object with `$value` and children is an error.
- An unknown `$type` is an error (no longer an `unsupported-type` warning).
- `formatValue` and `sameValue` exported from core; every consumer that used `String(value)` or `===` on values switches to them, so nothing prints `[object Object]`.
- Check whether Style Dictionary 4 accepts 2025.10 value objects or needs an upgrade; note the result here.

## Acceptance criteria

- [x] Package tests per type: valid values from the report's examples, and one invalid value per rule
- [x] Group `$type`, `$deprecated` and the name rules tested
- [x] Existing snapshots unchanged
- [x] JSON Schema (`tokenFileSchema`) and the Token files reference list the new types
- [ ] All gates pass, and the GitHub run is green

## Notes

Decisions made while building it, for review:

- **Dots in names are a warning, not an error** (`name-with-dot`). DTCG forbids them, but DTA has always resolved dotted segments (`{size.4.5}`, a resolve test protects it) and scales like `0.5` are common in Figma; an error would break real files. `{` and `}` are errors (`invalid-name`), since they break aliases.
- **The four Figma types stay lenient:** `string`, `boolean`, `number` (and `color` as a string) accept any scalar, as before. The daisyUI export has `boolean` tokens with string values; an error there would break existing projects. The DTCG types are validated strictly.
- **Draft strings are read:** `"4px"` / `"0.5rem"` for `dimension` and `"200ms"` / `"0.2s"` for `duration`, as earlier DTCG drafts and many tools write them; `sameValue` treats them like their object form.
- **An alias without `$type`** (none on the token or a group) gets the type of its target after all files are read, across collections; a target that gives none is `missing-type`.
- **Unknown `$type` is an error** (`unknown-type`), on tokens and groups; `unsupported-type` is gone.
- **`$ref` objects are rejected** with "references with $ref are not supported yet" until TICKET-133.
- **Build until TICKET-134:** colour objects are written as CSS text (hex for sRGB, else `oklch()`, `color(display-p3 …)`, matching spec decision 10); the other new types are left out with one `not-built-yet` warning instead of `[object Object]`.
- **Push until TICKET-138:** types Figma variables cannot hold are skipped with one `not-pushable` warning per token.
- **Lint until TICKET-134:** contrast reads sRGB colour objects and objects with a `hex`; other colour spaces are skipped with a warning that says so. `rgb()` strings work as before.
- **`dta diff` result.json:** the value schema accepts objects and lists (additive); `docs/diff/result.schema.json` regenerated.
- **Style Dictionary:** 4.4 writes `[object Object]` for 2025.10 colour objects and `{ value, unit }`. 5.7 (current) formats all of them, including the composite shorthands, but its `color/css` turns `oklch` into hex, so TICKET-134 upgrades to 5.x and keeps colour spaces with its own colour transform.
