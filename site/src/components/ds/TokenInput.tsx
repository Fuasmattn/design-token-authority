/**
 * Where token files come in before anything is loaded (playground spec decisions 2, 14, 15): a
 * drop area that takes the page and is also the button opening the file picker (keyboard and
 * phones, where dragging is not an option), several files at once; "Load example"; and "Paste
 * JSON instead", which swaps the drop area for the paste field (and back). It reads the files and
 * hands them on as `{ fileName, content }`; it does not interpret them.
 *
 * `PasteForm` is the paste field on its own, also used under the SourceBar once something is
 * loaded; `readFiles` reads a FileList the same way for the SourceBar's "Replace files".
 *
 * Motion: the drop area (or the paste field) is the view-transition part `dta-source`, as the
 * SourceBar is, so a page that swaps one for the other inside `transition()` collapses the input
 * into the bar; switching to the paste field and back crossfades.
 *
 * A Preact component (the playground is a Preact island, decision 13); stories render it to
 * static HTML. Buttons use the shared Button.css, so they look like Button.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { transition } from './motion'
import './Button.css'
import './TokenInput.css'

export interface TokenInputFile {
  fileName: string
  content: string
}

export interface TokenInputProps {
  /** Keeps ids unique when a page shows several inputs (docs examples). */
  idPrefix?: string
  /** Name of the example the "Load example" button loads (no button without it). */
  example?: string
  /** Start with the paste field instead of the drop area (stories). */
  paste?: boolean
  /** Text in the paste field at first (stories). */
  pasted?: string
  onFiles?: (files: TokenInputFile[]) => void
  onExample?: () => void
}

/** Name a pasted per-mode file is read under (a plugin export needs no name). */
export const PASTE_FILE_NAME = 'Pasted.Value.json'

export async function readFiles(list: FileList | null | undefined): Promise<TokenInputFile[]> {
  const files = [...(list ?? [])]
  return Promise.all(
    files.map(async (file) => ({ fileName: file.name, content: await file.text() })),
  )
}

export interface PasteFormProps {
  idPrefix: string
  pasted?: string
  /** Focus the field when the form appears (it was opened on request). */
  autoFocus?: boolean
  onFiles?: (files: TokenInputFile[]) => void
  /** Shows a "Cancel" button that closes the form. */
  onCancel?: () => void
}

/** The paste field: one JSON document, with a file name for a per-mode file. */
export function PasteForm({ idPrefix, pasted = '', autoFocus, onFiles, onCancel }: PasteFormProps) {
  const [text, setText] = useState(pasted)
  const [fileName, setFileName] = useState(PASTE_FILE_NAME)
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) field.current?.focus()
  }, [autoFocus])

  return (
    <form
      class="dta-token-input__paste"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim() === '') return
        onFiles?.([{ fileName: fileName.trim() || PASTE_FILE_NAME, content: text }])
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onCancel) {
          event.preventDefault()
          onCancel()
        }
      }}
    >
      <label class="dta-token-input__label" for={`${idPrefix}-paste`}>
        Paste JSON
      </label>
      <textarea
        ref={field}
        id={`${idPrefix}-paste`}
        class="dta-token-input__field dta-token-input__text"
        rows={8}
        spellcheck={false}
        autoComplete="off"
        placeholder={'{ "Colors": { … } }'}
        value={text}
        onInput={(event) => setText(event.currentTarget.value)}
      />
      <div class="dta-token-input__name-row">
        <div class="dta-token-input__name-field">
          <label class="dta-token-input__label" for={`${idPrefix}-name`}>
            File name
          </label>
          <input
            id={`${idPrefix}-name`}
            class="dta-token-input__field dta-token-input__name"
            type="text"
            spellcheck={false}
            autoComplete="off"
            value={fileName}
            aria-describedby={`${idPrefix}-name-help`}
            onInput={(event) => setFileName(event.currentTarget.value)}
          />
        </div>
        <div class="dta-token-input__paste-actions">
          <button type="submit" class="dta-button primary">
            Check pasted JSON
          </button>
          {onCancel && (
            <button type="button" class="dta-button link" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <p class="dta-token-input__help" id={`${idPrefix}-name-help`}>
        File name: for one per-mode file; a plugin export needs none.
      </p>
    </form>
  )
}

export default function TokenInput({
  idPrefix = 'dta-token-input',
  example,
  paste = false,
  pasted = '',
  onFiles,
  onExample,
}: TokenInputProps) {
  const picker = useRef<HTMLInputElement>(null)
  const drop = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(paste)
  // Focus follows a switch the visitor asked for, never the first render.
  const switched = useRef(false)

  useEffect(() => {
    if (switched.current && !pasting) drop.current?.focus()
  }, [pasting])

  const hand = async (list: FileList | null | undefined) => {
    const files = await readFiles(list)
    if (files.length > 0) onFiles?.(files)
  }
  const toggle = () => {
    switched.current = true
    transition(() => setPasting(!pasting), 'dta-read')
  }

  return (
    <div class="dta-token-input">
      {pasting ? (
        <PasteForm
          idPrefix={idPrefix}
          pasted={pasted}
          autoFocus={switched.current}
          onFiles={onFiles}
        />
      ) : (
        <div class="dta-token-input__files">
          <button
            ref={drop}
            type="button"
            class="dta-token-input__drop"
            data-dragging={dragging ? '' : undefined}
            aria-describedby={`${idPrefix}-drop-help`}
            onClick={() => picker.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void hand(event.dataTransfer?.files)
            }}
          >
            <span class="dta-token-input__drop-title">Drop token files</span>
            <span class="dta-token-input__drop-action">or choose files</span>
          </button>
          <p class="dta-token-input__help" id={`${idPrefix}-drop-help`}>
            Per-mode files (<code>{'{Collection}.{Mode}.json'}</code>, several at once) or one
            plugin export. They stay in your browser.
          </p>
          <input
            ref={picker}
            id={`${idPrefix}-picker`}
            class="dta-token-input__picker"
            type="file"
            accept=".json,application/json"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const input = event.currentTarget
              void hand(input.files).then(() => {
                input.value = ''
              })
            }}
          />
        </div>
      )}

      <div class="dta-token-input__actions">
        {example && (
          <>
            <button type="button" class="dta-button outline" onClick={() => onExample?.()}>
              Load example
            </button>
            <span class="dta-token-input__meta">{example}</span>
          </>
        )}
        <span class="dta-token-input__spacer" />
        <button type="button" class="dta-button link" onClick={toggle}>
          {pasting ? 'Choose files instead' : 'Paste JSON instead'}
        </button>
      </div>
    </div>
  )
}
