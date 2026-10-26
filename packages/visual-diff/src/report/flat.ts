import { PNG } from 'pngjs'

/**
 * Where a note may sit on a story's screenshot (TICKET-123, item 4): the "flat" parts of the
 * image, nothing but one colour. The report's script lays the notes out at the reader's width
 * and puts a note on the image only where every cell under it is flat and of the same colour
 * (or below the image); otherwise the box gets a numbered marker and its notes go in a list
 * under the image.
 *
 * The map is a grid of `FLAT_CELL` × `FLAT_CELL` image pixels. A cell is flat when all its pixels
 * are opaque and within `FLAT_TOLERANCE` (per channel) of its first pixel; flat cells of nearly the
 * same colour share a letter. Encoded as `cell;cols;rows;rle`, the run-length string being
 * letter (or `.` for not flat) and count pairs, row by row: `A120.8B12`.
 */
export const FLAT_CELL = 4
const FLAT_TOLERANCE = 6
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** The flat map of the top `height` pixel rows of a PNG (the cropped canvas of a report row). */
export function flatMap(png: Uint8Array, height?: number): string {
  const image = PNG.sync.read(Buffer.from(png))
  const { width, data } = image
  const rows = Math.ceil(Math.min(height ?? image.height, image.height) / FLAT_CELL)
  const cols = Math.ceil(width / FLAT_CELL)
  const maxY = Math.min(height ?? image.height, image.height)
  const palette: Array<[number, number, number]> = []
  const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
    Math.abs(a[0] - b[0]) <= FLAT_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= FLAT_TOLERANCE &&
    Math.abs(a[2] - b[2]) <= FLAT_TOLERANCE
  const cells: string[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * FLAT_CELL
      const y0 = row * FLAT_CELL
      const first = (y0 * width + x0) * 4
      const colour = [data[first], data[first + 1], data[first + 2]] as [number, number, number]
      let flat = true
      for (let y = y0; flat && y < Math.min(y0 + FLAT_CELL, maxY); y++) {
        for (let x = x0; x < Math.min(x0 + FLAT_CELL, width); x++) {
          const i = (y * width + x) * 4
          if (data[i + 3] !== 255 || !near(data.subarray(i, i + 3), colour)) {
            flat = false
            break
          }
        }
      }
      let letter = '.'
      if (flat) {
        let index = palette.findIndex((p) => near(p, colour))
        if (index < 0 && palette.length < LETTERS.length) index = palette.push(colour) - 1
        if (index >= 0) letter = LETTERS[index]
      }
      cells.push(letter)
    }
  }
  return `${FLAT_CELL};${cols};${rows};${runLength(cells)}`
}

function runLength(cells: string[]): string {
  let out = ''
  for (let i = 0; i < cells.length;) {
    let j = i
    while (j < cells.length && cells[j] === cells[i]) j++
    out += `${cells[i]}${j - i}`
    i = j
  }
  return out
}

/** The grid of a flat map, row by row (`.` where not flat). For tests and tools. */
export function decodeFlatMap(map: string): {
  cell: number
  cols: number
  rows: number
  cells: string[]
} {
  const [cell, cols, rows, rle] = map.split(';')
  const cells: string[] = []
  for (const [, letter, count] of rle.matchAll(/([A-Za-z.])(\d+)/g)) {
    for (let k = 0; k < Number(count); k++) cells.push(letter)
  }
  return { cell: Number(cell), cols: Number(cols), rows: Number(rows), cells }
}
