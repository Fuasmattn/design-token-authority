import type { ComponentChildren, VNode } from 'preact'
import { describe, expect, it, vi } from 'vitest'
import { analyse } from './analyse'
import { PROBLEM_EXAMPLE } from './example'
import { buildGraph, tokenDetail } from './graph'
import { tokenPanelContent } from './token-panel'

const BRAND = 'Brand(Alias)'
const result = analyse(PROBLEM_EXAMPLE.files)

/** Every element vnode under some children, depth first. */
function elements(children: ComponentChildren): VNode<Record<string, unknown>>[] {
  if (children === null || children === undefined || typeof children !== 'object') return []
  if (Array.isArray(children)) return children.flatMap(elements)
  const node = children as VNode<Record<string, unknown>>
  return [node, ...elements(node.props?.children as ComponentChildren)]
}
const text = (children: ComponentChildren): string =>
  Array.isArray(children)
    ? children.map(text).join('')
    : typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : children && typeof children === 'object'
        ? text((children as VNode<{ children?: ComponentChildren }>).props?.children)
        : ''
const buttons = (children: ComponentChildren) =>
  elements(children).filter((node) => node.type === 'button')

describe('tokenPanelContent', () => {
  it('shows a token with its readings, names, findings and the ways on', () => {
    const view = buildGraph(result, { [BRAND]: 'BrandA' })
    const detail = tokenDetail(result, view, `${BRAND}.BrandA/Colors/Brand/Accent`)!
    const onLint = vi.fn()
    const onMode = vi.fn()
    const content = tokenPanelContent(detail, { onLint, onMode })
    expect(content.kicker).toBe('Token · color · Brand(Alias)')
    expect(content.title).toBe('Colors.Brand.Accent')
    expect(text(content.meta)).toBe(
      'Every brand, as dta token get reads it; the graph shows BrandA · Desktop.',
    )
    expect(content.linesLabel).toBe('Readings of Colors.Brand.Accent')
    expect(content.facts).toBe(detail.facts)
    expect(content.notes).toBe(detail.notes)
    const links = buttons(content.links)
    expect(links.map((b) => text(b.props.children))).toEqual(['Show in lint', 'Show BrandB'])
    ;(links[0].props.onClick as () => void)()
    ;(links[1].props.onClick as () => void)()
    expect(onLint).toHaveBeenCalledWith({ group: 0, line: 0 })
    expect(onMode).toHaveBeenCalledWith(BRAND, 'BrandB')
  })

  it('has no ways on for a token without findings, and says nothing of brands for a primitive', () => {
    const view = buildGraph(result, { [BRAND]: 'BrandA' })
    const detail = tokenDetail(result, view, 'Primitives.Mode 1/Colors/Foundation/White')!
    const content = tokenPanelContent(detail)
    expect(content.links).toBeUndefined()
    expect(text(content.meta)).toBe('As dta token get reads it; the graph shows BrandA · Desktop.')
  })
})
