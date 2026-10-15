# TICKET-037: Figma API fake with recorded responses

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** Medium
**Effort:** M
**Blocked by:** TICKET-033, TICKET-034
**Status:** ready-for-agent
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

A fake Figma Variables API that replays recorded responses for the fixture projects, so pull and push can be tested in CI without secrets or an Enterprise plan. Push is verified by asserting the request payload the fake receives.

## Acceptance Criteria

- [ ] Recorded responses exist for the BrandA/BrandB fixture (GET local variables)
- [ ] Legacy `pull` against the fake produces the fixture's token files
- [ ] Legacy `push` against the fake records a payload that can be asserted in tests
- [ ] Recordings contain no real file keys, tokens or customer names
- [ ] CI uses only the fake; a documented manual smoke test covers real Figma before release
