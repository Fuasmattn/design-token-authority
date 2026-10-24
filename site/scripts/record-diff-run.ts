/**
 * Records a real `dta diff` run of the Orbit Burger example for the landing page (TICKET-111):
 * reads the report's result.json and writes the small summary the page reads,
 * src/landing/diff-run.json. Run it after `dta diff --base <ref>` in examples/orbit-burger, where
 * <ref> is a commit with tokens/ = tokens-base/ (main), so the run compares main with the change:
 *
 *   pnpm --filter dta-site diff:record [path/to/result.json]
 */
import fs from 'node:fs'
import path from 'node:path'

interface TokenState {
  raw?: string | number | boolean
  resolved?: string | number | boolean
}
interface Result {
  schema: string
  review?: {
    verdict: 'pass' | 'review' | 'fail'
    changed: number
    explained: number
    tokens: Array<{ id: string; before?: TokenState; after?: TokenState; stories: string[] }>
    unexplained: Array<{ story: string; pixels: number }>
  }
  stories: Array<{
    id: string
    viewport: number
    status: string
    changedPixels?: number
    attribution?: { explained: boolean; tokens: Array<{ id: string }> }
  }>
}

/** The recorded run, as the landing page reads it. */
export function summarizeDiffRun(result: Result, recorded: string) {
  if (result.schema !== 'dta.diff/1' || !result.review) {
    throw new Error('not a dta diff result with stories (dta.diff/1 with a review)')
  }
  const name = (id: string) => id.replace(/ \(.*\)$/, '')
  return {
    recorded,
    where: 'site/examples/orbit-burger',
    command: 'dta diff --base <a commit with tokens/ = tokens-base/>',
    verdict: result.review.verdict,
    changed: result.review.changed,
    explained: result.review.explained,
    tokens: result.review.tokens.map((token) => ({
      name: name(token.id),
      id: token.id,
      before: token.before,
      after: token.after,
      stories: token.stories,
    })),
    unexplained: result.review.unexplained.map(({ story, pixels }) => ({ story, pixels })),
    stories: result.stories
      .filter((story) => story.status === 'changed')
      .map((story) => ({
        story: `${story.id}@${story.viewport}`,
        changedPixels: story.changedPixels ?? 0,
        explainedBy: (story.attribution?.tokens ?? []).map((token) => name(token.id)),
      })),
  }
}

export const DIFF_RUN = path.resolve(import.meta.dirname, '..', 'src', 'landing', 'diff-run.json')

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const input = path.resolve(
    process.argv[2] ??
      path.join(
        import.meta.dirname,
        '..',
        'examples',
        'orbit-burger',
        '.dta',
        'diff',
        'result.json',
      ),
  )
  const result = JSON.parse(fs.readFileSync(input, 'utf8')) as Result
  const summary = summarizeDiffRun(result, new Date().toISOString().slice(0, 10))
  fs.writeFileSync(DIFF_RUN, JSON.stringify(summary, null, 2) + '\n')
  console.log(`Wrote ${path.relative(process.cwd(), DIFF_RUN)}`)
}
