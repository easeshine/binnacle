import type { Colour, Sixteen, Style, ThemeLayer, Tokens, Tone } from '../api.ts'
import { backgroundAnsi, foregroundAnsi, parseColor } from '../terminal/pi/colors.ts'
import type { TerminalColorMode } from '../terminal/pi/colors.ts'

export interface Edge {
  readonly topLeft: string
  readonly top: string
  readonly topRight: string
  readonly right: string
  readonly bottomRight: string
  readonly bottom: string
  readonly bottomLeft: string
  readonly left: string
}

const edge = (corners: string, top: string, side: string, bottom = top): Edge => {
  const [topLeft = '', topRight = '', bottomRight = '', bottomLeft = ''] = corners
  return { topLeft, top, topRight, right: side, bottomRight, bottom, bottomLeft, left: side }
}

const ROUNDED = edge('╭╮╯╰', '─', '│')

export const edges: { readonly [name: string]: Edge } = {
  rounded: ROUNDED,
  square: edge('┌┐┘└', '─', '│'),
  heavy: edge('┏┓┛┗', '━', '┃'),
  double: edge('╔╗╝╚', '═', '║'),
  block: { ...edge('▛▜▟▙', '▀', '▌', '▄'), right: '▐' },
  none: edge('    ', ' ', ' '),
}

export function edgeNamed(name: string | undefined, tokens: Tokens): Edge {
  return edges[name ?? tokens.edge] ?? edges[tokens.edge] ?? ROUNDED
}

/** The theme a box is drawn with. */
export interface Theme {
  readonly tokens: Tokens
  paint(tone: Tone, text: string): string
}

// Each default tone is one of the sixteen, or only an attribute, so the person's palette decides how binnacle looks.
export const DEFAULT_TOKENS: Tokens = {
  colors: {
    text: {},
    accent: { color: 'cyan' },
    muted: { color: 'bright-black' },
    dim: { dim: true },
    success: { color: 'green' },
    warning: { color: 'yellow' },
    error: { color: 'red' },
    border: { dim: true },
    borderAccent: { color: 'cyan' },
    borderMuted: { dim: true },
    heading: { color: 'cyan', bold: true },
    code: { color: 'yellow' },
    link: { color: 'blue', underline: true },
    selection: { inverse: true },
  },
  glyphs: { mark: '›', unmarked: ' ', checked: '[x]', unchecked: '[ ]', rule: '─', separator: ' | ', divider: ' · ', more: '…' },
  edge: 'rounded',
  padding: 0,
  gap: 0,
}

const SIXTEEN: readonly Sixteen[] = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'bright-black',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
  'bright-white',
]

const styleOf = (given: Colour | Style): Style => (typeof given === 'object' ? given : { color: given })

/** Throws, naming the Tone, when a layer gives a colour that is not one, so the author learns at load and not at a draw. */
export function checkLayer(layer: ThemeLayer): void {
  for (const [tone, given] of Object.entries(layer.colors ?? {})) {
    const style = given === undefined ? undefined : styleOf(given)
    checkColour(style?.color, `the theme's ${tone}`)
    checkColour(style?.background, `the theme's ${tone}`)
  }
}

function checkColour(color: Colour | undefined, what: string): void {
  if (color === undefined || SIXTEEN.some((sixteen) => sixteen === color)) return
  try {
    parseColor(color)
  } catch {
    throw new Error(`binnacle: ${what} is not a colour: ${JSON.stringify(color).replaceAll('"', "'")}`)
  }
}

/** The layers laid over the defaults, oldest first: each token is the newest layer's that names it. */
export function layered(layers: readonly ThemeLayer[]): Tokens {
  return layers.reduce<Tokens>((tokens, layer) => {
    const colors = { ...tokens.colors }
    // Object.entries widens each key to a string; a layer's colours are keyed by Tone.
    for (const [tone, given] of Object.entries(layer.colors ?? {}) as [Tone, Colour | Style | undefined][])
      if (given !== undefined) colors[tone] = styleOf(given)
    return {
      colors,
      glyphs: { ...tokens.glyphs, ...layer.glyphs },
      edge: layer.edge ?? tokens.edge,
      padding: layer.padding ?? tokens.padding,
      gap: layer.gap ?? tokens.gap,
    }
  }, DEFAULT_TOKENS)
}

// Each attribute is closed by the code that ends it alone, so a style drawn inside another leaves the other standing.
const ATTRIBUTES = [
  ['bold', '1', '22'],
  ['dim', '2', '22'],
  ['italic', '3', '23'],
  ['underline', '4', '24'],
  ['inverse', '7', '27'],
] as const

function opening(color: Colour, mode: TerminalColorMode, behind = false): string {
  const index = SIXTEEN.findIndex((sixteen) => sixteen === color)
  if (index >= 0) {
    // A sixteen's background is its own code, 40 to 47 and 100 to 107, so the person's palette decides how it looks.
    const [on, from] = index < 8 ? [behind ? 40 : 30, 0] : [behind ? 100 : 90, 8]
    return `\x1b[${on + index - from}m`
  }
  const parsed = parseColor(color)
  return behind ? backgroundAnsi(parsed, mode) : foregroundAnsi(parsed, mode)
}

const CLOSES = new Set(['', '0', '22', '23', '24', '27', '39', '49'])
const COLOURS = new Set(['38', '48', '58'])

// A colour's arguments, as the 0 of `38;5;0`, are walked over, so only a real reset or close counts.
function closes(params: string): boolean {
  const parts = params.split(';')
  for (let at = 0; at < parts.length; at++) {
    const [head = '', ...rest] = parts[at]!.split(':')
    if (COLOURS.has(head)) {
      if (rest.length === 0) at += parts[at + 1] === '5' ? 2 : parts[at + 1] === '2' ? 4 : 0
      continue
    }
    if (CLOSES.has(head)) return true
  }
  return false
}

interface Wrap {
  readonly open: string
  readonly close: string
  /** The close with the background left open, as `fill` ends a line. */
  readonly filled: string
}

function wrapOf(style: Style, mode: TerminalColorMode): Wrap {
  let open = ''
  let close = ''
  for (const [name, on, off] of ATTRIBUTES) {
    if (style[name] !== true) continue
    open += `\x1b[${on}m`
    close = `\x1b[${off}m${close}`
  }
  if (style.color !== undefined) {
    open += opening(style.color, mode)
    close = `\x1b[39m${close}`
  }
  const filled = close
  if (style.background !== undefined) {
    open += opening(style.background, mode, true)
    close = `\x1b[49m${close}`
  }
  return { open, close, filled }
}

/** How each Tone, or a Style given as it is, is drawn on a terminal of that many colours. */
export function painter(tokens: Tokens, mode: TerminalColorMode): (given: Tone | Style, text: string) => string {
  return drawer(tokens, mode, false)
}

/** As `paint`, with the background left open at the text's end, so that the line fills the rest of its row. */
export function filler(tokens: Tokens, mode: TerminalColorMode): (given: Tone | Style, text: string) => string {
  return drawer(tokens, mode, true)
}

function drawer(tokens: Tokens, mode: TerminalColorMode, fills: boolean): (given: Tone | Style, text: string) => string {
  const wraps = new Map<Tone, Wrap>()
  // Object.entries widens each key to a string; the theme's colours are keyed by Tone.
  for (const [tone, style] of Object.entries(tokens.colors) as [Tone, Style][]) wraps.set(tone, wrapOf(style, mode))
  const what = fills ? 'fill' : 'paint'
  return (given, text) => {
    if (typeof given === 'object') {
      checkColour(given.color, `${what}'s colour`)
      checkColour(given.background, `${what}'s background`)
    }
    const wrap = typeof given === 'object' ? wrapOf(given, mode) : wraps.get(given)
    if (wrap === undefined) return text
    // A fill of no text opens its background alone, so an empty line fills its row; a paint of no text gives no text.
    if (text === '') return fills && wrap.filled !== wrap.close ? wrap.open : text
    if (wrap.open === '') return text
    // A style painted inside ends with its own close, which can end this one's too, so this one opens again after it.
    const held = text.replace(/\x1b\[([\d;:]*)m/g, (sequence, params: string) => (closes(params) ? sequence + wrap.open : sequence))
    return wrap.open + held + (fills ? wrap.filled : wrap.close)
  }
}
