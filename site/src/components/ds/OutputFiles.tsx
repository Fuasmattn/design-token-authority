/**
 * Built files to take away, grouped by kind (playground spec decision 3, TICKET-079): each group
 * (CSS, Tailwind, JS) has a heading, its file count and one download for the whole group; each
 * file a row with its path, its size, Copy and Download. The path is a button that opens the
 * file's preview (the playground's DetailPanel); the row of the open file is marked
 * (`aria-current`, tinted `action-subtle`), as in the Structure table.
 *
 * The component shows and reports; it does not save files: `onDownload` and `onDownloadGroup`
 * are the page's. Copy is the CopyButton. Below 560px of container width the path takes its own
 * line and the size and actions follow under it.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import CopyButton from './CopyButton'
import { breakable } from './DetailPanel'
import './Button.css'
import './OutputFiles.css'

export interface OutputFileItem {
  /** Where `dta build` writes it, e.g. `output/css/themes/branda.css`. */
  path: string
  /** `746 B`, `1.2 KB`. */
  size: string
  /** The file's text, for Copy. */
  content: string
}

export interface OutputFileGroup {
  id: string
  /** `CSS`, `Tailwind`, `JS`. */
  name: string
  files: readonly OutputFileItem[]
  /** Label of the group's download, e.g. `Download CSS (.zip)`. */
  downloadLabel: string
}

export interface OutputFilesProps {
  idPrefix?: string
  groups: readonly OutputFileGroup[]
  /** The path whose preview is open. */
  selected?: string
  onOpen?: (path: string, button: HTMLButtonElement) => void
  onDownload?: (path: string) => void
  onDownloadGroup?: (id: string) => void
}

const files = (count: number) => `${count} file${count === 1 ? '' : 's'}`

export default function OutputFiles({
  idPrefix = 'dta-outputs',
  groups,
  selected,
  onOpen,
  onDownload,
  onDownloadGroup,
}: OutputFilesProps) {
  return (
    <div class="dta-outputs">
      {groups.map((group) => {
        const headingId = `${idPrefix}-${group.id}`
        return (
          <section class="dta-outputs__group" key={group.id} aria-labelledby={headingId}>
            <div class="dta-outputs__head">
              <h3 class="dta-outputs__name" id={headingId}>
                {group.name}
              </h3>
              <span class="dta-outputs__count">{files(group.files.length)}</span>
              <button
                type="button"
                class="dta-button outline dta-outputs__zip"
                onClick={() => onDownloadGroup?.(group.id)}
              >
                {group.downloadLabel}
              </button>
            </div>
            <ul class="dta-outputs__files">
              {group.files.map((file) => (
                <li
                  class="dta-outputs__file"
                  key={file.path}
                  aria-current={file.path === selected ? 'true' : undefined}
                >
                  <button
                    type="button"
                    class="dta-outputs__path"
                    onClick={(event) => onOpen?.(file.path, event.currentTarget)}
                  >
                    {breakable(file.path)}
                  </button>
                  <span class="dta-outputs__size">{file.size}</span>
                  <span class="dta-outputs__actions">
                    <CopyButton text={file.content} accessibleLabel={`Copy ${file.path}`} />
                    <button
                      type="button"
                      class="dta-button quiet"
                      aria-label={`Download ${file.path}`}
                      onClick={() => onDownload?.(file.path)}
                    >
                      Download
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
