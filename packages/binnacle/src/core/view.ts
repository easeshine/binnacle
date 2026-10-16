import type { Part, Point } from '../api.ts'
import { stripTerminalSequences, visibleWidth, wrapTextWithAnsi } from '../terminal/pi/utils.ts'
import { backgroundAtEnd, backgroundOpen, closesButBackground, wrapperBackgroundAtEnd } from './row-end.ts'

// Stripping sequences leaves single controls that a terminal still obeys: C0 but the tab, DEL, and C1.
const CONTROLS = /[\x00-\x08\x0a-\x1f\x7f-\x9f]/g
// pi-tui's width counts a tab as three columns, so a tab is drawn as three spaces.
const TAB = '   '

// Select Graphic Rendition: colour and style, and nothing that moves the cursor or changes the terminal.
const SGR = /(\x1b\[[\d;:]*m)/

/** Untrusted Text, made plain: every control sequence is taken out. */
export function toPlainText(untrusted: string): string {
  return stripTerminalSequences(untrusted).replace(CONTROLS, '').replaceAll('\t', TAB)
}

function toStyledText(line: string): string {
  return line
    .split(SGR)
    .map((piece, index) => (index % 2 === 1 ? piece : toPlainText(piece)))
    .join('')
}

// The first code a row starts with: the state the wrapper carried to it, or none when the row starts with text.
const CARRIED = /^\x1b\[[\d;:]*m/

// The wrapper carries each style over a wrap, but a colour in the colon form it does not read: it drops that colour, or
// holds an older background from before it. The background open at a row's end is set right at the next row's start.
function carried(rows: readonly string[]): readonly string[] {
  const read = rows.map(wrapperBackgroundAtEnd)
  let open = ''
  return rows.map((row, at) => {
    // What the wrapper read at the row before is its carry; the background as it was written is the truth it is set to.
    const fixed =
      at === 0 || open === read[at - 1]
        ? row
        : read[at - 1] !== ''
          ? row.replace(CARRIED, (code) => `${code}\x1b[49m\x1b[${open}m`)
          : backgroundAtEnd(CARRIED.exec(row)?.[0] ?? '') === ''
            ? `\x1b[${open}m${row}`
            : row
    open = backgroundAtEnd(fixed)
    return fixed
  })
}

/**
 * A line's rows, wrapped at the width, each ended by the one rule of a fill, read on the whole line before it wraps: a line whose
 * background is open at its end is filled, and each of its rows keeps the background open at its end with every other style closed;
 * any other line's rows close their background too, so a painted one stops at its text on every row it wraps to.
 */
export function rowsOf(text: string, width: number): readonly string[] {
  const rows = carried(wrapTextWithAnsi(text, width))
  if (backgroundOpen(text)) return rows.map((row) => row + closesButBackground(row))
  return rows.map((row) => (backgroundOpen(row) ? `${row}\x1b[49m` : row))
}

const rowsOfLine = (line: string, width: number): readonly string[] => rowsOf(toStyledText(line), width)

interface Wrapped {
  readonly width: number
  readonly lines: readonly string[]
  // The cursor is found in its own line's rows, and the layout reads all of them.
  readonly rowsOfLines: readonly (readonly string[])[]
  readonly rows: readonly string[]
}

/** Each Part's lines, wrapped at a width, kept until the Part redraws. A draw then costs only what changed. */
export class Rows {
  private wrapped = new WeakMap<Part, Wrapped>()
  // A Part such as the transcript redraws on each delta with nearly every line as it was, so each line is wrapped once.
  private byLine = new WeakMap<Part, { width: number; rows: Map<string, readonly string[]> }>()
  private readonly wrap: (line: string, width: number) => readonly string[]

  constructor(wrap: (line: string, width: number) => readonly string[] = rowsOfLine) {
    this.wrap = wrap
  }

  forget(part: Part): void {
    this.wrapped.delete(part)
  }

  forgetAll(): void {
    this.wrapped = new WeakMap()
  }

  of(part: Part | undefined, width: number): readonly string[] {
    return part === undefined ? [] : this.#wrapped(part, width).rows
  }

  #wrapped(part: Part, width: number): Wrapped {
    const kept = this.wrapped.get(part)
    if (kept?.width === width) return kept
    const lines = width < 1 ? [] : part.lines(width)
    let known = this.byLine.get(part)
    if (known?.width !== width) {
      known = { width, rows: new Map() }
      this.byLine.set(part, known)
    }
    const seen = new Map<string, readonly string[]>()
    const rowsOfLines = lines.map((line) => {
      const rows = seen.get(line) ?? known.rows.get(line) ?? this.wrap(line, width)
      seen.set(line, rows)
      return rows
    })
    // Only the lines the Part still has are kept, so a line it took away is not held.
    known.rows = seen
    const wrapped = { width, lines, rowsOfLines, rows: rowsOfLines.flat() }
    this.wrapped.set(part, wrapped)
    return wrapped
  }

  firstLineOf(part: Part | undefined, width: number): string | undefined {
    if (part === undefined || width < 1) return undefined
    const [first] = this.#wrapped(part, width).lines
    return first === undefined ? undefined : toStyledText(first)
  }

  cursorOf(part: Part | undefined, width: number): { row: number; column: number } | undefined {
    const cursor = part?.cursor?.(width)
    if (part === undefined || cursor === undefined || width < 1) return undefined
    const { lines, rowsOfLines } = this.#wrapped(part, width)
    const before = rowsOfLines.slice(0, cursor.line).reduce((rows, wrapped) => rows + wrapped.length, 0)
    // A wrap drops the blanks where it breaks, so each row is found in the line to know the column it starts at.
    const starts = this.#startsOf(lines, rowsOfLines, cursor.line)
    const row = Math.max(
      0,
      starts.findLastIndex((start) => start <= cursor.column),
    )
    return { row: before + row, column: cursor.column - (starts[row] ?? 0) }
  }

  /** A row of the Part's rows and a column on it, as the Part's line and the column in that line. A column past a row's end is past its line's, on a wrapped line's last row from where the row starts. */
  pointAt(part: Part, width: number, row: number, column: number): Point | undefined {
    if (width < 1) return undefined
    const { lines, rowsOfLines } = this.#wrapped(part, width)
    let before = 0
    let line = -1
    for (let nth = 0; nth < rowsOfLines.length; nth++) {
      const rows = rowsOfLines[nth]!.length
      if (row < before + rows) {
        line = nth
        break
      }
      before += rows
    }
    if (line === -1) return undefined
    const starts = this.#startsOf(lines, rowsOfLines, line)
    return { line, column: (starts[row - before] ?? 0) + column }
  }

  /** The first and the last of the Part's rows that the line on that row wraps to. */
  lineRowsAt(part: Part, width: number, row: number): { readonly first: number; readonly last: number } | undefined {
    if (width < 1) return undefined
    let first = 0
    for (const rows of this.#wrapped(part, width).rowsOfLines) {
      if (row < first + rows.length) return { first, last: first + rows.length - 1 }
      first += rows.length
    }
    return undefined
  }

  #startsOf(lines: readonly string[], rowsOfLines: readonly (readonly string[])[], line: number): readonly number[] {
    const plain = toPlainText(lines[line] ?? '')
    let from = 0
    return (rowsOfLines[line] ?? []).map((wrapped) => {
      const text = toPlainText(wrapped)
      const at = Math.max(from, plain.indexOf(text, from))
      from = at + text.length
      return visibleWidth(plain.slice(0, at))
    })
  }
}
