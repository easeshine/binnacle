import type { Context } from '@deepseek-ai/cordis'
import type { Model, PaletteSource, PaletteState, ThemeLayer } from '../api.ts'
import { internals } from './internals.ts'
import { createModel } from './model.ts'
import { PALETTE_FILE, PersonsPalette, profileDir } from './palette-file.ts'
import { checkLayer } from './theme.ts'

/** The id of binnacle's defaults, which no source's palette has, as a source's ids have a slash. */
export const TERMINAL = 'terminal'

const SOURCE_NAME = /^[A-Za-z0-9-]+$/
// As pi waits for a terminal's colours before it first draws.
const START_WAIT_MS = 100
const START_LIMIT_MS = 5000

/** A palette asked for: only the newest draws. */
interface Request {
  readonly id: string
  /** Asked for as the one that the file names: at the start, at a save that changed it, and by `showPalette(undefined)`. */
  readonly fromFile: boolean
  settled: boolean
}

/** A palette that is not there, as a load that rejects is told from it. */
class Missing extends Error {}

const aborted = (): DOMException => new DOMException('a later palette took its place', 'AbortError')

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/^binnacle: /, '')

/** Drops the rejection of a request that no caller waits on. */
const unwaited = (promise: Promise<unknown>): void => {
  promise.catch(() => {})
}

/**
 * The person's palette: the file, the palette that it names or that is shown, and the sources that palettes come from.
 * The palette's layer lies between the plugins' layers and the person's own.
 */
export class Palettes {
  readonly person: PersonsPalette
  private readonly own = createModel<{ inUse: string; shown: string; error: string | undefined }>({
    inUse: TERMINAL,
    shown: TERMINAL,
    error: undefined,
  })
  /** As an author reads it: `set` changes nothing, as only the file does. */
  readonly model: Model<PaletteState> = { state: this.own.state, watch: this.own.watch, set: () => {} }
  // Each a field of one object, as a method can run on a copy that Cordis traces.
  private readonly now: {
    layer: ThemeLayer | undefined
    shown: string
    inUse: string | undefined
    newest: Request | undefined
    paletteFault: string | undefined
    writeFault: string | undefined
    // The file's text when a write failed: the warning stays until the file changes.
    writeFailedOn: string | undefined
    started: boolean
    settledAtStart: (() => void) | undefined
    cancelStart: () => void
  } = {
    layer: undefined,
    shown: TERMINAL,
    inUse: undefined,
    newest: undefined,
    paletteFault: undefined,
    writeFault: undefined,
    writeFailedOn: undefined,
    started: false,
    settledAtStart: undefined,
    cancelStart: () => {},
  }
  private readonly sources: () => readonly PaletteSource[]
  private readonly plugins: () => readonly ThemeLayer[]
  private readonly restyle: () => void

  /** `plugins` gives each plugin's layer, `sources` each source, and `restyle` draws everything again in the theme. */
  constructor(ctx: Context, plugins: () => readonly ThemeLayer[], sources: () => readonly PaletteSource[], restyle: () => void) {
    this.plugins = plugins
    this.sources = sources
    this.restyle = restyle
    this.person = new PersonsPalette(
      profileDir(ctx),
      () => [...plugins(), ...this.layers()],
      () => this.fileChanged(),
    )
    this.person.start(ctx)
    ctx.effect(() => () => this.now.cancelStart(), 'binnacle: the wait for the palette at the start')
    const start = this.now.newest
    if (start !== undefined) {
      const cancel = internals.later(START_LIMIT_MS, () => {
        if (this.now.newest !== start || start.settled) return
        this.now.paletteFault = `${PALETTE_FILE}: ${start.id} did not load`
        this.update()
      })
      ctx.effect(() => cancel, 'binnacle: the palette at the start')
    }
  }

  /** The palette's layer, beneath the person's own; none for `terminal`. */
  layers(): readonly ThemeLayer[] {
    return this.now.layer === undefined ? [] : [this.now.layer]
  }

  /** Calls `open` once the palette that the file names draws, or after 100 ms, unless the core unloads first. */
  opened(open: () => void): void {
    let done = false
    const go = (): void => {
      if (done) return
      done = true
      cancel()
      this.now.settledAtStart = undefined
      this.now.started = true
      this.update()
      open()
    }
    const cancel = internals.later(START_WAIT_MS, go)
    this.now.settledAtStart = go
    this.now.cancelStart = () => {
      done = true
      cancel()
    }
    if (this.now.newest === undefined || this.now.newest.settled) go()
  }

  /** Throws when the source's name is not one, or another source has it. */
  check(source: PaletteSource): void {
    if (!SOURCE_NAME.test(source.name)) throw new Error(`binnacle: a palette source's name is letters, digits and -, not '${source.name}'`)
    if (this.sources().some((other) => other.name === source.name))
      throw new Error(`binnacle: a palette source named '${source.name}' is there already`)
  }

  /** A source came: the palette that the file names draws, if it is that source's and no later request began. */
  came(source: PaletteSource): void {
    const newest = this.now.newest
    if (newest?.fromFile !== true || !newest.id.startsWith(`${source.name}/`) || this.now.shown === newest.id) return
    // The start waits for it again, as the source came before binnacle first drew.
    newest.settled = false
    unwaited(this.drawn(newest))
  }

  /** A source went: a palette of its that is shown draws no more. */
  went(source: PaletteSource): void {
    if (this.now.shown.startsWith(`${source.name}/`)) unwaited(this.show(undefined))
  }

  /** The person's file is checked again, as a plugin's layer came or went. */
  recheck(): void {
    this.person.recheck()
  }

  show(id: string | undefined): Promise<void> {
    return this.drawn(this.begin(id))
  }

  async pick(id: string): Promise<void> {
    const request = this.begin(id)
    try {
      await this.picked(request)
    } finally {
      this.settle(request)
    }
  }

  private async picked(request: Request): Promise<void> {
    const { id } = request
    const layer = await this.loaded(request)
    const text = this.person.read()
    if (text === undefined) throw new Error(this.person.fault)
    // A save read just now can have begun a request of its own.
    if (this.now.newest !== request) throw aborted()
    const palette = id === TERMINAL ? undefined : id
    // The file read back names the palette picked, which begins no request of its own.
    const was = this.now.inUse
    this.now.inUse = palette
    const failed = this.person.write(text, palette)
    if (failed !== undefined) {
      this.now.inUse = was
      this.now.writeFault = failed
      this.now.writeFailedOn = text
      this.update()
      throw new Error(failed)
    }
    this.now.paletteFault = undefined
    this.now.writeFault = undefined
    this.draw(layer, id)
  }

  private begin(id: string | undefined): Request {
    const request: Request = { id: id ?? this.now.inUse ?? TERMINAL, fromFile: id === undefined, settled: false }
    this.now.newest = request
    return request
  }

  private async drawn(request: Request): Promise<void> {
    const layer = await this.loaded(request)
    if (request.fromFile) this.now.paletteFault = undefined
    this.draw(layer, request.id)
    // The first draw waits for this, so the palette is laid before it.
    this.settle(request)
  }

  /** The request's layer, once it loads and is still the newest. A request of the file's that fails draws `terminal`. */
  private async loaded(request: Request): Promise<ThemeLayer | undefined> {
    let layer: ThemeLayer | undefined
    try {
      layer = await this.load(request)
    } catch (error) {
      if (this.now.newest !== request || (error instanceof DOMException && error.name === 'AbortError')) throw aborted()
      const why = reasonOf(error)
      if (request.fromFile) {
        this.now.paletteFault = `${PALETTE_FILE}: ${error instanceof Missing ? why : `${request.id}: ${why}`}`
        this.draw(undefined, TERMINAL)
      }
      this.settle(request)
      throw new Error(why, { cause: error })
    }
    if (this.now.newest !== request) throw aborted()
    return layer
  }

  private settle(request: Request): void {
    request.settled = true
    // The first draw waits for the newest request only.
    if (this.now.newest?.settled !== false) this.now.settledAtStart?.()
  }

  private async load(request: Request): Promise<ThemeLayer | undefined> {
    if (request.id === TERMINAL) return undefined
    const slash = request.id.indexOf('/')
    const [from, name] = slash === -1 ? [request.id, ''] : [request.id.slice(0, slash), request.id.slice(slash + 1)]
    const source = this.sources().find((other) => other.name === from)
    if (source === undefined || name === '') throw new Missing(`no palette ${request.id}`)
    // The file can name a palette that its source no longer has, which a person learns as not there.
    if (request.fromFile && !(await source.list()).some((palette) => palette.name === name)) throw new Missing(`no palette ${request.id}`)
    const given = await source.load(name)
    if (!this.sources().includes(source)) throw aborted()
    const layer: ThemeLayer = { hues: given.hues ?? {}, colors: given.colors ?? {} }
    checkLayer(layer, [...this.plugins(), layer])
    return layer
  }

  private draw(layer: ThemeLayer | undefined, id: string): void {
    this.now.layer = layer
    this.now.shown = id
    this.restyle()
    this.person.recheck()
    this.update()
  }

  private fileChanged(): void {
    if (this.person.lastText !== this.now.writeFailedOn) this.now.writeFault = undefined
    const palette = this.person.file.palette
    if (palette !== this.now.inUse) {
      this.now.inUse = palette
      unwaited(this.show(undefined))
    }
    this.restyle()
    this.update()
  }

  private update(): void {
    const { inUse, shown, paletteFault, writeFault, started } = this.now
    this.own.set((state) => {
      state.inUse = inUse ?? TERMINAL
      state.shown = shown
      state.error = this.person.fault ?? writeFault ?? (started ? paletteFault : undefined)
    })
  }
}
