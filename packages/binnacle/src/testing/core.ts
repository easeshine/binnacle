import { Context } from '@deepseek-ai/cordis'
import { internals as cmdline, provideCmdline } from '@deepseek-ai/dsh-cmdline'
import * as core from '../index.ts'
import type { System } from '../core/system.ts'
import type { TerminalColorMode } from '../terminal/pi/colors.ts'
import { XtermTerminal } from './terminal.ts'

export class FakeProcess {
  readonly #listeners = new Map<string, Set<() => void>>()
  stopCount = 0
  readonly endsWithin: number[] = []
  on(event: string, listener: () => void): void {
    const set = this.#listeners.get(event) ?? new Set()
    set.add(listener)
    this.#listeners.set(event, set)
  }
  off(event: string, listener: () => void): void {
    this.#listeners.get(event)?.delete(listener)
  }
  stop(): void {
    this.stopCount++
  }
  endWithin(ms: number): void {
    this.endsWithin.push(ms)
  }
  emit(event: string): void {
    for (const listener of this.#listeners.get(event) ?? []) listener()
  }
}

/** What a fake tool does when it runs: exits 0 and writes that text, exits 1, or never ends, until it is killed. */
export type FakeTool = string | 'fails' | 'hangs'

/** A system with only the tools, the environment and the files it is given. It records each tool it ran, and what it wrote to the terminal. */
export class FakeSystem implements System {
  readonly platform: string
  readonly env: { readonly [name: string]: string | undefined }
  readonly ran: { readonly command: string; readonly args: readonly string[]; readonly input: string | undefined }[] = []
  readonly written: string[] = []
  readonly files: Map<string, string>
  readonly #tools: { readonly [command: string]: FakeTool }
  #made = 0

  constructor(
    options: {
      platform?: string
      env?: { readonly [name: string]: string }
      tools?: { readonly [command: string]: FakeTool }
      files?: { readonly [path: string]: string }
    } = {},
  ) {
    this.platform = options.platform ?? 'linux'
    this.env = options.env ?? {}
    this.#tools = options.tools ?? {}
    this.files = new Map(Object.entries(options.files ?? {}))
  }

  run(command: string, args: readonly string[], options: { readonly input?: string; readonly ms: number; readonly signal?: AbortSignal }) {
    this.ran.push({ command, args, input: options.input })
    const tool = this.#tools[command]
    if (tool === undefined || tool === 'fails') return Promise.resolve(undefined)
    if (tool !== 'hangs') return Promise.resolve(tool)
    return new Promise<undefined>((resolve) => {
      if (options.signal?.aborted === true) {
        resolve(undefined)
        return
      }
      const cancel = core.internals.later(options.ms, () => resolve(undefined))
      options.signal?.addEventListener('abort', () => {
        cancel()
        resolve(undefined)
      })
    })
  }

  read(path: string): string | undefined {
    return this.files.get(path)
  }

  temporary(text: string): string {
    const path = `/tmp/binnacle-copy-${++this.#made}.txt`
    this.files.set(path, text)
    return path
  }

  remove(path: string): void {
    this.files.delete(path)
  }

  write(data: string): void {
    this.written.push(data)
  }
}

/**
 * The core alone, on a fake terminal, process, streams and clock, before dsh says it is ready. The core's own tests read these; `mount` builds on it.
 * `restore()` puts back what it replaced.
 */
export async function mountCore(
  options: {
    args?: string[]
    columns?: number
    rows?: number
    colorMode?: TerminalColorMode
    /** The system a copy reaches; by default one with no tools. */
    system?: System
    provide?: (ctx: Context) => void
    /** Loads the core, the module of binnacle's entry. By default it is a plugin of its own, with no row. */
    load?: (ctx: Context, core: object) => Promise<{ dispose(): unknown }>
  } = {},
) {
  const replaced = { ...core.internals }
  const written = { stdout: cmdline.stdout, stderr: cmdline.stderr }
  const terminal = new XtermTerminal(options.columns ?? 40, options.rows ?? 8)
  const exits: number[] = []
  const out: string[] = []
  const listeners = new Set<() => void>()
  cmdline.stdout = { write: (chunk: string) => out.push(chunk) }
  cmdline.stderr = { write: (chunk: string) => out.push(chunk) }
  const process = new FakeProcess()
  const printed: string[] = []
  const stdout = { write: (chunk: string) => printed.push(`stdout: ${chunk}`) > 0 }
  const stderr = { write: (chunk: string) => printed.push(`stderr: ${chunk}`) > 0 }
  core.internals.streams = { stdout, stderr }
  core.internals.terminal = () => terminal
  core.internals.process = process
  core.internals.colorMode = () => options.colorMode ?? 'truecolor'
  const system = options.system ?? new FakeSystem()
  core.internals.system = system
  const timers: { at: number; run: () => void }[] = []
  const clock = {
    now: 0,
    /** Moves the time on by `ms`, and runs each timer that falls due, in order. */
    pass: async (ms: number) => {
      const end = clock.now + ms
      for (;;) {
        timers.sort((a, b) => a.at - b.at)
        const next = timers[0]
        if (next === undefined || next.at > end) break
        timers.shift()
        clock.now = next.at
        next.run()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      clock.now = end
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    },
    timers: () => timers.length,
  }
  core.internals.now = () => clock.now
  core.internals.later = (ms, run) => {
    const timer = { at: clock.now + ms, run }
    timers.push(timer)
    return () => {
      const at = timers.indexOf(timer)
      if (at !== -1) timers.splice(at, 1)
    }
  }
  const restore = (): void => {
    Object.assign(core.internals, replaced)
    cmdline.stdout = written.stdout
    cmdline.stderr = written.stderr
  }
  const ctx = new Context()
  let fiber: { dispose(): unknown }
  try {
    provideCmdline(ctx, {
      args: options.args ?? [],
      exit: (code) => {
        exits.push(code)
      },
      ready: {
        onReady: (listener) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      },
    })
    options.provide?.(ctx)
    fiber = options.load === undefined ? ctx.plugin(core) : await options.load(ctx, core)
    await fiber
  } catch (error) {
    // A core that fails to start gives back what it replaced.
    await ctx.fiber.dispose().catch(() => {})
    restore()
    throw error
  }
  return {
    ctx,
    fiber,
    terminal,
    process,
    clock,
    system,
    stdout,
    stderr,
    printed,
    exits,
    out,
    ready: () => {
      for (const listener of listeners) listener()
      listeners.clear()
    },
    restore,
  }
}
