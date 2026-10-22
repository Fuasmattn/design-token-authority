# TICKET-132: All DTCG 2025.10 types and structured values in core

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** —
**Status:** open
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

- [ ] Package tests per type: valid values from the report's examples, and one invalid value per rule
- [ ] Group `$type`, `$deprecated` and the name rules tested
- [ ] Existing snapshots unchanged
- [ ] JSON Schema (`tokenFileSchema`) and the Token files reference list the new types
- [ ] All gates pass, and the GitHub run is green
