import type { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import type { AssistantStreamFrame } from '@deepseek-ai/dsh-agent'
import { bindScopeParent, scopeTarget } from '@deepseek-ai/dsh-scope'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
import type { AskUserQuestionAnswer, AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions'
import type { Binnacle } from '../api.ts'
import { agents } from './agents.ts'
import { FakeSystem, mountCore } from './core.ts'
import { ESCAPE_WAIT_MS, MOTION, mouse, sequenceOf } from './keys.ts'
import { BUILT_INS } from './rows.ts'
import { persistence } from './sessions.ts'
import { PACKAGE } from '../core/name.ts'

/** A plugin as Cordis loads it: a module with `apply`, and a `name` that names its row. */
export interface Plugin {
  readonly name?: string
  readonly inject?: readonly string[] | Readonly<Record<string, unknown>>
  apply(ctx: Context, config?: never): void | Promise<void>
}

/** A subagent of the agent, to ask or to approve as. */
export interface Subagent {
  readonly id: string
}

export interface MountOptions {
  /** The terminal's size, 80 × 24 by default. */
  readonly size?: { readonly columns: number; readonly rows: number }
  /** The bundle's rows by id, such as `binnacle-composer`: `'all'` by default, `[]` for none. */
  readonly builtins?: 'all' | readonly string[]
  /** An author's plugins, each a module or a module and its config, loaded after the built-ins, each a row of its own. */
  readonly plugins?: readonly (Plugin | readonly [Plugin, unknown])[]
  /** Opens this session read only, in place of a new one. */
  readonly stored?: { readonly id: string; readonly events: readonly SessionEvent[] }
  /** The fake agent's model, `deepseek-v4` of `deepseek` by default. */
  readonly model?: { readonly provider: string; readonly model: string }
  /**
   * Provides services of dsh's that a test fakes, such as `tools` or `commands`, before binnacle starts.
   * One by the name of a fake of the mount's own, `agents` or `agentDefaultModel`, replaces it: an `agents` whose `create` never settles keeps the session from opening.
   */
  readonly provide?: (ctx: Context) => void
  /** A folder that dsh gives the plugins as its profile's, through `profileContext`, where binnacle reads `palette.json`. With none, there is no profile folder. */
  readonly profile?: string
}

/** A cell of the terminal, counted from 0. */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** How a cell's text is drawn. A colour is a palette index, `#rrggbb`, or `default`. */
export interface CellStyle {
  readonly colour: number | string
  readonly background: number | string
  readonly bold: boolean
  readonly dim: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly inverse: boolean
}

export interface Mounted {
  /** The rows, plain, once binnacle has drawn. */
  screen(): Promise<string[]>
  /** How the text in a cell is drawn, the cell counted from 0. */
  style(x: number, y: number): Promise<CellStyle>
  /** The cell where the core puts the cursor of the Part with the Focus. The terminal's own cursor stays hidden, as a Part draws its own. */
  cursor(): Promise<{ readonly x: number; readonly y: number }>
  /** A key by name: `enter`, `escape`, `tab`, `shift+tab`, `backspace`, `delete`, `space`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`, or `ctrl+<letter>`. */
  press(key: string): Promise<void>
  type(text: string): Promise<void>
  /** A press and its release on a cell, counted from 0. A second click on the same word within 500 ms on the fake clock is a double click. */
  click(x: number, y: number, gesture?: 'click' | 'shift+click'): Promise<void>
  /**
   * A press on `from`, a motion to `to`, or to each cell of a list in turn, and a release on the last, each a cell counted from 0, as a terminal sends a drag.
   * `held` keeps the button down there for that many ms on the fake clock before the release, as a drag held past a Place's edge scrolls it.
   */
  drag(from: Cell, to: Cell | readonly Cell[], held?: number): Promise<void>
  /** Notches of the wheel over a cell: up while positive. */
  wheel(x: number, y: number, notches: number): Promise<void>
  resize(columns: number, rows: number): Promise<void>
  readonly agent: {
    status(status: 'idle' | 'running'): Promise<void>
    /** Commits an event of the session: its seq is the next, and its time the fake clock's, unless it names them. */
    commit(event: { readonly type: string; readonly data: unknown; readonly seq?: number; readonly time?: number }): Promise<void>
    stream(frame: AssistantStreamFrame): Promise<void>
    /** What the session sent the agent: a prompt as a followup, or a steer of the turn that runs. */
    readonly sent: readonly { readonly how: 'followup' | 'steer'; readonly text: string }[]
    /** Each time the session interrupted the turn: what it asked dsh's agent to cancel with. */
    readonly cancels: readonly { readonly cause: unknown; readonly options: unknown }[]
    /** A subagent of the agent, by its session's id. */
    child(id: string): Subagent
  }
  /** A question that a tool asks. It settles when the person answers, or when its signal aborts. */
  ask(questions: readonly AskUserQuestionItem[], options?: { signal?: AbortSignal; agent?: Subagent }): Promise<AskUserQuestionAnswer>
  /** An approval that a tool asks for. It settles when the person answers, or when its signal aborts. */
  approve(
    toolName: string,
    options?: { callId?: string; reason?: string; signal?: AbortSignal; agent?: Subagent },
  ): Promise<ApprovalOutcome>
  readonly clock: { readonly now: number; pass(ms: number): Promise<void> }
  /** Each text that reached the clipboard, oldest first. The mount's clipboard always copies. */
  readonly copied: readonly string[]
  readonly binnacle: Binnacle
  /** The Context that dsh's services and events live on, for what the methods above do not drive. */
  readonly ctx: Context
  /** The codes that binnacle asked dsh to exit with, such as `0` after ctrl+c twice on an empty draft. */
  readonly exits: readonly number[]
  /** Unloads one row by its id, such as `binnacle-composer` or the core's `binnacle`, or an author's plugin by its name, while the mount stays open. */
  unload(name: string): Promise<void>
  /** Unloads every plugin, cancels their timers, and puts back what the mount replaced. */
  close(): Promise<void>
}

let open = false

const CLOSED = 'binnacle/testing: this mount is closed'

/** binnacle with no terminal, on a fake agent and a fake clock, with the built-ins and an author's plugins, as a profile loads them. One is open at a time. */
export async function mount(options: MountOptions = {}): Promise<Mounted> {
  if (open) throw new Error('binnacle/testing: a mount is open; close it before another')
  const unknown =
    options.builtins === undefined || options.builtins === 'all'
      ? []
      : options.builtins.filter((id) => !BUILT_INS.some(([row]) => row === id))
  if (unknown.length > 0) throw new Error(`binnacle/testing: no built-in row is named ${unknown.join(', ')}`)
  open = true
  // A mount that fails part of the way gives back what it took, so the next test mounts afresh.
  const made: { ctx?: Context; restore?: () => void } = {}
  try {
    return await mounting(options, made)
  } catch (error) {
    await made.ctx?.fiber.dispose().catch(() => {})
    made.restore?.()
    open = false
    throw error
  }
}

async function mounting(options: MountOptions, made: { ctx?: Context; restore?: () => void }): Promise<Mounted> {
  const dsh = agents(options.model)
  const store = options.stored === undefined ? undefined : persistence([{ ...options.stored, createdAt: 0 }])
  const modules = new Map<string, object>()
  class Profile extends Loader {
    override import(name: string) {
      return Promise.resolve(modules.get(name))
    }
  }
  // Each row by its id, or an author's plugin by its name, the core's `binnacle` first, so that the core unloads last.
  const ids = new Map<string, string>()
  // The core is the row `binnacle`, as a profile loads it, so that what it registers ranks as a built-in's.
  const loadCore = async (ctx: Context, module: object) => {
    modules.set(PACKAGE, module)
    await ctx.plugin(Profile)
    const loader = ctx.get('loader')!
    const id = await loader.create({ name: PACKAGE })
    ids.set('binnacle', id)
    return { dispose: () => loader.remove(id) }
  }
  // The mount's system is a Mac whose clipboard tool always works.
  const system = new FakeSystem({ platform: 'darwin', tools: { pbcopy: '' } })
  const core = await mountCore({
    system,
    load: loadCore,
    columns: options.size?.columns ?? 80,
    rows: options.size?.rows ?? 24,
    args: options.stored === undefined ? [] : ['--session', options.stored.id],
    provide: (ctx) => {
      // dsh's launcher gives more of a profile than its folder; binnacle reads only the folder.
      if (options.profile !== undefined) ctx.provide('profileContext' as never, { dir: options.profile } as never)
      options.provide?.(ctx)
      const provideUnless = (name: string, value: unknown): void => {
        // Cordis types a service by its registered name; the fake dsh provides each by a name it is given.
        if (ctx.get(name as never) === undefined) ctx.provide(name as never, value as never)
      }
      // The fake dsh provides with this function only, which is no Context.
      dsh.provide({ provide: provideUnless } as never)
      if (store !== undefined) provideUnless('sessionPersistence', store)
    },
  })
  const { ctx, terminal, clock } = core
  made.ctx = ctx
  made.restore = core.restore
  let closed = false
  const live = (): void => {
    if (closed) throw new Error(CLOSED)
  }
  const settled = async (): Promise<void> => {
    live()
    await new Promise((resolve) => setImmediate(resolve))
    await terminal.read()
  }

  const named =
    options.builtins === undefined || options.builtins === 'all' ? BUILT_INS : BUILT_INS.filter(([id]) => options.builtins!.includes(id))
  const rows: { id: string; name: string; config?: unknown }[] = []
  for (const [id, name, load, config] of named) {
    modules.set(name, await load())
    rows.push(config === undefined ? { id, name } : { id, name, config })
  }
  for (const [index, given] of (options.plugins ?? []).entries()) {
    // Array.isArray does not narrow a union with a readonly tuple.
    const [plugin, config] = Array.isArray(given) ? (given as readonly [Plugin, unknown]) : [given as Plugin, undefined]
    // A row named `@easeshine/binnacle` or `@easeshine/binnacle/…` ranks as a built-in, so an author's row takes its plugin's own name.
    const name = `author:${plugin.name ?? `plugin-${index + 1}`}`
    modules.set(name, plugin)
    rows.push({ id: plugin.name ?? name, name, config })
  }
  const loader = ctx.get('loader')!
  for (const { id, name, config } of rows) ids.set(id, await loader.create(config === undefined ? { name } : { name, config }))
  core.ready()
  await settled()

  let seq = Math.max(0, ...(options.stored?.events ?? []).map((event) => event.seq))
  const driven = async <T>(run: () => T): Promise<void> => {
    live()
    run()
    await settled()
  }
  const waterfall = (name: string, payload: object, agent: object, fallback: () => Promise<unknown>) => {
    if (closed) return Promise.reject(new Error(CLOSED))
    // dsh's Requests are hooks on a scope of the agent's, typed by dsh's own packages: the fake agent is no such Agent.
    const asked = (ctx.waterfall as (...args: unknown[]) => Promise<unknown>)(
      scopeTarget(agent, agent as never),
      name,
      { ...payload, agent },
      fallback,
    )
    // A Request that a test leaves standing is dismissed when the mount closes, which is no failure of the test's.
    asked.catch(() => {})
    return asked
  }

  return {
    screen: async () => {
      await settled()
      return (await terminal.read()).rows
    },
    style: async (x, y) => {
      await settled()
      return {
        ...(await terminal.styleAt(x, y)),
        background: await terminal.backgroundAt(x, y),
        inverse: await terminal.inverseAt(x, y),
      }
    },
    cursor: async () => {
      await settled()
      return (await terminal.read()).cursor
    },
    press: async (key) => {
      const sequence = sequenceOf(key)
      await driven(() => terminal.type(sequence))
      // A lone escape is told from the start of a sequence once nothing follows it for a while, by the terminal's own clock.
      if (sequence === '\x1b') {
        await new Promise((resolve) => setTimeout(resolve, ESCAPE_WAIT_MS))
        await settled()
      }
    },
    type: (text) => driven(() => terminal.type(text)),
    click: (x, y, gesture = 'click') =>
      driven(() => {
        const button = gesture === 'shift+click' ? 4 : 0
        terminal.type(mouse(button, x, y))
        terminal.type(mouse(button, x, y, true))
      }),
    drag: async (from, to, held = 0) => {
      // Array.isArray does not narrow a readonly list, and only a cell has `x`.
      const path = 'x' in to ? [to] : (to as readonly Cell[])
      const end = path.at(-1) ?? from
      await driven(() => {
        terminal.type(mouse(0, from.x, from.y))
        for (const { x, y } of path) terminal.type(mouse(MOTION, x, y))
      })
      if (held > 0) await clock.pass(held)
      await driven(() => terminal.type(mouse(0, end.x, end.y, true)))
    },
    wheel: (x, y, notches) =>
      driven(() => {
        for (let notch = 0; notch < Math.abs(notches); notch++) terminal.type(mouse(notches > 0 ? 64 : 65, x, y))
      }),
    resize: (columns, height) => driven(() => terminal.resize(columns, height)),
    agent: {
      status: (status) => driven(() => dsh.status(ctx, status)),
      commit: (event) =>
        driven(() => {
          seq = event.seq ?? seq + 1
          dsh.commit(ctx, { seq, time: event.time ?? clock.now, type: event.type, data: event.data })
        }),
      stream: (frame) => driven(() => dsh.stream(ctx, frame)),
      get sent() {
        return dsh.sent
      },
      get cancels() {
        return dsh.cancels
      },
      child: (id) => {
        live()
        const child = { id }
        bindScopeParent(child, dsh.agent)
        return child
      },
    },
    ask: (questions, { signal, agent = dsh.agent } = {}) =>
      // A Request's answer is of the type its hooks return.
      waterfall('user-questions/request', { questions, signal }, agent, () =>
        Promise.reject(new UserQuestionError('no user-questions answerer accepted the request', 'NO_PROVIDER')),
      ) as Promise<AskUserQuestionAnswer>,
    approve: (toolName, { signal, agent = dsh.agent, ...request } = {}) =>
      // A Request's answer is of the type its hooks return.
      waterfall('approval/request', { ...request, toolName, signal }, agent, () =>
        Promise.resolve<ApprovalOutcome>('unavailable'),
      ) as Promise<ApprovalOutcome>,
    clock: {
      get now() {
        return clock.now
      },
      pass: async (ms) => {
        live()
        await clock.pass(ms)
        await settled()
      },
    },
    get copied() {
      return system.ran.filter(({ command }) => command === 'pbcopy').map(({ input }) => input ?? '')
    },
    get binnacle() {
      return ctx.binnacle
    },
    ctx,
    exits: core.exits,
    unload: async (name) => {
      live()
      const id = ids.get(name)
      if (id === undefined) throw new Error(`binnacle/testing: no row or plugin is named ${name}`)
      ids.delete(name)
      await loader.remove(id)
      await settled()
    },
    close: async () => {
      if (closed) return
      closed = true
      for (const id of [...ids.values()].toReversed()) await loader.remove(id)
      ids.clear()
      // A plugin that a test loaded on the Context itself goes too, with the loader and dsh's fakes.
      await ctx.fiber.dispose()
      core.restore()
      open = false
    },
  }
}
