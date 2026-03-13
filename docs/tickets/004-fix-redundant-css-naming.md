# TICKET-004: Fix redundant segment repetition in generated CSS variable names

**Status:** ✅ Done — commit `91d5f3e`
**Phase:** 1 — Foundation (Bug Fix)
**Priority:** Medium
**Effort:** S

## Summary

Several generated CSS variables repeat the same word because Figma group names and variable names overlap. This should be cleaned up either at the Figma naming level or via a custom Style Dictionary name transform.

## Background

Current output examples:
```css
--effects-blur-blur-3xl: 64px;      /* "blur" repeated */
--effects-opacity-opacity-100: 1;   /* "opacity" repeated */
```

The cause is the Figma variable structure `Effects/Blur/blur-3xl` — the group name `Blur` and the variable prefix `blur-` are both included when the path is flattened. The same pattern likely exists elsewhere in the token tree.

## Acceptance Criteria

- [x] No CSS variable name contains a directly repeated adjacent segment (e.g. `blur-blur`, `opacity-opacity`)
- [x] Fixed via Style Dictionary name transform `name/kebab-deduped` in `style-dictionary.config.ts` (Option A — no Figma changes needed)
- [ ] Regression test / snapshot test — deferred, will be covered by visual regression testing (TICKET-023)

## Implementation Notes

**Option A — Style Dictionary name transform (recommended, no Figma changes needed):**
```ts
sd.registerTransform({
  name: 'name/dedupe-segments',
  type: 'name',
  transform: (token) => {
    const segments = token.path
    const deduped = segments.filter((seg, i) =>
      i === 0 || seg.toLowerCase() !== segments[i - 1].toLowerCase()
    )
    return deduped.join('-')
  },
})
```

**Option B — Fix in Figma:**
Rename `Effects/Blur/blur-3xl` → `Effects/Blur/3xl`. Cleaner long-term, but requires discipline on the Figma side and a re-export.

**Recommendation:** Apply the transform as a safety net regardless, and also clean up in Figma if access permits.

## Dependencies

- TICKET-002 (v4 upgrade) — register transform in the new config
- TICKET-003 — coordinate on transform ordering
