# TICKET-151: Lean docs

**Phase:** 7 — Docs site (follow-up)
**Priority:** Medium
**Effort:** L (section by section)
**Blocked by:** 150
**Status:** done (2026-10-25)

## What to build

Maintainer feedback (2026-10-25): the docs are a lot of text; readers stop because of detail they did not ask for (collection details, edge cases, how things work inside). Every page gets a leaner version of itself. About 20,000 words of prose today, plus 13,000 on the 38 design-system component pages.

## Style

- **Start with what the page is for**, in one sentence. Then the task: the command or config, with one line each.
- **Short paragraphs**, three sentences at most; lists and tables over prose.
- **Details go one level down:** to the reference page that owns them (linked), or out. A fact lives on one page; other pages link to it.
- **Out:** internal history ("before …", "replacing …"), how the code works inside (loading, chunks, caches), edge cases nobody asked about, repeated explanations.
- **Keep:** what a user types, what they get, what to do when it fails, and every rule a reader must follow.
- Command output only where it helps to recognise the result; trimmed to the lines that matter.

## Order

1. Start (What DTA is, Quick start, Core concepts)
2. Guides (heaviest first: dta diff in pull requests, coding agents, brands and themes, Figma, CI, Storybook, migrate from v1, Tailwind)
3. Learn
4. Reference (Outputs, Token files, Lint rules, Token queries, Exit codes; the generated Commands and Configuration pages are lean at the source: option descriptions)
5. Design system (overview, status colours, motion, tokens, components: guidelines as short bullets)
6. Contribute

Each section is its own commit after the maintainer's review of its pages.

## Acceptance criteria

- [x] Style agreed on a sample page (What DTA is)
- [x] Each section rewritten to the style; word count before and after in the progress notes
- [x] Nothing a user needs is lost: removed details exist on the page that owns them, or were not needed
- [x] Links checked by the site build; all gates pass

## Progress (2026-10-25)

Words of prose (code excluded), before → after:

- **Start:** What DTA is 617 → 207, Quick start → 117 (TICKET-150), Core concepts 527 → 251.
- **Guides:** dta diff in pull requests 2759 → 815 (workflow files and publish scripts in collapsed blocks), coding agents 848 → 322, brands and themes 829 → 295, Figma 788 → 347, CI 545 → 311, dta diff with Storybook 468 → 159, Tailwind 236 → 140, Guides index 128 → 134.
- Kept every heading that error messages or other pages link to. Rules users must follow that existed only in the long text came back as one line each: `.env` read from the folder you run in, push runs lint first and `push.skipConfirmation`, colours clipped to sRGB, `prune --force`, the `@scope` limit when nesting modifiers, what the audit skips.
- Removed as not needed in a guide: full example outputs, internals (lockfile reuse, capture timing, how layered custom properties are named), history, and the example runs.
- Migrating from v1 removed (maintainer, 2026-10-25: nobody used it).
- **Learn:** new page "What design tokens are" (231 words: what they are, what they solve, primitives and semantic tokens, where DTA fits; maintainer, 2026-10-25). The DTCG format 209 → 157, Token patterns 428 → 307 (its outdated "one mode per combination" note now points at Brands and themes together).
- **Reference:** Outputs 1834 → 937, Token files 1289 → 570, Lint rules 737 → 415, Token queries 478 → 233, Exit codes 443 → 441 (the table is the content), index 171 → 176. Kept as one line each: a `.tokens` file must not repeat a per-mode file's collection and mode; `--mode` repeats to pick a combination. Command and config descriptions were already one sentence each.
- **Sidebar:** the Guides and Reference overview pages are labelled "Overview", so the sidebar no longer reads "Guides › Guides" (maintainer, 2026-10-25: keep "Guides", not "Recipes").
- **Design system:** overview 1479 → 547, Status colours 1749 → 693, Motion 870 → 449, the four token pages 633 → 332. Corrected on the way: the redline-label contrast (5.7:1, not 4.5:1), the DTCG duration types (read now), `radius-full` (dots and round controls). Removed: contrast tables and colour-vision figures (the tests still enforce the rules), per-component motion techniques.
- **Components:** 38 pages 13,403 → about 6,700 words; each keeps one intro line, When to use (where it had one), the examples, Guidelines and Tokens used. Removed: exact figures, placement algorithms, class names and other implementation detail that lives in the component source.
- **Contribute:** 734 → 407; adds the rule that the website uses only its tokens and design-system components.
- **In total:** about 33,000 words of prose → about 15,800. All gates pass; the site build checks every link.
