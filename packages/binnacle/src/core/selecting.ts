import type { Part, Screen, SelectionState } from '../api.ts'
import { getGraphemeCellRange, getWordSegmenter, sliceByColumn, visibleWidth } from '../terminal/pi/utils.ts'
import type { Pointer } from './actions.ts'
import type { Hit, Placed } from './arranged.ts'
import { internals } from './internals.ts'
import { toPlainText } from './view.ts'

// pi's window for a double and a triple click.
const MULTI_CLICK_MS = 500
// pi's step of the scroll while a drag is held past the edge of what it selects in.
const EDGE_SCROLL_MS = 50
// As a terminal selects a word, a path and a kebab-case name stay whole, as pi keeps them.
const JOINERS = new Set(['/', '-'])
const words = getWordSegmenter()

/** A row of the Part's rows, and a column in cells. */
interface Spot {
  readonly row: number
  readonly column: number
}

/** The cells from `from` up to `to`, which is not one of them. */
interface Span {
  readonly from: Spot
  readonly to: Spot
}

/** What a drag grows the Selection by: a double click's words, or a triple click's lines. */
type Unit = 'cell' | 'word' | 'line'

interface Held {
  readonly place: string
  readonly part: Part
  readonly width: number
  readonly screen: Screen
  readonly unit: Unit
  readonly anchor: Span
  focus: Span
  /** The plain rows that it covers, as they were when it changed, so that a change to them clears it. */
  texts: readonly string[]
}

interface Pressed {
  readonly at: Pointer
  readonly gesture: string
  /** 1, 2 or 3: a click, a double click or a triple click. */
  readonly count: number
  pointer: Pointer
  moved: boolean
  /** Its Selection was cleared while the button was held: its release copies nothing and clicks nothing. */
  ended: boolean
}

interface Clicked {
  readonly at: number
  readonly count: number
  readonly screen: Screen
  readonly place: string
  readonly word: Span
}

/** What the Selection reads of the Places as they were last drawn, and what it does with them. */
export interface Surface {
  readonly screen: Screen
  placed(place: string): Placed | undefined
  hitAt(x: number, y: number): Hit | undefined
  partIn(place: string): Part | undefined
  rowsOf(part: Part, width: number): readonly string[]
  lineRowsAt(part: Part, width: number, row: number): { readonly first: number; readonly last: number } | undefined
  /** Moves the Place up by rows, or down while negative, and draws. */
  scroll(place: string, rows: number): void
  click(x: number, y: number, gesture: string): void
  /** A release that ends with a Selection: the gesture `select`. */
  select(): void
  changed(selected: SelectionState['selected']): void
  draw(): void
}

const before = (a: Spot, b: Spot): boolean => a.row < b.row || (a.row === b.row && a.column < b.column)
const sameSpan = (a: Span, b: Span): boolean =>
  a.from.row === b.from.row && a.from.column === b.from.column && a.to.row === b.to.row && a.to.column === b.to.column
const clamp = (value: number, least: number, most: number): number => Math.max(least, Math.min(most, value))

/** The columns from `from` up to `to` on a row, each end widened to a whole grapheme. */
function widened(row: string, from: number, to: number): { readonly start: number; readonly end: number } {
  const start = getGraphemeCellRange(row, from)?.start ?? from
  const end = to > from ? (getGraphemeCellRange(row, to - 1)?.end ?? to) : to
  return { start, end: Math.max(start, end) }
}

/** The word under the column, joined across `/` and `-`, or none on a blank or a mark. */
function wordAt(row: string, line: number, column: number): Span | undefined {
  const pieces: { start: number; end: number; word: boolean; joiner: boolean }[] = []
  let start = 0
  for (const { segment, isWordLike } of words.segment(toPlainText(row))) {
    const end = start + visibleWidth(segment)
    const joiner = JOINERS.has(segment)
    pieces.push({ start, end, word: isWordLike === true || joiner, joiner })
    start = end
  }
  const at = pieces.findIndex((piece) => column >= piece.start && column < piece.end)
  if (at < 0 || !pieces[at]!.word) return undefined
  const joins = (left: (typeof pieces)[number], right: (typeof pieces)[number]): boolean =>
    left.word && right.word && (left.joiner || right.joiner)
  let first = at
  while (first > 0 && joins(pieces[first - 1]!, pieces[first]!)) first--
  let last = at
  while (last < pieces.length - 1 && joins(pieces[last]!, pieces[last + 1]!)) last++
  return { from: { row: line, column: pieces[first]!.start }, to: { row: line, column: pieces[last]!.end } }
}

/** A drag selects the cells it crosses in the Place where it was pressed, and a release copies them; a press that does not move clicks on its release. */
export class Selecting {
  readonly #surface: Surface
  #held: Held | undefined
  #pressed: Pressed | undefined
  #clicked: Clicked | undefined
  // What the model was last told, so that it changes only when the Selection does.
  #told: SelectionState['selected']
  #edge: { direction: number; cancel: (() => void) | undefined } = { direction: 0, cancel: undefined }

  constructor(surface: Surface) {
    this.#surface = surface
  }

  /** The Selection, as the model `selection` names it. */
  selected(): SelectionState['selected'] {
    const held = this.#held
    const span = held === undefined ? undefined : this.#span(held)
    if (held === undefined || span === undefined) return undefined
    const rows = this.#surface.rowsOf(held.part, held.width)
    const lines: string[] = []
    for (let row = span.from.row; row <= span.to.row; row++) {
      const { start, end } = this.#columns(rows[row] ?? '', row, span, held.width)
      lines.push(toPlainText(sliceByColumn(rows[row] ?? '', start, end - start, true)).trimEnd())
    }
    return { place: held.place, text: lines.join('\n') }
  }

  press(at: Pointer, gesture: string): void {
    this.#stopEdge()
    const cleared = this.#held !== undefined
    if (cleared) this.#clear()
    const placed = this.#surface.hitAt(at.x, at.y)?.placed
    const part = placed === undefined ? undefined : this.#surface.partIn(placed.place)
    const spot = placed === undefined || part === undefined ? undefined : this.#spotAt(placed, part, at)
    if (placed === undefined || part === undefined || spot === undefined) {
      this.#clicked = undefined
      this.#pressed = { at, gesture, count: 1, pointer: at, moved: false, ended: false }
      if (cleared) this.#surface.draw()
      return
    }
    const width = placed.content.width
    const word = wordAt(this.#surface.rowsOf(part, width)[spot.row] ?? '', spot.row, spot.column)
    const count = this.#count(placed.place, word)
    this.#pressed = { at, gesture, count, pointer: at, moved: false, ended: false }
    const unit: Unit = count === 2 ? 'word' : count === 3 ? 'line' : 'cell'
    const anchor = this.#spanOf(unit, part, width, spot) ?? this.#spanOf('cell', part, width, spot)!
    this.#held = { place: placed.place, part, width, screen: this.#surface.screen, unit, anchor, focus: anchor, texts: [] }
    this.#changed()
    if (cleared || unit !== 'cell') this.#surface.draw()
  }

  motion(at: Pointer): void {
    const pressed = this.#pressed
    if (pressed === undefined || pressed.ended) return
    if (!pressed.moved && at.x === pressed.at.x && at.y === pressed.at.y) return
    pressed.moved = true
    pressed.pointer = at
    this.#clicked = undefined
    if (this.#held === undefined) return
    this.#extend(at)
    this.#followEdge(at)
    this.#surface.draw()
  }

  release(at: Pointer): void {
    const pressed = this.#pressed
    this.#pressed = undefined
    this.#stopEdge()
    if (pressed === undefined || pressed.ended) return
    // A terminal can report a release away from the press with no motion before it.
    if (!pressed.moved && (at.x !== pressed.at.x || at.y !== pressed.at.y)) {
      pressed.moved = true
      this.#clicked = undefined
      if (this.#held !== undefined) this.#extend(at)
    }
    if (this.selected() === undefined) {
      this.#held = undefined
      if (pressed.moved) this.#surface.draw()
      else if (pressed.count === 1) this.#surface.click(pressed.at.x, pressed.at.y, pressed.gesture)
      return
    }
    this.#surface.draw()
    this.#surface.select()
  }

  /** The rows drawn, with the Selection painted over the cells where its Place shows. A change to what it covers clears it first. */
  drawn(rows: string[], placed: readonly Placed[], hits: readonly Hit[], paint: (text: string) => string): string[] {
    const held = this.#held
    const span = held === undefined ? undefined : this.#span(held)
    // A press that has not moved holds no Selection yet, so a change under it, such as a card's time, leaves its click.
    if (held === undefined || span === undefined) return rows
    const shown = placed.find(({ place }) => place === held.place)
    if (shown === undefined || !this.#still(held, shown)) {
      this.#clear()
      return rows
    }
    const partRows = this.#surface.rowsOf(held.part, held.width)
    const { top, left, height } = shown.content
    for (let y = top; y < top + height; y++) {
      const row = shown.shownFrom + y - top
      if (row < span.from.row || row > span.to.row) continue
      const { start, end } = this.#columns(partRows[row] ?? '', row, span, held.width)
      let run: number | undefined
      // A float keeps its own cells, so the Selection is painted only where its Place is the topmost.
      for (let x = left + start; x <= left + end; x++) {
        const own =
          x < left + end &&
          hits.find((hit) => y >= hit.top && y < hit.top + hit.height && x >= hit.left && x < hit.left + hit.width)?.placed === shown
        if (own) run ??= x
        else if (run !== undefined) {
          rows[y] = highlighted(rows[y] ?? '', run, x, paint)
          run = undefined
        }
      }
    }
    return rows
  }

  #still(held: Held, shown: Placed): boolean {
    if (this.#surface.screen !== held.screen || this.#surface.partIn(held.place) !== held.part || shown.content.width !== held.width)
      return false
    const texts = this.#texts(held)
    return texts.length === held.texts.length && texts.every((text, index) => text === held.texts[index])
  }

  #clear(): void {
    this.#held = undefined
    this.#stopEdge()
    if (this.#pressed !== undefined) this.#pressed.ended = true
    this.#changed()
  }

  #changed(): void {
    const held = this.#held
    if (held !== undefined) held.texts = this.#texts(held)
    const selected = this.selected()
    if (selected?.place === this.#told?.place && selected?.text === this.#told?.text) return
    this.#told = selected
    this.#surface.changed(selected)
  }

  /** The plain rows from the first that the anchor or the focus covers to the last. */
  #texts(held: Held): readonly string[] {
    const rows = this.#surface.rowsOf(held.part, held.width)
    const first = Math.min(held.anchor.from.row, held.focus.from.row)
    const last = Math.max(held.anchor.to.row, held.focus.to.row)
    return rows.slice(first, last + 1).map(toPlainText)
  }

  #extend(at: Pointer): void {
    const held = this.#held!
    const placed = this.#surface.placed(held.place)
    const spot = placed === undefined ? undefined : this.#spotAt(placed, held.part, at)
    if (spot === undefined) return
    held.focus = this.#spanOf(held.unit, held.part, held.width, spot) ?? held.focus
    this.#changed()
  }

  /** None while the drag is back on the cell it was pressed on. */
  #span(held: Held): Span | undefined {
    const { anchor, focus } = held
    if (held.unit === 'cell' && sameSpan(anchor, focus)) return undefined
    return { from: before(focus.from, anchor.from) ? focus.from : anchor.from, to: before(anchor.to, focus.to) ? focus.to : anchor.to }
  }

  #spanOf(unit: Unit, part: Part, width: number, spot: Spot): Span | undefined {
    if (unit === 'word') return wordAt(this.#surface.rowsOf(part, width)[spot.row] ?? '', spot.row, spot.column)
    if (unit === 'line') {
      const line = this.#surface.lineRowsAt(part, width, spot.row)
      return line === undefined ? undefined : { from: { row: line.first, column: 0 }, to: { row: line.last, column: width } }
    }
    return { from: spot, to: { row: spot.row, column: spot.column + 1 } }
  }

  #columns(row: string, at: number, span: Span, width: number): { readonly start: number; readonly end: number } {
    return widened(row, at === span.from.row ? span.from.column : 0, at === span.to.row ? span.to.column : width)
  }

  /** The cell of the Part's rows under the pointer, kept inside the rows the Place shows; past the Part's last row, the end of that row. */
  #spotAt(placed: Placed, part: Part, at: Pointer): Spot | undefined {
    const { top, left, width, height } = placed.content
    const rows = this.#surface.rowsOf(part, width)
    if (rows.length === 0 || width < 1 || height < 1) return undefined
    const row = placed.shownFrom + clamp(at.y - top, 0, height - 1)
    if (row >= rows.length) return { row: rows.length - 1, column: width - 1 }
    return { row, column: clamp(at.x - left, 0, width - 1) }
  }

  /** A press on the word of the press before, in its Place, within its window, counts on from it, up to a triple click. */
  #count(place: string, word: Span | undefined): number {
    const now = internals.now()
    const last = this.#clicked
    const screen = this.#surface.screen
    const again =
      word !== undefined &&
      last !== undefined &&
      now - last.at <= MULTI_CLICK_MS &&
      last.screen === screen &&
      last.place === place &&
      sameSpan(last.word, word)
    const count = again ? (last.count % 3) + 1 : 1
    this.#clicked = word === undefined ? undefined : { at: now, count, screen, place, word }
    return count
  }

  #followEdge(at: Pointer): void {
    const placed = this.#surface.placed(this.#held!.place)
    if (placed === undefined) return this.#stopEdge()
    const { top, height } = placed.content
    this.#edge.direction = at.y < top ? 1 : at.y >= top + height ? -1 : 0
    if (this.#edge.direction === 0) return this.#stopEdge()
    this.#edge.cancel ??= internals.later(EDGE_SCROLL_MS, this.#step)
  }

  readonly #step = (): void => {
    this.#edge.cancel = undefined
    const { direction } = this.#edge
    const pressed = this.#pressed
    const held = this.#held
    const placed = held === undefined ? undefined : this.#surface.placed(held.place)
    if (pressed === undefined || pressed.ended || held === undefined || placed === undefined || direction === 0) return
    if (direction > 0 ? placed.shownFrom <= 0 : placed.shownFrom >= placed.maxScroll) return
    this.#surface.scroll(held.place, direction)
    this.#extend(pressed.pointer)
    this.#surface.draw()
    this.#edge.cancel = internals.later(EDGE_SCROLL_MS, this.#step)
  }

  #stopEdge(): void {
    this.#edge.cancel?.()
    this.#edge = { direction: 0, cancel: undefined }
  }
}

/** The row with the cells from `start` up to `end` painted, up to where its text ends. */
function highlighted(row: string, start: number, end: number, paint: (text: string) => string): string {
  const width = visibleWidth(row)
  const to = Math.min(end, width)
  if (to <= start) return row
  const head = sliceByColumn(row, 0, start, true)
  const body = sliceByColumn(row, start, to - start, true)
  const tail = sliceByColumn(row, to, width - to, true)
  return head + paint(body) + tail
}
