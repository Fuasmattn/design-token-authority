import { z } from 'zod'
import { DIFF_SCHEMA } from './render.js'

/**
 * The shape of `result.json` (and `dta diff --format json` with stories), version `dta.diff/1`.
 * Fields are only added within a version; a breaking change bumps it. The JSON Schema in
 * docs/diff/result.schema.json is generated from this (`pnpm run schema:generate`).
 */

const value = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown()),
  ])
  .describe('A token value as written: a scalar, or a DTCG 2025.10 object or list.')
const state = z.object({ raw: value, resolved: value.optional() })
const tokenType = z.enum(['color', 'number', 'string', 'boolean'])
const ratio = z.number().min(0).max(1)
const region = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
})

const tokenChange = z.object({
  kind: z.enum(['changed', 'added', 'removed', 'affected']),
  collection: z.string(),
  mode: z.string(),
  name: z.string().describe('Dot path, e.g. "action.bg".'),
  type: tokenType,
  typeBefore: tokenType.optional(),
  before: state.optional(),
  after: state.optional(),
  causes: z.array(z.string()).optional(),
})

const attribution = z
  .object({
    explained: z.boolean().describe('Every changed pixel traces to a changed token.'),
    tokens: z.array(
      z.object({
        id: z.string().describe('"name (Collection · Mode)" of the token change.'),
        dependents: z.number().int().describe('Elements whose style or box the token changes.'),
        pixels: z.number().int().describe('Changed pixels inside those elements (may overlap).'),
        elements: z.array(z.string()).describe('Up to five element labels, e.g. "button.primary".'),
        regions: z
          .array(region)
          .describe('Up to five dependent boxes in the head image, largest first.'),
      }),
    ),
    unexplainedPixels: z.number().int(),
    unexplainedRegion: region.optional(),
    canvas: z
      .object({ width: z.number().int(), height: z.number().int() })
      .describe('Size of the compared image the regions refer to.'),
    ms: z.number().optional().describe('Time the attribution took.'),
  })
  .describe('Present on changed stories.')

const story = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  viewport: z.number().int(),
  status: z.enum(['unchanged', 'changed', 'added', 'removed']),
  ratio: ratio.describe('Changed pixels / all pixels.'),
  changedPixels: z.number().int(),
  images: z
    .object({
      base: z.string().optional(),
      head: z.string().optional(),
      diff: z.string().optional(),
    })
    .describe('Paths inside the report folder.'),
  attribution: attribution.optional(),
})

const review = z.object({
  verdict: z.enum(['pass', 'review', 'fail']),
  changed: z.number().int(),
  explained: z.number().int(),
  tokens: z.array(
    z.object({
      id: z.string(),
      before: state.optional(),
      after: state.optional(),
      stories: z.array(z.string()).describe('"story@viewport" of the stories it explains.'),
      needsReview: z.boolean(),
    }),
  ),
  unexplained: z.array(
    z.object({
      story: z.string(),
      ratio,
      pixels: z.number().int(),
      region: region.optional(),
      failing: z.boolean(),
    }),
  ),
  added: z.array(z.string()),
  removed: z.array(z.string()),
})

export const diffResultSchema = z
  .object({
    schema: z.literal(DIFF_SCHEMA),
    base: z.string().describe('How the base was chosen.'),
    head: z
      .object({
        ref: z
          .string()
          .optional()
          .describe('The branch, without refs/heads/ (absent when detached).'),
        sha: z.string().describe('The commit HEAD pointed at.'),
        uncommitted: z
          .boolean()
          .describe('The repository had uncommitted changes (tracked or untracked, not ignored).'),
      })
      .optional()
      .describe(
        'What was rendered as "with this change": the checkout dta diff ran in. Absent outside git and in older results.',
      ),
    verdict: z
      .enum(['pass', 'review', 'fail'])
      .optional()
      .describe('pass: nothing to review; review: explained or new changes; fail: unexplained.'),
    review: review.optional(),
    publish: z
      .object({
        url: z.string().describe('Base URL of the published report folder.'),
        report: z.string().describe('URL of index.html.'),
      })
      .optional()
      .describe('Set when a publish hook ran; image paths resolve against `url`.'),
    tokens: z.object({
      counts: z.object({
        changed: z.number().int(),
        added: z.number().int(),
        removed: z.number().int(),
        affected: z.number().int(),
      }),
      changes: z.array(tokenChange),
    }),
    stories: z.array(story),
  })
  .describe('dta diff result: token changes, rendered stories and their attribution.')

export type DiffResult = z.infer<typeof diffResultSchema>

export function diffResultJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(diffResultSchema, { target: 'draft-2020-12' }) as Record<string, unknown>
}
