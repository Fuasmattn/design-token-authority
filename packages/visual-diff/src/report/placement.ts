/**
 * Marker placement and list grouping for the report's notes (TICKET-123 item 5), as plain browser
 * JavaScript: the report's inline script includes it, and the tests evaluate the same source.
 * Coordinates are CSS pixels on the row's canvas.
 *
 * `markerSpot(ring, size, W, H, ok)`: where the numbered marker of a box goes. `ring` is the
 * outline's outer edge `{ l, t, r, b }`, `size` the marker's `{ w, h }`, `ok(x, y, w, h)` says
 * whether a spot covers only one flat colour and nothing placed. Tried in order: along the outer
 * edge, outside the box (above at the left corner, the middle and the right corner; right; below;
 * left; then the four diagonal corners); then farther out, 4 px at a time up to 48 px, along each
 * side (top, right, bottom, left). Always inside the canvas. Returns `{ x, y, covers }`: `covers`
 * is true only when no spot passed `ok` (then the first edge spot that fits the canvas is used).
 *
 * `groupKeys(items)`: list entries for keyed boxes. `items` are `{ n, sig }` in number order (`sig`:
 * the box's set of token changes); boxes with the same set share one entry. Returns
 * `[{ ns, items }]` in order of their first number.
 */
export const PLACEMENT_JS = `
function markerSpot(ring, size, W, H, ok) {
  const w = size.w, h = size.h, g = 2
  const fits = (x, y) => x >= 0 && y >= 0 && x + w <= W && y + h <= H
  const cx = Math.round((ring.l + ring.r - w) / 2), cy = Math.round((ring.t + ring.b - h) / 2)
  const above = ring.t - h - g, below = ring.b + g, left = ring.l - w - g, right = ring.r + g
  const edge = [
    [ring.l, above], [cx, above], [ring.r - w, above],
    [right, ring.t], [right, cy], [right, ring.b - h],
    [ring.l, below], [cx, below], [ring.r - w, below],
    [left, ring.t], [left, cy], [left, ring.b - h],
    [left, above], [right, above], [right, below], [left, below],
  ]
  for (const [x, y] of edge) if (fits(x, y) && ok(x, y, w, h)) return { x, y, covers: false }
  for (let d = 4; d <= 48; d += 4) {
    const spots = []
    for (let x = ring.l - w - g - d; x <= ring.r + g + d; x += 4) spots.push([x, above - d])
    for (let y = ring.t - h - g - d; y <= ring.b + g + d; y += 4) spots.push([right + d, y])
    for (let x = ring.l - w - g - d; x <= ring.r + g + d; x += 4) spots.push([x, below + d])
    for (let y = ring.t - h - g - d; y <= ring.b + g + d; y += 4) spots.push([left - d, y])
    for (const [x, y] of spots) if (fits(x, y) && ok(x, y, w, h)) return { x, y, covers: false }
  }
  const first = edge.find(([x, y]) => fits(x, y)) || [Math.max(0, Math.min(ring.l, W - w)), Math.max(0, Math.min(ring.t, H - h))]
  return { x: first[0], y: first[1], covers: true }
}
function groupKeys(items) {
  const groups = []
  const bySig = new Map()
  for (const it of items) {
    const group = bySig.get(it.sig)
    if (group) { group.ns.push(it.n); group.items.push(it) }
    else { const fresh = { ns: [it.n], items: [it] }; bySig.set(it.sig, fresh); groups.push(fresh) }
  }
  return groups
}
`
