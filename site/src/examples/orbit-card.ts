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
    before: '{Nova.500} #5aa2ff',
    beforeSwatch: '#5aa2ff',
    after: '{Nova.600} #3d87e8',
    afterSwatch: '#3d87e8',
    outlined: 'span.button',
  },
  {
    token: 'Radius.Card',
    before: '{Orbit.radius-sm} 8',
    after: '{Orbit.radius-lg} 24',
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

/**
 * The flat surfaces of `orbitCard` for the Diff card's `surfaces` (what the report reads from the
 * PNG): the page's paper around the card (the card's rounded corners left out) and the card's navy
 * right of the title.
 */
export const CARD_SURFACES = [
  [
    { x: 0, y: 0, width: 440, height: 24 },
    { x: 0, y: 192, width: 440, height: 48 },
    { x: 0, y: 24, width: 24, height: 168 },
    { x: 384, y: 24, width: 56, height: 168 },
  ],
  // The card's navy right of the title.
  [{ x: 228, y: 40, width: 148, height: 52 }],
]

/**
 * Two order cards on one page (TICKET-123): both cards' radius changes (8 → 24) and both buttons'
 * colour (Nova 500 → 600); the second card sits 64 px below the first, a total line under it.
 * Where a box's notes would cover the other card or the total, it gets a numbered marker and its notes are listed under the image; boxes
 * with the same token changes (the two cards, the two buttons) share one list entry.
 */
export const MENU_CANVAS = { width: 440, height: 348 }
const MENU_CARD = (y: number) => ({ x: 24, y, width: 360, height: 112 })
const MENU_BUTTON = (y: number) => ({ x: 48, y: y + 56, width: 228, height: 36 })
export const MENU_SURFACES = [
  [
    { x: 0, y: 0, width: 440, height: 24 },
    { x: 0, y: 136, width: 440, height: 64 },
    { x: 0, y: 24, width: 24, height: 112 },
    { x: 0, y: 200, width: 24, height: 112 },
    { x: 384, y: 24, width: 56, height: 288 },
    { x: 0, y: 312, width: 440, height: 12 },
  ],
  // The cards' navy right of and under their buttons.
  [24, 200].flatMap((y) => [
    { x: 280, y: y + 52, width: 96, height: 44 },
    { x: 40, y: y + 96, width: 328, height: 12 },
  ]),
]

export function orbitMenu(options: { radius: number; button: string }): string {
  const { radius, button } = options
  const card = (y: number, title: string, line: string) => `
  <rect x="24" y="${y}" width="360" height="112" rx="${radius}" fill="#1f2a44"/>
  <text x="48" y="${y + 30}" font-size="18" font-weight="700" fill="#eef2f8">${title}</text>
  <text x="48" y="${y + 48}" font-size="12" fill="#c9d3e3">${line}</text>
  <rect x="48" y="${y + 56}" width="228" height="36" rx="${radius}" fill="${button}"/>
  <text x="162" y="${y + 79}" font-size="14" font-weight="700" fill="#0b1222" text-anchor="middle">Add to order</text>`
  return `<svg aria-hidden="true" viewBox="0 0 440 348" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, system-ui, sans-serif">
  <rect width="440" height="348" fill="#f6f2ea"/>${card(24, 'Nebula Double', 'Two patties, starlight sauce.')}${card(200, 'Comet Fries', 'Crinkle cut, nebula salt.')}
  <text x="24" y="340" font-size="13" fill="#44506c">Total · 2 items · 14.80</text>
</svg>`
}

const RADIUS_NOTE = { token: 'Radius.Card', change: '8 → 24' }
const BUTTON_NOTES = [{ token: 'Colors.Brand.Primary', change: 'Nova 500 → 600' }, RADIUS_NOTE]
export const MENU_MARKS = [
  { ...MENU_CARD(24), notes: [RADIUS_NOTE] },
  { ...MENU_BUTTON(24), notes: BUTTON_NOTES },
  { ...MENU_CARD(200), notes: [RADIUS_NOTE] },
  { ...MENU_BUTTON(200), notes: BUTTON_NOTES },
]
