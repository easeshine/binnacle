import type { Context } from '@deepseek-ai/cordis'
// The registry's type, which also declares the service `commands` on the Context.
import type { CommandRuntime } from '@deepseek-ai/dsh-commands'
import { createModel, list, truncateToWidth } from '../../index.ts'
import type { Layout, ListItem, ListRow, PaletteSource } from '../../index.ts'
import { PI, PI_THEMES } from './pi.ts'

export const name = 'binnacle-palette'

export const inject = ['binnacle'] satisfies (keyof Context)[]

/** A palette as the List shows it. */
export interface PaletteItem extends ListItem {
  /** The palette's id, `<source>/<name>` or `terminal`; `undefined` for a source whose `list()` failed, which the item names. */
  readonly id: string | undefined
}

/** The Look `palette.list.row`: how one palette of the List is drawn. */
export type PaletteRow = ListRow<PaletteItem>

/** The state of the model `palette.picker`: whether the List is open, its palettes, what is wrong with each that did not load, and whether a pick waits. */
export interface PalettePickerState {
  open: boolean
  items: readonly PaletteItem[]
  /** What is wrong with a palette, by its id, once the mark has been on it. */
  readonly wrong: Map<string, string>
  picking: boolean
}

const deepFrozen = <T extends object>(value: T): T => {
  for (const inner of Object.values(value)) if (typeof inner === 'object' && inner !== null) deepFrozen(inner)
  return Object.freeze(value)
}

/** The Layout `palette`: the List `palette.list`, at most 8 rows under a rule. Frozen, as an author builds on it. */
export const PALETTE_LAYOUT: Layout & { readonly place: string } = deepFrozen({
  place: 'palette.list',
  size: { most: 9 },
  border: ['top'],
})

const LIST = 'palette.list'
const COMPOSER = 'composer.input'
const TERMINAL: PaletteItem = { id: 'terminal', label: 'Terminal' }
const GATED = ['up', 'down', 'pageUp', 'pageDown', 'pick', 'click']

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'
const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Each source's palettes as items, in its order, the first of two by one name kept; a source whose `list()` failed is one item that says why. */
function itemsOf(source: PaletteSource, listed: PromiseSettledResult<readonly { name: string; description?: string }[]>): PaletteItem[] {
  if (listed.status === 'rejected') return [{ id: undefined, label: source.name, description: reasonOf(listed.reason) }]
  const seen = new Set<string>()
  return listed.value.flatMap(({ name: palette, description }) => {
    if (seen.has(palette)) return []
    seen.add(palette)
    return [
      {
        id: `${source.name}/${palette}`,
        label: palette,
        description: description === undefined ? source.name : `${source.name} · ${description}`,
      },
    ]
  })
}

export function apply(ctx: Context): void {
  const { binnacle } = ctx
  binnacle.palettes(PI)
  binnacle.palettes(PI_THEMES)

  const model = createModel<PalettePickerState>({ open: false, items: [], wrong: new Map(), picking: false })
  binnacle.model('palette.picker', model)
  const picker = list<PaletteItem>(binnacle, {
    name: LIST,
    models: [model, binnacle.palette],
    items: () => (model.state.open ? model.state.items : []),
    pick: (index) => pick(index),
  })
  binnacle.look<PaletteRow>(`${LIST}.row`, (beneath) => (item, at) => {
    const wrong = item.id === undefined ? undefined : model.state.wrong.get(item.id)
    const row = wrong === undefined ? beneath(item, at) : `${beneath(item, at)} ${binnacle.paint('error', wrong)}`
    return truncateToWidth(row, at.width, binnacle.tokens.glyphs.more)
  })

  const said = (id: string, error: unknown): void => {
    if (isAbort(error)) return
    const why = reasonOf(error)
    // A mistake in the file is the status line's to say.
    if (why === binnacle.palette.state.error) return
    model.set((state) => state.wrong.set(id, why))
  }
  const shown = (id: string): void => {
    binnacle.showPalette(id).then(
      () => model.set((state) => state.wrong.delete(id)),
      (error: unknown) => said(id, error),
    )
  }
  // The mark that the List was last seen at, so a mark that the row sets itself shows nothing.
  let seen = -1
  ctx.effect(
    () =>
      picker.model.watch(() => {
        const mark = picker.model.state.mark
        if (!model.state.open || mark === seen) return
        seen = mark
        const id = model.state.items[mark]?.id
        if (id !== undefined) shown(id)
      }),
    'binnacle-palette: the mark shows its palette',
  )
  const markInUse = (): void => {
    const index = Math.max(
      0,
      model.state.items.findIndex((item) => item.id === binnacle.palette.state.inUse),
    )
    seen = index
    picker.model.set((state) => (state.mark = index))
  }

  // The pick that waits now: a pick that an esc ended settles later, and is no longer it.
  let picks = 0
  const close = (): void => {
    picks++
    model.set((state) => {
      state.open = false
      state.picking = false
    })
    binnacle.focus(COMPOSER)
  }
  const pick = (index: number): void => {
    const id = model.state.items[index]?.id
    if (id === undefined || model.state.picking) return
    const mine = ++picks
    model.set((state) => (state.picking = true))
    binnacle.pickPalette(id).then(
      () => {
        if (mine === picks) close()
      },
      (error: unknown) => {
        if (mine !== picks) return
        model.set((state) => (state.picking = false))
        said(id, error)
      },
    )
  }

  // While a pick waits, the List takes no move and no pick, so a pick is never of a palette that the person did not see.
  for (const verb of GATED)
    binnacle.action(`${LIST}.${verb}`, {
      run: (_at, beneath) => {
        if (!model.state.picking) beneath()
      },
    })

  let opening = 0
  binnacle.action('palette.open', {
    keys: [],
    description: 'Open the List of palettes, the one in use marked',
    run: () => {
      if (model.state.open) {
        markInUse()
        const id = model.state.items[picker.model.state.mark]?.id
        if (id !== undefined) shown(id)
        binnacle.focus(LIST)
        return
      }
      const asked = ++opening
      const sources = binnacle.paletteSources()
      model.set((state) => {
        state.open = true
        state.items = [TERMINAL]
        state.wrong.clear()
      })
      markInUse()
      binnacle.focus(LIST)
      void Promise.allSettled(sources.map((source) => source.list())).then((listed) => {
        // A list read for an open of the List that has closed since is dropped.
        if (asked !== opening || !model.state.open) return
        model.set((state) => {
          state.items = [TERMINAL, ...sources.flatMap((source, at) => itemsOf(source, listed[at]!))]
        })
        markInUse()
      })
    },
  })
  binnacle.action('palette.close', {
    keys: ['escape'],
    place: LIST,
    description: 'Close the List of palettes, and draw the one in use',
    run: () => {
      // A newer request than a pick that waits, so the pick writes nothing.
      binnacle.showPalette(undefined).catch(() => {})
      opening++
      close()
    },
  })

  binnacle.layout('palette', PALETTE_LAYOUT)
  binnacle.edit('chat', { insert: { layout: 'palette', size: 'content', unless: 'request' }, before: 'composer' })

  // A Request's view takes the Focus, and the Chat's start gets it back when the Request goes, so the List takes it again.
  ctx.inject(['binnacleRequests'], (inner) => {
    const requests = inner.binnacleRequests
    let standing = requests.shown !== undefined
    inner.effect(
      () =>
        requests.watch(() => {
          const was = standing
          standing = requests.shown !== undefined
          if (was && !standing && model.state.open) binnacle.focus(LIST)
        }),
      'binnacle-palette: the List takes the Focus back after a Request',
    )
  })
  ctx.inject(['commands'], (inner) => {
    const commands: CommandRuntime = inner.commands
    commands.register({
      name: 'palette',
      description: 'Pick a palette',
      handler: () => {
        binnacle.run('palette.open')
        return { kind: 'success' }
      },
    })
  })
}
