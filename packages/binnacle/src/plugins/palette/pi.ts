import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Colour, Hue, PaletteSource, Style, ThemeLayer } from '../../index.ts'
// pi's own two themes, copied as data, so that binnacle needs no pi installed.
import dark from '../../terminal/pi/dark.json' with { type: 'json' }
import light from '../../terminal/pi/light.json' with { type: 'json' }

const HUES: readonly Hue[] = [
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
  'orange',
]

// pi names its magenta so.
const ALIASES: { readonly [name: string]: Hue } = { violet: 'magenta', purple: 'magenta' }

const hueOf = (name: string): Hue | undefined => HUES.find((hue) => hue === name) ?? ALIASES[name]

const isObject = (value: unknown): value is { readonly [key: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A colour of pi's, its `vars` followed, as pi follows them: `""` is the terminal's own. */
function resolved(value: unknown, vars: { readonly [name: string]: unknown }, seen: readonly string[] = []): string | number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') throw new Error(`not a colour: ${JSON.stringify(value)}`)
  if (value === '' || value.startsWith('#') || /^ok(lch|hsl)\(/i.test(value)) return value
  if (seen.includes(value)) throw new Error(`the var ${value} makes a loop`)
  if (!(value in vars)) throw new Error(`no var ${value}`)
  return resolved(vars[value], vars, [...seen, value])
}

// The colours that pi's schema asks of every theme; the others fall back as pi's own reader falls back.
const REQUIRED = [
  'accent',
  'border',
  'borderAccent',
  'borderMuted',
  'success',
  'error',
  'warning',
  'muted',
  'dim',
  'text',
  'thinkingText',
  'selectedBg',
  'userMessageBg',
  'userMessageText',
  'customMessageBg',
  'customMessageText',
  'customMessageLabel',
  'toolPendingBg',
  'toolSuccessBg',
  'toolErrorBg',
  'toolTitle',
  'toolOutput',
  'mdHeading',
  'mdLink',
  'mdLinkUrl',
  'mdCode',
  'mdCodeBlock',
  'mdCodeBlockBorder',
  'mdQuote',
  'mdQuoteBorder',
  'mdHr',
  'mdListBullet',
  'toolDiffAdded',
  'toolDiffRemoved',
  'toolDiffContext',
  'syntaxComment',
  'syntaxKeyword',
  'syntaxFunction',
  'syntaxVariable',
  'syntaxString',
  'syntaxNumber',
  'syntaxType',
  'syntaxOperator',
  'syntaxPunctuation',
  'thinkingOff',
  'thinkingMinimal',
  'thinkingLow',
  'thinkingMedium',
  'thinkingHigh',
  'thinkingXhigh',
  'bashMode',
]

/** An optional colour of pi's, and the colour that it is when a theme leaves it out. */
const FALLBACKS: readonly (readonly [string, string])[] = [
  ['scrollbarTrack', 'muted'],
  ['scrollbarThumb', 'text'],
  ['thinkingMax', 'thinkingXhigh'],
  ['searchMatchBg', 'selectedBg'],
  ['searchMatchText', 'text'],
]

/** A theme of pi's, as JSON parsed, read as a theme layer. It throws what is wrong, in one line. */
export function piLayer(theme: unknown): ThemeLayer {
  if (!isObject(theme) || !isObject(theme.colors)) throw new Error('not a pi theme: it has no colors')
  const missing = REQUIRED.filter((tone) => !isObject(theme.colors) || !(tone in theme.colors))
  if (missing.length > 0) throw new Error(`not a pi theme: it has no ${missing.join(', ')}`)
  const vars = isObject(theme.vars) ? theme.vars : {}
  const given: { [tone: string]: unknown } = { ...theme.colors }
  for (const [tone, from] of FALLBACKS) if (!(tone in given)) given[tone] = given[from]
  const colors: { [tone: string]: Colour | Style } = {}
  for (const [tone, value] of Object.entries(given)) {
    const colour = resolved(value, vars)
    // Each of pi's colours named `…Bg` is drawn behind the text.
    colors[tone] = colour === '' ? {} : tone.endsWith('Bg') ? { background: colour } : colour
  }
  // A Hue that no var gives is the terminal's own, whatever a plugin's layer beneath gives it.
  const hues: { [hue in Hue]?: Colour } = Object.fromEntries(HUES.map((hue) => [hue, hue === 'orange' ? 208 : hue]))
  const set = new Set<Hue>()
  // A var named as a Hue gives it before one that pi names so, such as `violet`.
  const named = Object.keys(vars).toSorted((a, b) => Number(ALIASES[a] !== undefined) - Number(ALIASES[b] !== undefined))
  for (const name of named) {
    const hue = hueOf(name)
    if (hue === undefined || set.has(hue)) continue
    set.add(hue)
    const colour = resolved(vars[name], vars)
    if (colour !== '') hues[hue] = colour
  }
  return { hues, colors }
}

const BUILT_IN: { readonly [name: string]: unknown } = { dark, light }

/** pi's own `dark` and `light`. */
export const PI: PaletteSource = {
  name: 'pi',
  list: () => Promise.resolve(Object.keys(BUILT_IN).map((name) => ({ name }))),
  load: async (name) => {
    const theme = BUILT_IN[name]
    if (theme === undefined) throw new Error('not there')
    return piLayer(theme)
  },
}

/** pi's folder of a person's own themes, as pi finds it. */
function themesDir(): string {
  const given = process.env.PI_CODING_AGENT_DIR
  if (given === undefined || given === '') return join(homedir(), '.pi', 'agent', 'themes')
  const expanded = given === '~' ? homedir() : given.startsWith('~/') ? join(homedir(), given.slice(2)) : given
  return join(expanded, 'themes')
}

/** The person's own pi themes, each `*.json` in pi's themes folder, by its file's name, read only when it is loaded. */
export const PI_THEMES: PaletteSource = {
  name: 'pi-themes',
  list: async () => {
    let files: string[]
    try {
      files = readdirSync(themesDir())
    } catch {
      return []
    }
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.slice(0, -'.json'.length))
      .toSorted((a, b) => a.localeCompare(b))
      .map((name) => ({ name }))
  },
  load: async (name) => {
    let text: string
    try {
      text = readFileSync(join(themesDir(), `${name}.json`), 'utf8')
    } catch {
      throw new Error('not there')
    }
    let theme: unknown
    try {
      theme = JSON.parse(text)
    } catch {
      throw new Error('not JSON')
    }
    return piLayer(theme)
  },
}
