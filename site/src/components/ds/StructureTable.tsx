/**
 * The structure DTA detects in a token set (`analyzeStructure`, the table of `dta analyze`): one
 * row per collection with its modes, the inferred layer role and its confidence, the variable
 * count and the share of aliases. A role below the review threshold is marked with ⚠ and the
 * word "review", never colour alone; notes follow their row.
 *
 * Rules and type on the surface, no card. In a container narrower than 640px each row becomes a
 * short labelled list (the table keeps its roles for screen readers).
 *
 * With `onSelect` each collection name is a button that opens its details (the playground's
 * DetailPanel); the whole row is its hit area, and the selected row is tinted `action-subtle`.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import { Fragment } from 'preact'
import './StructureTable.css'

export interface StructureRow {
  name: string
  modes: readonly string[]
  /** The inferred layer role: primitives, brand, dimension, semantic or unknown. */
  role: string
  /** Two decimals, as `dta analyze` prints it. */
  confidence: string
  /** Below the review threshold (`LOW_CONFIDENCE` in @dta/core). */
  low: boolean
  variables: number
  /** For example `100%`. */
  aliasShare: string
  notes: readonly string[]
}

export interface StructureTableProps {
  /** The table's caption, shown as its title. */
  caption: string
  rows: readonly StructureRow[]
  /** Brands detected (the modes of the brand collection), shown under the table. */
  brands?: readonly string[]
  /** Keep the caption for screen readers only (a tab already names the view). */
  hideCaption?: boolean
  /** Makes each collection a button; gets the collection's name and the button. */
  onSelect?: (name: string, button: HTMLButtonElement) => void
  /** The collection whose details are open. */
  selected?: string
}

const COLUMNS = ['Collection', 'Modes', 'Role', 'Confidence', 'Variables', 'Aliases'] as const

export default function StructureTable({
  caption,
  rows,
  brands,
  hideCaption = false,
  onSelect,
  selected,
}: StructureTableProps) {
  return (
    <div class="dta-structure" data-selectable={onSelect ? '' : undefined}>
      <table class="dta-structure__table" role="table">
        <caption class="dta-structure__caption" data-hidden={hideCaption ? '' : undefined}>
          {caption}
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            {COLUMNS.map((column) => (
              <th scope="col" role="columnheader" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <Fragment key={row.name}>
              <tr
                role="row"
                class="dta-structure__row"
                aria-current={selected === row.name ? 'true' : undefined}
              >
                <th
                  scope="row"
                  role="rowheader"
                  class="dta-structure__name"
                  data-label={COLUMNS[0]}
                >
                  {onSelect ? (
                    <button
                      type="button"
                      class="dta-structure__open"
                      aria-haspopup="dialog"
                      onClick={(event) => onSelect(row.name, event.currentTarget)}
                    >
                      {row.name}
                      <span class="dta-structure__chevron" aria-hidden="true">
                        {' '}
                        ›
                      </span>
                    </button>
                  ) : (
                    row.name
                  )}
                </th>
                <td role="cell" data-label={COLUMNS[1]}>
                  <ul class="dta-structure__modes">
                    {row.modes.map((mode) => (
                      <li key={mode}>{mode}</li>
                    ))}
                  </ul>
                </td>
                <td role="cell" class="dta-structure__role" data-label={COLUMNS[2]}>
                  {row.role}
                </td>
                <td role="cell" class="dta-structure__number" data-label={COLUMNS[3]}>
                  <span>
                    {row.confidence}
                    {row.low && (
                      <span class="dta-structure__low">
                        {' '}
                        <span aria-hidden="true">⚠</span> review
                      </span>
                    )}
                  </span>
                </td>
                <td role="cell" class="dta-structure__number" data-label={COLUMNS[4]}>
                  {row.variables}
                </td>
                <td role="cell" class="dta-structure__number" data-label={COLUMNS[5]}>
                  {row.aliasShare}
                </td>
              </tr>
              {row.notes.length > 0 && (
                <tr
                  role="row"
                  class="dta-structure__notes"
                  aria-current={selected === row.name ? 'true' : undefined}
                >
                  <td role="cell" colSpan={COLUMNS.length}>
                    {row.notes.map((note) => (
                      <span key={note}>
                        <span aria-hidden="true">⚠</span> {note}
                      </span>
                    ))}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {brands && brands.length > 0 && (
        <p class="dta-structure__brands">
          <span class="dta-structure__brands-label">Brands</span> {brands.join(', ')}
        </p>
      )}
    </div>
  )
}
