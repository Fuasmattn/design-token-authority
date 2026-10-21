/**
 * Stand-in screenshots for the Diff card stories: an Orbit Burger order card as dta diff would
 * capture it (the story page's own colours, blue and grey; they do not follow the theme). The
 * base has Radius.Card 8 and Nova 500, the head 24 and Nova 600 (the example's two token
 * changes); `title` is the title's font size, for a change no token explains.
 */
export const CARD_CANVAS = { width: 440, height: 240 }
export const CARD_BOX = { x: 24, y: 24, width: 360, height: 168 }
export const BUTTON_BOX = { x: 48, y: 128, width: 228, height: 44 }
export const TITLE_BOX = { x: 44, y: 56, width: 176, height: 34 }

export function orbitCard(options: { radius: number; button: string; title?: number }): string {
  const { radius, button, title = 22 } = options
  return `<svg aria-hidden="true" viewBox="0 0 440 240" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, system-ui, sans-serif">
  <rect width="440" height="240" fill="#f6f2ea"/>
  <rect x="24" y="24" width="360" height="168" rx="${radius}" fill="#1f2a44"/>
  <text x="48" y="54" font-size="11" letter-spacing="1" fill="#b9d8f7" font-family="Martian Mono, ui-monospace, monospace">READY · IN ORBIT</text>
  <text x="48" y="${62 + title}" font-size="${title}" font-weight="700" fill="#eef2f8">Nebula Double</text>
  <text x="48" y="${title > 22 ? 112 : 108}" font-size="13" fill="#c9d3e3">Two patties, starlight sauce, toasted bun.</text>
  <rect x="48" y="128" width="228" height="44" rx="${radius}" fill="${button}"/>
  <text x="162" y="156" font-size="16" font-weight="700" fill="#0b1222" text-anchor="middle">Launch order · 12 min</text>
</svg>`
}

/** The diff overlay's stand-in: the changed pixels (the title) in signal, the rest white. */
export function orbitCardTitleDiff(): string {
  return `<svg aria-hidden="true" viewBox="0 0 440 240" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, system-ui, sans-serif">
  <rect width="440" height="240" fill="#fdfdfd"/>
  <text x="48" y="87" font-size="25" font-weight="700" style="fill: var(--signal-bg)">Nebula Double</text>
  <text x="48" y="112" font-size="13" style="fill: var(--signal-bg)">Two patties, starlight sauce, toasted bun.</text>
</svg>`
}

export const ORBIT_TOKENS = [
  {
    token: 'Colors.Brand.Primary',
    base: '{Nova.500} #5aa2ff',
    baseSwatch: '#5aa2ff',
    head: '{Nova.600} #3d87e8',
    headSwatch: '#3d87e8',
    outlined: 'span.button',
  },
  {
    token: 'Radius.Card',
    base: '{Orbit.radius-sm} 8',
    head: '{Orbit.radius-lg} 24',
    outlined: 'div.card, span.button',
  },
]

export const ORBIT_MARKS = [
  { ...CARD_BOX, notes: [{ token: 'Radius.Card', change: '8 → 24' }] },
  {
    ...BUTTON_BOX,
    notes: [
      { token: 'Colors.Brand.Primary', change: 'Nova 500 → 600' },
      { token: 'Radius.Card', change: '8 → 24' },
    ],
  },
]
