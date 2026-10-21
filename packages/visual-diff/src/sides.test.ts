import { describe, expect, it } from 'vitest'
import { baseInWords, headInWords } from './sides.js'

describe('the sides in words', () => {
  it('names the base by ref and short sha, only the sha, or the directory', () => {
    expect(baseInWords('merge base with origin/main (1a2b3c4)')).toBe('main · 1a2b3c4')
    expect(baseInWords('upstream/main (1a2b3c4)')).toBe('main · 1a2b3c4')
    expect(baseInWords('release/2.0 (9f8e7d6)')).toBe('release/2.0 · 9f8e7d6')
    expect(baseInWords('617cea0b23ea7f17a023113c641dd16ab7e231f6 (617cea0)')).toBe('617cea0')
    expect(baseInWords('tokens-base')).toBe('tokens-base')
  })

  it('names the head by branch and short sha, says when the tree was dirty, else "working tree"', () => {
    const sha = '9f3c1a2b4d5e6f708192a3b4c5d6e7f8091a2b3c'
    expect(headInWords({ ref: 'feature/x', sha, uncommitted: false })).toBe('feature/x · 9f3c1a2')
    expect(headInWords({ ref: 'feature/x', sha, uncommitted: true })).toBe(
      'feature/x · 9f3c1a2 + uncommitted changes',
    )
    expect(headInWords({ sha, uncommitted: false })).toBe('9f3c1a2')
    expect(headInWords(undefined)).toBe('working tree')
  })
})
