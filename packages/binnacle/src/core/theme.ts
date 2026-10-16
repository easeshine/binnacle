import type { Colour, Hue, Sixteen, Style, ThemeLayer, Tokens, Tone } from '../api.ts'
import { DEFAULT_COLORS } from './tones.ts'
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

const HUES: readonly Hue[] = [...SIXTEEN, 'orange']

const isHue = (name: unknown): name is Hue => HUES.some((hue) => hue === name)

// 208 is the orange of the 256 that every terminal of 256 colours draws alike; the sixteen have none.
// Object.fromEntries widens its keys to strings; the entries are one for each Hue.
const DEFAULT_HUES = Object.fromEntries(HUES.map((hue) => [hue, hue === 'orange' ? 208 : hue])) as Tokens['hues']

// Renamed to pi's names before 1.0. A feature written before the rename fails where its author reads it, and does not draw plain.
// A Map, as a Tone's name is open, and a name such as `constructor` is no rename.
const RENAMED: ReadonlyMap<string, Tone> = new Map([
  ['heading', 'mdHeading'],
  ['code', 'mdCode'],
  ['link', 'mdLink'],
  ['selection', 'selectedBg'],
])

function checkName(tone: Tone): void {
  const now = RENAMED.get(tone)
  if (now !== undefined) throw new Error(`binnacle: the Tone '${tone}' is now '${now}'`)
}

const quoted = (value: unknown): string => JSON.stringify(value).replaceAll('"', "'")

const styleOf = (given: Colour | Style): Style => (typeof given === 'object' ? given : { color: given })

/** The tokens with each Tone's Style as a layer gives it, its `like` still to read. */
interface Laid extends Omit<Tokens, 'colors'> {
  readonly colors: ReadonlyMap<string, Style>
}

const DEFAULTS: Laid = {
  colors: new Map<string, Style>(Object.entries(DEFAULT_COLORS)),
  hues: DEFAULT_HUES,
  glyphs: { mark: '›', unmarked: ' ', checked: '[x]', unchecked: '[ ]', rule: '─', separator: ' | ', divider: ' · ', more: '…' },
  edge: 'rounded',
  padding: 0,
  gap: 0,
}

/**
 * Throws when a layer gives a colour or a Hue that is not one, names a Tone renamed to pi's name, or makes a `like` loop, so the author learns at load and not at a draw.
 * `layers` are each layer as they would be with this one, in their order.
 */
export function checkLayer(layer: ThemeLayer, layers: readonly ThemeLayer[]): void {
  for (const [tone, given] of Object.entries(layer.colors ?? {})) {
    checkName(tone)
    const style = given === undefined ? undefined : styleOf(given)
    if (style?.like !== undefined) checkName(style.like)
    checkColour(style?.color, `the theme's ${tone}`)
    checkColour(style?.background, `the theme's ${tone}`)
  }
  for (const [hue, given] of Object.entries(layer.hues ?? {})) {
    if (!isHue(hue)) throw new Error(`binnacle: ${quoted(hue)} is not a Hue`)
    if (given !== undefined) checkHue(hue, given)
  }
  const colors = laid(layers).colors
  for (const tone of Object.keys(layer.colors ?? {})) {
    const loop = loopFrom(tone, colors)
    if (loop !== undefined) throw new Error(`binnacle: the theme's like makes a loop: ${loop.map(quoted).join(' like ')}`)
  }
}

function checkHue(hue: Hue, given: Colour): void {
  const own = given === hue && hue !== 'orange'
  const fails = (): boolean => {
    if (own) return false
    if (isHue(given)) return true
    try {
      parseColor(given)
      return false
    } catch {
      return true
    }
  }
  if (fails()) throw new Error(`binnacle: the Hue ${quoted(hue)} takes a 256-colour index or an exact colour, not ${quoted(given)}`)
}

function checkColour(color: Colour | undefined, what: string): void {
  if (color === undefined || isHue(color)) return
  try {
    parseColor(color)
  } catch {
    throw new Error(`binnacle: ${what} is not a colour: ${quoted(color)}`)
  }
}

/** The Tones from `tone` through each `like` back to it, or `undefined` when the `like`s end. */
function loopFrom(tone: string, colors: ReadonlyMap<string, Style>): readonly string[] | undefined {
  const path = [tone]
  for (let at = colors.get(tone)?.like; at !== undefined; at = colors.get(at)?.like) {
    if (at === tone) return [...path, at]
    // A loop that does not pass through `tone` is not this Tone's to report, and it ends the walk.
    if (path.includes(at)) return undefined
    path.push(at)
  }
  return undefined
}

function laid(layers: readonly ThemeLayer[]): Laid {
  return layers.reduce<Laid>((tokens, layer) => {
    const colors = new Map(tokens.colors)
    for (const [tone, given] of Object.entries(layer.colors ?? {})) if (given !== undefined) colors.set(tone, styleOf(given))
    const hues = { ...tokens.hues }
    // Object.entries widens each key to a string; `checkLayer` refused each key that is not a Hue.
    for (const [hue, given] of Object.entries(layer.hues ?? {}) as [Hue, Colour | undefined][]) if (given !== undefined) hues[hue] = given
    return {
      colors,
      hues,
      glyphs: { ...tokens.glyphs, ...layer.glyphs },
      edge: layer.edge ?? tokens.edge,
      padding: layer.padding ?? tokens.padding,
      gap: layer.gap ?? tokens.gap,
    }
  }, DEFAULTS)
}

const withoutLike = (style: Style): Style =>
  Object.fromEntries(Object.entries(style).filter(([key, value]) => key !== 'like' && value !== undefined))

/** The Style laid over the Tone it is like, as that Tone draws. A `like` of a Tone that no layer gives adds nothing. */
function over(style: Style, drawn: (tone: Tone) => Style | undefined): Style {
  const beneath = style.like === undefined ? undefined : drawn(style.like)
  return { ...beneath, ...withoutLike(style) }
}

/** The layers laid over the defaults, oldest first: each token is the newest layer's that names it, and each Tone's `like` is read. */
export function layered(layers: readonly ThemeLayer[]): Tokens {
  const { colors: given, ...rest } = laid(layers)
  const colors = new Map<string, Style>()
  const drawn = (tone: Tone): Style | undefined => {
    const known = colors.get(tone)
    if (known !== undefined) return known
    const style = given.get(tone)
    if (style === undefined) return undefined
    // A Tone in a loop is left by a layer that went, never by one given, so it draws its own Style alone and no draw throws.
    const made = loopFrom(tone, given) === undefined ? over(style, drawn) : withoutLike(style)
    colors.set(tone, made)
    return made
  }
  for (const tone of given.keys()) drawn(tone)
  // A Map keyed by Tone holds each of pi's Tones, as the defaults give each one.
  return { ...rest, colors: Object.fromEntries(colors) as Tokens['colors'] }
}

// Each attribute is closed by the code that ends it alone, so a style drawn inside another leaves the other standing.
const ATTRIBUTES = [
  ['bold', '1', '22'],
  ['dim', '2', '22'],
  ['italic', '3', '23'],
  ['underline', '4', '24'],
  ['inverse', '7', '27'],
] as const

function opening(given: Colour, hues: Tokens['hues'], mode: TerminalColorMode, behind = false): string {
  const color = isHue(given) ? hues[given] : given
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

function wrapOf(style: Style, hues: Tokens['hues'], mode: TerminalColorMode): Wrap {
  let open = ''
  let close = ''
  for (const [name, on, off] of ATTRIBUTES) {
    if (style[name] !== true) continue
    open += `\x1b[${on}m`
    close = `\x1b[${off}m${close}`
  }
  if (style.color !== undefined) {
    open += opening(style.color, hues, mode)
    close = `\x1b[39m${close}`
  }
  const filled = close
  if (style.background !== undefined) {
    open += opening(style.background, hues, mode, true)
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
  for (const [tone, style] of Object.entries(tokens.colors)) if (style !== undefined) wraps.set(tone, wrapOf(style, tokens.hues, mode))
  const what = fills ? 'fill' : 'paint'
  return (given, text) => {
    if (typeof given === 'object') {
      if (given.like !== undefined) checkName(given.like)
      checkColour(given.color, `${what}'s colour`)
      checkColour(given.background, `${what}'s background`)
    } else checkName(given)
    const wrap =
      typeof given === 'object'
        ? wrapOf(
            over(given, (tone) => tokens.colors[tone]),
            tokens.hues,
            mode,
          )
        : wraps.get(given)
    if (wrap === undefined) return text
    // A fill of no text opens its background alone, so an empty line fills its row; a paint of no text gives no text.
    if (text === '') return fills && wrap.filled !== wrap.close ? wrap.open : text
    if (wrap.open === '') return text
    // A style painted inside ends with its own close, which can end this one's too, so this one opens again after it.
    const held = text.replace(/\x1b\[([\d;:]*)m/g, (sequence, params: string) => (closes(params) ? sequence + wrap.open : sequence))
    return wrap.open + held + (fills ? wrap.filled : wrap.close)
  }
}
