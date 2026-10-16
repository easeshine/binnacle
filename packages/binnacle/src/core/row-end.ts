const TRAILING_BLANKS = / +$/
const TRAILING_RESET = /\x1b\[0?m$/
const STYLES = /\x1b\[([\d;:]*)m/g

// What each SGR code turns on, by the code that turns it off; bold and dim are both turned off by 22.
const TURNED_OFF_BY: { readonly [code: number]: number } = {
  1: 22,
  2: 22,
  3: 23,
  4: 24,
  5: 25,
  7: 27,
  8: 28,
  9: 29,
  38: 39,
  48: 49,
  58: 59,
}
const offCodeOf = (code: number): number =>
  (code >= 30 && code <= 37) || (code >= 90 && code <= 97)
    ? 39
    : (code >= 40 && code <= 47) || (code >= 100 && code <= 107)
      ? 49
      : (TURNED_OFF_BY[code] ?? -code)

// A border closes only what it opened, so a row can end in a style that is closed: the styles are followed to their end.
// The set holds the code that closes each style still open at the end, so 39 says a colour is open and 49 a background.
function endStylesOf(text: string): { readonly open: Set<number>; readonly background: string } {
  const on = new Set<number>()
  let background = ''
  for (const [, parameters = ''] of text.matchAll(STYLES)) {
    const fields = parameters.split(';')
    for (let at = 0; at < fields.length; at++) {
      // In the colon form, a colour's numbers are subparameters of its own code.
      const [head = '', ...subparameters] = (fields[at] ?? '').split(':')
      const code = Number(head)
      if (code === 0) {
        on.clear()
        background = ''
      } else if (Object.values(TURNED_OFF_BY).includes(code) || code === 39 || code === 49) {
        on.delete(code)
        if (code === 49) background = ''
      } else {
        on.add(offCodeOf(code))
        // The background's own code is kept as it was written, in either form, so that it can open again on the next row.
        if (code === 48 || (code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
          const space = code === 48 && subparameters.length === 0 ? fields[at + 1] : undefined
          background = fields.slice(at, at + (space === '5' ? 3 : space === '2' ? 5 : 1)).join(';')
        }
      }
      // In the semicolon form, a colour by index or by RGB carries its numbers as the parameters after it.
      if ((code === 38 || code === 48 || code === 58) && subparameters.length === 0) {
        const space = fields[at + 1]
        at += space === '5' ? 2 : space === '2' ? 4 : 0
      }
    }
  }
  return { open: on, background }
}

const styledAtEnd = (text: string): boolean => endStylesOf(text).open.size > 0

/** The code of the background still open at the text's end, as `44` or `48;5;4`, in the form it was written; `''` when none. */
export const backgroundAtEnd = (text: string): string => endStylesOf(text).background

/** The background the wrapping of a line reads at its end: the semicolon form alone, so a colour in the colon form is invisible to it. */
export function wrapperBackgroundAtEnd(text: string): string {
  let background = ''
  for (const [, parameters = ''] of text.matchAll(STYLES)) {
    if (parameters.includes(':')) continue
    const fields = parameters.split(';')
    for (let at = 0; at < fields.length; at++) {
      const code = Number(fields[at])
      if (code === 0 || code === 49) background = ''
      else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) background = fields[at]!
      if (code === 38 || code === 48 || code === 58) {
        const space = fields[at + 1]
        if (code === 48 && space === '5' && fields[at + 2] !== undefined) background = fields.slice(at, at + 3).join(';')
        else if (code === 48 && space === '2' && fields[at + 4] !== undefined) background = fields.slice(at, at + 5).join(';')
        at += space === '5' ? 2 : space === '2' ? 4 : 0
      }
    }
  }
  return background
}

/** Whether a background is still open at the text's end: only a fill leaves one open past a line's text. */
export const backgroundOpen = (text: string): boolean => endStylesOf(text).background !== ''

const CLOSES_IN_ORDER = [39, 59, 22, 23, 24, 25, 27, 28, 29] as const

/** The codes that close each style open at the text's end but its background, so that a filled row's padding draws plain text on it. */
export function closesButBackground(text: string): string {
  const on = endStylesOf(text).open
  return CLOSES_IN_ORDER.filter((code) => on.has(code))
    .map((code) => `\x1b[${code}m`)
    .join('')
}

// The display resets the style and clears each row to its end, so the blanks at a row's end in the default style are not
// written. A blank after a colour or a style is kept: it is drawn.
export function withoutBlankEnd(row: string): string {
  let end = row.length
  for (;;) {
    const head = row.slice(0, end)
    const reset = TRAILING_RESET.exec(head)
    if (reset !== null) {
      end = reset.index
      continue
    }
    const blanks = TRAILING_BLANKS.exec(head)
    if (blanks === null || styledAtEnd(head.slice(0, blanks.index))) return head
    end = blanks.index
  }
}

/**
 * The row without the spaces a fill pads it with, its background closed at its text: a separated row draws a nested child's
 * line only as far as its text, and no divider takes its fill. A blank in any other style is drawn, so it is kept.
 */
export function withoutFillEnd(row: string): string {
  let end = row.length
  for (;;) {
    const head = row.slice(0, end)
    const reset = TRAILING_RESET.exec(head)
    if (reset !== null) {
      end = reset.index
      continue
    }
    const blanks = TRAILING_BLANKS.exec(head)
    if (blanks === null) break
    const before = head.slice(0, blanks.index)
    const { open, background } = endStylesOf(before)
    // A fill's padding draws in its background alone; a blank in any other style is drawn, so it is kept.
    if (styledAtEnd(before) && !(background !== '' && open.size === 1)) break
    end = blanks.index
  }
  const cut = row.slice(0, end)
  return backgroundOpen(cut) ? `${cut}\x1b[49m` : cut
}
