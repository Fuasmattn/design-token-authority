/**
 * A list of findings in the CLI's words: input diagnostics (`error [code] message (file)`) or
 * lint violations (`warn message [rule]`), with the summary line `dta lint` ends with. Severity
 * shows as the word and a marker shape (a filled square for errors, an open ring for warnings),
 * never colour alone; the design system has no error colour and `signal` is never used for
 * errors.
 *
 * Groups are either titled lists (a file and its lines) or, with a `count`, a summary row per
 * rule (playground spec decision 15: summaries first): `no-dangling-aliases   1 error ›`. A rule
 * with findings opens to its lines (native disclosure); one without is a plain row. With
 * `onSelect` each line is a button that opens its details (the playground's DetailPanel).
 *
 * Motion: a rule's lines open and close by animating their height (CSS `::details-content` with
 * `interpolate-size`; browsers without it open at once), the chevron turns, and the selected
 * line's tint comes and goes over `motion.duration.fast`.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import './Findings.css'

export interface FindingLine {
  severity: 'error' | 'warning'
  /** The word the CLI prints first: `error`, `warning` or `warn`. */
  label: string
  /** The rest of the line, as the CLI prints it. */
  text: string
  /** A second, quieter line: the file the finding is in. */
  detail?: string
}

export interface FindingGroup {
  /** A file name or a rule; none for lines that name their file themselves. */
  title?: string
  /** Makes the group a summary row: its count (`1 error`, `no findings`). */
  count?: string
  /** The worst severity in the group (its marker); none for a clean rule. */
  severity?: 'error' | 'warning'
  /** Open the group's lines at first (stories; otherwise the visitor opens it). */
  open?: boolean
  lines: readonly FindingLine[]
}

export interface FindingsProps {
  title: string
  /** Heading level of the title. */
  level?: 2 | 3
  groups: readonly FindingGroup[]
  /** The summary line, e.g. `8 warnings found.` or `No lint violations found.` */
  summary?: string
  /** Clean shows a pass dot; the others the marker of their worst finding. */
  outcome?: 'clean' | 'warnings' | 'failed'
  /** The verdict after the summary, e.g. `Lint passed with warnings.` */
  verdict?: string
  /** A quiet line under the summary (which rules ran, how to read the list). */
  note?: string
  /** Makes each line a button; gets the group and line index and the button. */
  onSelect?: (group: number, line: number, button: HTMLButtonElement) => void
  /** The line whose details are open. */
  selected?: { group: number; line: number }
}

function Line({
  line,
  onSelect,
  selected,
}: {
  line: FindingLine
  onSelect?: (button: HTMLButtonElement) => void
  selected: boolean
}) {
  const content = (
    <>
      <span class="dta-findings__marker" aria-hidden="true" />
      <span class="dta-findings__text">
        <span class="dta-findings__label">{line.label}</span> {line.text}
        {line.detail && <span class="dta-findings__detail">{line.detail}</span>}
      </span>
    </>
  )
  return (
    <li
      class="dta-findings__line"
      data-severity={line.severity}
      aria-current={selected ? 'true' : undefined}
    >
      {onSelect ? (
        <button
          type="button"
          class="dta-findings__open"
          aria-haspopup="dialog"
          onClick={(event) => onSelect(event.currentTarget)}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  )
}

export default function Findings({
  title,
  level = 2,
  groups,
  summary,
  outcome,
  verdict,
  note,
  onSelect,
  selected,
}: FindingsProps) {
  const Heading = level === 3 ? 'h3' : 'h2'
  const lines = (group: FindingGroup, g: number) => (
    <ul class="dta-findings__lines">
      {group.lines.map((line, i) => (
        <Line
          key={i}
          line={line}
          selected={selected?.group === g && selected.line === i}
          onSelect={onSelect && ((button) => onSelect(g, i, button))}
        />
      ))}
    </ul>
  )
  const rule = (group: FindingGroup) => (
    <>
      <span class="dta-findings__marker" data-severity={group.severity} aria-hidden="true" />
      <span class="dta-findings__rule-name">{group.title}</span>
      <span class="dta-findings__count">{group.count}</span>
    </>
  )

  return (
    <section class="dta-findings">
      <Heading class="dta-findings__title">{title}</Heading>
      {summary && (
        <p class="dta-findings__summary" data-outcome={outcome}>
          <span class="dta-findings__marker" aria-hidden="true" />
          <span>
            {summary}
            {verdict && <> {verdict}</>}
          </span>
        </p>
      )}
      {note && <p class="dta-findings__note">{note}</p>}
      {groups.some((group) => group.count !== undefined) ? (
        <div class="dta-findings__rules">
          {groups.map((group, g) =>
            group.lines.length > 0 ? (
              <details class="dta-findings__rule" key={group.title ?? g} open={group.open}>
                <summary class="dta-findings__rule-row">{rule(group)}</summary>
                {lines(group, g)}
              </details>
            ) : (
              <div class="dta-findings__rule" key={group.title ?? g}>
                <div class="dta-findings__rule-row">{rule(group)}</div>
              </div>
            ),
          )}
        </div>
      ) : (
        groups.map((group, g) => (
          <div class="dta-findings__group" key={group.title ?? g}>
            {group.title && <p class="dta-findings__file">{group.title}</p>}
            {lines(group, g)}
          </div>
        ))
      )}
    </section>
  )
}
