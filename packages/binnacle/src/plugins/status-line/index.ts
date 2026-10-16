import type { Context } from '@deepseek-ai/cordis'
import type { ChatSession, ClockState, Layout, Tone } from '../../index.ts'
import { toPlainText } from '../../index.ts'
import type { CopyState } from '../copy/index.ts'

export const name = 'binnacle-status-line'

export const inject = ['binnacle'] satisfies (keyof Context)[]

/** The Look of a segment, by its Place's name: its value, plain already, drawn as one line. */
export type SegmentLook = (value: string) => string

const deepFrozen = <T extends object>(value: T): T => {
  for (const inner of Object.values(value)) if (typeof inner === 'object' && inner !== null) deepFrozen(inner)
  return Object.freeze(value)
}

/** The Layout `status`: the segments, joined by the theme's `divider`. Frozen, as an author builds on it. */
export const STATUS_LAYOUT: Layout & { readonly row: readonly Layout[] } = deepFrozen({
  row: [{ place: 'status.palette' }, { place: 'status.state' }, { place: 'status.model' }, { place: 'status.copy' }],
  separator: true,
})

// pi flashes a copy's notice for two seconds, and an error for five.
const SHOWN_MS = 2000
const FAILURE_SHOWN_MS = 5000

const NOTICES: { readonly [outcome in NonNullable<CopyState['last']>['outcome']]: readonly [string, Tone] } = {
  copied: ['copied', 'status.success'],
  sent: ['sent to the terminal', 'status.muted'],
  failed: ['copy failed', 'status.error'],
}

/** The status line's own Tones, `status.<the general Tone>`, each like its general Tone until a layer changes it. */
const OWN = Object.fromEntries((['text', 'success', 'muted', 'error'] as const).map((tone) => [`status.${tone}`, { like: tone }]))

const valuesOf = ({ id, agent }: ChatSession): { readonly [place: string]: string | undefined } =>
  agent === undefined
    ? { 'status.state': 'read only', 'status.model': id }
    : { 'status.state': agent.status, 'status.model': agent.options.model }

export function apply(plugin: Context): void {
  // The session opens after dsh's plugins settle; a plugin that waited for it at load would be reported as never active.
  plugin.inject(['binnacleSession'], (ctx) => {
    const { binnacle } = ctx
    const chat = ctx.binnacleSession
    binnacle.theme({ colors: OWN })
    binnacle.layout('status', STATUS_LAYOUT)
    const segments = ['status.state', 'status.model'].map((place) =>
      binnacle.place(place, {
        lines: () => {
          const value = valuesOf(chat)[place]
          if (value === undefined) return []
          const look = binnacle.lookOf<SegmentLook>([place], (plain) => binnacle.paint('status.text', plain))
          return [look(toPlainText(value))]
        },
      }),
    )
    const copy = binnacle.modelOf<CopyState>('copy')
    const clock = binnacle.modelOf<ClockState>('clock')
    binnacle.place('status.copy', {
      models: [copy, clock],
      lines: () => {
        const last = copy.state?.last
        // The clock is read only while a notice can show, so that it stops after.
        const now = last === undefined ? undefined : clock.state?.now
        if (last === undefined || now === undefined) return []
        if (now - last.at >= (last.outcome === 'failed' ? FAILURE_SHOWN_MS : SHOWN_MS)) return []
        const [notice, tone] = NOTICES[last.outcome]
        const text = last.reason === undefined ? notice : `${notice}: ${toPlainText(last.reason)}`
        const look = binnacle.lookOf<SegmentLook>(['status.copy'], (plain) => binnacle.paint(tone, plain))
        return [look(text)]
      },
    })
    binnacle.place('status.palette', {
      models: [binnacle.palette],
      lines: () => {
        const { error } = binnacle.palette.state
        if (error === undefined) return []
        const look = binnacle.lookOf<SegmentLook>(['status.palette'], (plain) => binnacle.paint('status.error', plain))
        return [look(toPlainText(error))]
      },
    })
    ctx.on('agent/status', ({ agent }) => {
      if (agent === chat.agent) for (const segment of segments) segment.redraw()
    })
  })
}
