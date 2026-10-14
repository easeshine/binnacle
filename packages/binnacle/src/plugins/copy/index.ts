import type { Context } from '@deepseek-ai/cordis'
import type { SelectionState } from '../../index.ts'
import { createModel, internals } from '../../index.ts'
import { copyToClipboard } from './clipboard.ts'
import type { Copied } from './clipboard.ts'

export type { Copied } from './clipboard.ts'

export const name = 'binnacle-copy'

export const inject = ['binnacle'] satisfies (keyof Context)[]

/** The state of the model `copy`. */
export interface CopyState {
  /** The newest copy that finished, and when, on the core's clock. */
  readonly last?: Copied & { readonly at: number }
}

export function apply(ctx: Context): void {
  const { binnacle } = ctx
  const selection = binnacle.modelOf<SelectionState>('selection')
  const copy = createModel<{ last?: Copied & { readonly at: number } }>({})
  binnacle.model('copy', copy)
  // The copies whose tools still run, so that the row's unload kills them.
  const running = new Set<AbortController>()
  let started = 0
  let shown = 0
  binnacle.action('copy.selection', {
    keys: ['select'],
    description: 'Copy the Selection to the clipboard',
    enabled: () => selection.state?.selected !== undefined,
    run: () => {
      const text = selection.state?.selected?.text ?? ''
      // Blank rows copy nothing, so the clipboard keeps what it held.
      if (text.trim() === '') return
      const own = ++started
      const stop = new AbortController()
      running.add(stop)
      void copyToClipboard(text, internals.system, stop.signal).then((copied) => {
        running.delete(stop)
        // A copy started after this one wins, even when this one ends later.
        if (stop.signal.aborted || own < shown) return
        shown = own
        copy.set((state) => {
          state.last = { ...copied, at: internals.now() }
        })
      })
    },
  })
  ctx.effect(
    () => () => {
      for (const stop of running) stop.abort()
    },
    'binnacle-copy: the tools a copy waits on',
  )
}
