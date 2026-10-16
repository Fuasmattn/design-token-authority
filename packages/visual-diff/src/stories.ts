import type { Diagnostic } from '@dta/core'
import { z } from 'zod'

/** Shape id of a stories manifest (written by the DTA website, read by `dta diff`). */
export const STORIES_SCHEMA = 'dta.stories/1'

const path = z.string().min(1)
const viewport = z.number().int().positive().max(8000)

/**
 * The `diff` section of `dta.config.*`: how to build the project and where its stories are.
 * Embedded by the CLI config schema.
 */
export const diffConfigSchema = z.strictObject({
  /** Command that prepares a fresh checkout of the base, run in its repo root (e.g. an install). */
  setup: path.optional(),
  /** Command that builds the static output, run at the base and the head. */
  build: path.optional(),
  /** Folder of the static output, relative to the project. */
  outDir: path,
  /** Where the stories come from. Only static sites for now; Storybook is a follow-up. */
  stories: z
    .strictObject({
      type: z.literal('static-site').default('static-site'),
      /** Manifest path inside `outDir`. */
      manifest: path.default('stories/manifest.json'),
    })
    .prefault({}),
  /** Viewport widths for stories that do not suggest their own. */
  viewports: z.array(viewport).min(1).default([1280]),
  /** Changed-pixel ratio (0–1) a story may differ by before it counts as changed. */
  threshold: z.number().min(0).max(1).default(0),
  /** Per-pixel colour tolerance (0–1); 0 sees every colour change. */
  colorThreshold: z.number().min(0).max(1).default(0),
  /**
   * Review thresholds by cause, as changed-pixel ratios (0–1). A story explained by token
   * changes needs a review above `explained`; an unexplained story fails above `unexplained`.
   */
  thresholds: z
    .strictObject({
      explained: z.number().min(0).max(1).default(0),
      unexplained: z.number().min(0).max(1).default(0),
    })
    .prefault({}),
  /**
   * Publish hook: a command run on the report folder (path as argument and DTA_REPORT_DIR) that
   * prints the public base URL as its last stdout line, or `{ command, url }` where `url` is a
   * JSON path (`$.deployment.url`) or a regular expression to find it. `--publish` overrides it.
   */
  publish: z.union([path, z.strictObject({ command: path, url: path.optional() })]).optional(),
  /** Default base for `dta diff` (a git ref or directory); `--base` overrides it. */
  base: path.optional(),
})

export type DiffConfigInput = z.input<typeof diffConfigSchema>
export type DiffConfig = z.output<typeof diffConfigSchema>

/** One story `dta diff` renders: a page of the built output, at one or more widths. */
export interface StoryRef {
  id: string
  title: string
  /** Path inside the static output, e.g. `/stories/button/variants/`. */
  url: string
  viewports: number[]
}

const manifestSchema = z.object({
  schema: z.literal(STORIES_SCHEMA),
  stories: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      url: z.string().startsWith('/'),
      viewports: z.array(viewport).min(1).optional(),
    }),
  ),
})

/**
 * Static-site adapter: reads a stories manifest (already parsed JSON). Problems come back as
 * diagnostics; the function never throws on bad input.
 */
export function readStoriesManifest(
  manifest: unknown,
  options: { viewports: number[] },
): { stories: StoryRef[]; diagnostics: Diagnostic[] } {
  const parsed = manifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return {
      stories: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-manifest',
          message: `Not a ${STORIES_SCHEMA} stories manifest: ${issues}`,
        },
      ],
    }
  }

  const diagnostics: Diagnostic[] = []
  const seen = new Set<string>()
  const stories: StoryRef[] = []
  for (const story of parsed.data.stories) {
    if (seen.has(story.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-story',
        message: `Story id "${story.id}" appears more than once in the manifest.`,
      })
      continue
    }
    seen.add(story.id)
    stories.push({
      id: story.id,
      title: story.title,
      url: story.url,
      viewports: story.viewports ?? options.viewports,
    })
  }
  return { stories, diagnostics }
}
