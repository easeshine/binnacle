import { readFileSync, watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Model, PaletteState, ThemeLayer } from '../api.ts'
import { internals } from './internals.ts'
import { createModel } from './model.ts'
import { isColour, isHue, isHueColour, loopIn, quoted, renamedTo } from './theme.ts'

export const PALETTE_FILE = 'palette.json'

// An editor can save in parts; the file is read once, after the last change.
const SETTLE_MS = 50

const KEYS = ['palette', 'hues', 'colors']
const ATTRIBUTES = ['bold', 'dim', 'italic', 'underline', 'inverse']
const STYLE_KEYS = ['like', 'color', 'background', ...ATTRIBUTES]

/** The file as a person writes it: the palette's id, and a theme layer's `hues` and `colors`. */
export interface PaletteFile {
  readonly palette: string | undefined
  readonly hues: NonNullable<ThemeLayer['hues']>
  readonly colors: NonNullable<ThemeLayer['colors']>
}

const NO_FILE: PaletteFile = { palette: undefined, hues: {}, colors: {} }

const isObject = (value: unknown): value is { readonly [key: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** What is wrong with a Tone's colour or Style as the file gives it, or `undefined`. */
function toneFault(tone: string, given: unknown): string | undefined {
  const renamed = renamedTo(tone)
  if (renamed !== undefined) return `the Tone ${quoted(tone)} is now ${quoted(renamed)}`
  if (!isObject(given)) return isColour(given) ? undefined : `the Tone ${tone} is not a colour: ${quoted(given)}`
  for (const [key, value] of Object.entries(given)) {
    if (!STYLE_KEYS.includes(key)) return `the Tone ${tone} has no ${quoted(key)}: a Style takes ${STYLE_KEYS.join(', ')}`
    if (key === 'like') {
      if (typeof value !== 'string') return `the Tone ${tone}'s like is not a Tone: ${quoted(value)}`
      const now = renamedTo(value)
      if (now !== undefined) return `the Tone ${quoted(value)} is now ${quoted(now)}`
    } else if (key === 'color' || key === 'background') {
      if (!isColour(value)) return `the Tone ${tone}'s ${key === 'color' ? 'colour' : key} is not a colour: ${quoted(value)}`
    } else if (typeof value !== 'boolean') return `the Tone ${tone}'s ${key} is not true or false: ${quoted(value)}`
  }
  return undefined
}

/**
 * The file's text read, or what is wrong with it, as the status line says it. No file, or an empty one, is `{}`.
 * `beneath` are the plugins' layers, which a `like` loop is found with.
 */
export function readPaletteFile(text: string | undefined, beneath: readonly ThemeLayer[]): PaletteFile | string {
  if (text === undefined || text.trim() === '') return NO_FILE
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return notJson(error instanceof Error ? error.message : String(error))
  }
  if (!isObject(parsed)) return 'not an object of palette, hues and colors'
  for (const key of Object.keys(parsed)) if (!KEYS.includes(key)) return `${quoted(key)} is not palette, hues or colors`
  const { palette, hues = {}, colors = {} } = parsed
  if (palette !== undefined && typeof palette !== 'string') return `palette is not a name: ${quoted(palette)}`
  if (!isObject(hues)) return `hues is not an object of Hues: ${quoted(hues)}`
  for (const [hue, given] of Object.entries(hues)) {
    if (!isHue(hue)) return `${quoted(hue)} is not a Hue`
    if (!isHueColour(hue, given)) return `the Hue ${quoted(hue)} takes a 256-colour index or an exact colour, not ${quoted(given)}`
  }
  if (!isObject(colors)) return `colors is not an object of Tones: ${quoted(colors)}`
  for (const [tone, given] of Object.entries(colors)) {
    const fault = toneFault(tone, given)
    if (fault !== undefined) return fault
  }
  // Each Hue, colour and Style was checked above.
  const file = { palette, hues, colors } as PaletteFile
  const layer = layerOf(file)
  const loop = loopIn(layer, [...beneath, layer])
  if (loop !== undefined) return `the like makes a loop: ${loop.map(quoted).join(' like ')}`
  return file
}

// V8 says where last, and a line cut at the status line's width loses it, so it goes first.
function notJson(message: string): string {
  const where = /^(.*) in JSON at position \d+ \(line (\d+) column (\d+)\)$/.exec(message)
  return where === null ? `not JSON: ${message}` : `not JSON at line ${where[2]} column ${where[3]}: ${where[1]}`
}

/** The theme layer of the person's own colours, which lies over every plugin's. */
const layerOf = ({ hues, colors }: PaletteFile): ThemeLayer => ({ hues, colors })

/** The profile's folder, as dsh's launcher gives it; a profile that dsh did not launch has none. */
export function profileDir(ctx: Context): string | undefined {
  // dsh's app-boot declares `profileContext`, and binnacle does not depend on it, so the service is read by its name, with the one field that binnacle reads.
  const profile = ctx.get('profileContext' as never) as { readonly dir?: unknown } | undefined
  return typeof profile?.dir === 'string' ? profile.dir : undefined
}

/**
 * The person's own colours, read from `palette.json` in the profile folder and kept as the file changes.
 * A file with a mistake keeps the last good colours, and `error` says what is wrong.
 */
export class PersonsPalette {
  private file = NO_FILE
  // The text last read, which is checked again as the plugins' layers change.
  private text: string | undefined
  // Why the file could not be read the last time, which only a read that works clears.
  private failed: string | undefined
  private readonly own = createModel<{ inUse: string; shown: string; error: string | undefined }>({
    inUse: 'terminal',
    shown: 'terminal',
    error: undefined,
  })
  /** As an author reads it: `set` changes nothing, as only the file does. */
  readonly model: Model<PaletteState> = { state: this.own.state, watch: this.own.watch, set: () => {} }
  private readonly dir: string | undefined
  private readonly beneath: () => readonly ThemeLayer[]
  private readonly restyle: () => void

  /** `beneath` gives each plugin's layer, and `restyle` draws everything again in the theme. */
  constructor(dir: string | undefined, beneath: () => readonly ThemeLayer[], restyle: () => void) {
    this.dir = dir
    this.beneath = beneath
    this.restyle = restyle
  }

  /** The person's layer, which lies over every plugin's. */
  get layer(): ThemeLayer {
    return layerOf(this.file)
  }

  /** Reads the file now, then again after each save, until the plugin unloads. */
  start(ctx: Context): void {
    this.read()
    this.watch(ctx)
  }

  /** Reads the file, and keeps what it holds, or the last good colours with what is wrong. */
  private read(): void {
    if (this.dir === undefined) return
    const read = textOf(join(this.dir, PALETTE_FILE))
    this.failed = typeof read === 'object' ? read.failed : undefined
    if (typeof read !== 'object') this.text = read
    this.recheck()
  }

  /**
   * Checks the text last read with the plugins' layers as they are now, as a layer that comes or goes can make or break a `like` loop with the file's.
   * The file's colours stay only while they make no loop with those layers.
   */
  recheck(): void {
    if (this.failed !== undefined) {
      this.refuse(this.failed)
      return
    }
    const read = readPaletteFile(this.text, this.beneath())
    if (typeof read === 'string') {
      this.refuse(read)
      return
    }
    const changed = read !== this.file || this.own.state.error !== undefined
    this.file = read
    this.own.set((state) => {
      state.inUse = read.palette ?? 'terminal'
      state.error = undefined
    })
    if (changed) this.restyle()
  }

  /** Keeps the last good colours, but for a loop that they make with the plugins' layers now, and says what is wrong. */
  private refuse(why: string): void {
    const layer = layerOf(this.file)
    if (this.file !== NO_FILE && loopIn(layer, [...this.beneath(), layer]) !== undefined) {
      this.file = NO_FILE
      this.restyle()
    }
    this.own.set((state) => {
      state.error = `${PALETTE_FILE}: ${why}`
    })
  }

  private watch(ctx: Context): void {
    const dir = this.dir
    if (dir === undefined) return
    let watcher: FSWatcher | undefined
    let cancel: (() => void) | undefined
    const changed = (): void => {
      cancel?.()
      cancel = internals.later(SETTLE_MS, () => {
        cancel = undefined
        this.read()
      })
    }
    // An editor often saves by a rename, which a watch of the file itself loses, so the folder is watched.
    try {
      watcher = watch(dir, (_, name) => {
        if (name === null || name === PALETTE_FILE) changed()
      })
      watcher.on('error', () => watcher?.close())
    } catch {
      // A profile folder that is not there has no file to watch.
    }
    ctx.effect(
      () => () => {
        cancel?.()
        watcher?.close()
      },
      'binnacle: palette.json',
    )
  }
}

/** The file's text, `undefined` where there is no file, or why a file that is there cannot be read. */
function textOf(path: string): string | undefined | { readonly failed: string } {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    // node's fs throws its own errors, each with a `code`.
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined
    return { failed: `cannot be read: ${error instanceof Error ? error.message : String(error)}` }
  }
}
