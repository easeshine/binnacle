import { toPlainText, rowsOf } from '../core/view.ts'
import { visibleWidth } from '../terminal/pi/utils.ts'

export interface WrapPrefixes {
  /** Before the first line. */
  readonly first?: string
  /** Before each line after the first: by default, as many spaces as `first` is wide. */
  readonly rest?: string
}

export interface WrapOptions extends WrapPrefixes {
  /** `true`: the text is Untrusted Text, made plain with its own line breaks kept. The prefixes stay as they are. */
  readonly plain?: boolean
}

// Making a text plain takes its line breaks out with the other controls, so each line is made plain apart.
const plainLines = (text: string): string =>
  text
    .split(/\r\n|\r|\n/)
    .map(toPlainText)
    .join('\n')

/** The text's lines, wrapped at `width` with the prefixes added, as the core wraps a Part's lines: a style that spans a wrap is carried to the next line, and each row ends as the core's rule of a fill leaves it, so a fill fills the row it lands on from its text. */
export function wrap(text: string, width: number, options: WrapOptions = {}): string[] {
  const first = options.first ?? ''
  const rest = options.rest ?? ' '.repeat(visibleWidth(first))
  // One width for every line, so that the text wraps once: the wider prefix sets it.
  const room = Math.max(1, width - Math.max(visibleWidth(first), visibleWidth(rest)))
  const shown = options.plain === true ? plainLines(text) : text
  return rowsOf(shown, room).map((line, at) => (at === 0 ? first : rest) + line)
}
