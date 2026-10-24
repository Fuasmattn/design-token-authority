import type { Region, TokenCause } from './attribution.js'
import type { StoryResult } from './compare.js'
import type { TokenState } from './token-changes.js'

/** `pass`: nothing to look at. `review`: explained or new changes. `fail`: unexplained ones. */
export type Verdict = 'pass' | 'review' | 'fail'

export interface ReviewThresholds {
  explained: number
  unexplained: number
}

/** One token change and the changed stories (`id@viewport`) it explains. */
export interface TokenGroup {
  id: string
  before?: TokenState
  after?: TokenState
  stories: string[]
  /** One of its stories changed more than the `explained` threshold. */
  needsReview: boolean
}

export interface UnexplainedStory {
  story: string
  ratio: number
  pixels: number
  region?: Region
  /** Above the `unexplained` threshold. */
  failing: boolean
}

export interface Review {
  verdict: Verdict
  /** Changed stories (story × viewport). */
  changed: number
  /** Of those, fully explained by token changes. */
  explained: number
  tokens: TokenGroup[]
  unexplained: UnexplainedStory[]
  added: string[]
  removed: string[]
}

const ref = (r: Pick<StoryResult, 'id' | 'viewport'>) => `${r.id}@${r.viewport}`

/**
 * Groups changed stories by cause. Explained changes are reviewed once per token change;
 * unexplained changes above the threshold fail. A story without attribution is unexplained.
 */
export function reviewStories(
  results: StoryResult[],
  causes: TokenCause[],
  thresholds: ReviewThresholds,
): Review {
  const changed = results.filter((r) => r.status === 'changed')
  const explainedResults = changed.filter((r) => r.attribution?.explained)
  const tokens: TokenGroup[] = causes
    .map((cause) => {
      const stories = explainedResults.filter((r) =>
        r.attribution?.tokens.some((t) => t.id === cause.id),
      )
      return {
        id: cause.id,
        ...(cause.before ? { before: cause.before } : {}),
        ...(cause.after ? { after: cause.after } : {}),
        stories: stories.map(ref),
        needsReview: stories.some((r) => r.ratio > thresholds.explained),
      }
    })
    .filter((group) => group.stories.length > 0)

  const unexplained = changed
    .filter((r) => !r.attribution?.explained)
    .map((r) => ({
      story: ref(r),
      ratio: r.ratio,
      pixels: r.attribution?.unexplainedPixels ?? r.changedPixels,
      ...(r.attribution?.unexplainedRegion ? { region: r.attribution.unexplainedRegion } : {}),
      failing: r.ratio > thresholds.unexplained,
    }))
  const added = results.filter((r) => r.status === 'added').map(ref)
  const removed = results.filter((r) => r.status === 'removed').map(ref)

  const verdict: Verdict = unexplained.some((u) => u.failing)
    ? 'fail'
    : tokens.some((t) => t.needsReview) || added.length > 0 || removed.length > 0
      ? 'review'
      : 'pass'
  return {
    verdict,
    changed: changed.length,
    explained: explainedResults.length,
    tokens,
    unexplained,
    added,
    removed,
  }
}
