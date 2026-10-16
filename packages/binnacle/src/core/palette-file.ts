import { readFileSync, watch, writeFileSync } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeLayer } from '../api.ts'
import { internals } from './internals.ts'
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
 * A file with a mistake keeps the last good colours, and `fault` says what is wrong.
 */
export class PersonsPalette {
  private good = NO_FILE
  // The text last read, which is checked again as the layers beneath change.
  private text: string | undefined
  // Why the file could not be read the last time, which only a read that works clears.
  private failed: string | undefined
  private wrong: string | undefined
  private readonly dir: string | undefined
  private readonly beneath: () => readonly ThemeLayer[]
  private readonly changed: () => void

  /** `beneath` gives each layer beneath the person's, and `changed` runs after the file's colours, its palette or its fault change. */
  constructor(dir: string | undefined, beneath: () => readonly ThemeLayer[], changed: () => void) {
    this.dir = dir
    this.beneath = beneath
    this.changed = changed
  }

  /** The file as it was last read with no mistake. */
  get file(): PaletteFile {
    return this.good
  }

  /** The file's text as it was last read, `''` for no file. */
  get lastText(): string {
    return this.text ?? ''
  }

  /** What is wrong with the file, as `palette.json: ` and why, or `undefined`. */
  get fault(): string | undefined {
    return this.wrong
  }

  /** The person's layer, which lies over every other. */
  get layer(): ThemeLayer {
    return layerOf(this.good)
  }

  /** Reads the file now, then again after each save, until the plugin unloads. */
  start(ctx: Context): void {
    this.read()
    this.watch(ctx)
  }

  /** Reads the file, and keeps what it holds, or the last good colours with what is wrong. It gives the file's text read, or `undefined` with a mistake. */
  read(): string | undefined {
    if (this.dir === undefined) return ''
    const read = textOf(join(this.dir, PALETTE_FILE))
    this.failed = typeof read === 'object' ? read.failed : undefined
    if (typeof read !== 'object') this.text = read
    this.recheck()
    return this.wrong === undefined ? (this.text ?? '') : undefined
  }

  /**
   * Writes `palette` into the file's text, as `read` gave it, with each other key kept, or takes it out for `undefined`.
   * It gives why the write failed, or `undefined`.
   */
  write(text: string, palette: string | undefined): string | undefined {
    if (this.dir === undefined) return `${PALETTE_FILE}: there is no profile folder`
    // `read` gave the text only when it held an object, or nothing.
    const held = (text.trim() === '' ? {} : JSON.parse(text)) as { [key: string]: unknown }
    const { palette: _, ...rest } = held
    const written = palette === undefined ? rest : { palette, ...rest }
    try {
      writeFileSync(join(this.dir, PALETTE_FILE), `${JSON.stringify(written, null, 2)}\n`)
    } catch (error) {
      return `${PALETTE_FILE}: cannot be written: ${error instanceof Error ? error.message : String(error)}`
    }
    this.read()
    return undefined
  }

  /**
   * Checks the text last read with the layers beneath as they are now, as a layer that comes or goes can make or break a `like` loop with the file's.
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
    const changed = read !== this.good || this.wrong !== undefined
    this.good = read
    this.wrong = undefined
    if (changed) this.changed()
  }

  /** Keeps the last good colours, but for a loop that they make with the layers beneath now, and says what is wrong. */
  private refuse(why: string): void {
    const layer = layerOf(this.good)
    if (this.good !== NO_FILE && loopIn(layer, [...this.beneath(), layer]) !== undefined) this.good = NO_FILE
    this.wrong = `${PALETTE_FILE}: ${why}`
    this.changed()
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
