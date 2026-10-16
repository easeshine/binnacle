import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import type { Binnacle, ClockState } from '../../src/api.ts'
import { createModel } from '../../src/index.ts'
import type { CopyState } from '../../src/plugins/copy/index.ts'
import { STATUS_LAYOUT } from '../../src/plugins/status-line/index.ts'
import { mount } from '../../src/testing/index.ts'
import type { MountOptions, Mounted } from '../../src/testing/index.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

async function booted(columns: number, author: (binnacle: Binnacle) => void = () => {}, more: MountOptions = {}) {
  await app?.close()
  app = await mount({
    size: { columns, rows: 2 },
    builtins: ['binnacle-status-line'],
    plugins: [{ name: 'author', inject: ['binnacle'], apply: (ctx: Context) => void author(ctx.binnacle) }],
    ...more,
  })
  return app
}

test("the status line shows whether the agent runs, and its model, as the agent's status changes", async () => {
  const shown = await booted(30)
  const idle = await shown.screen()
  await shown.agent.status('running')
  assert.deepEqual(
    [idle, await shown.screen()],
    [
      ['', 'idle · deepseek-v4'],
      ['', 'running · deepseek-v4'],
    ],
  )
})

test('on a stored session, the status line says that it is read only, and which session it is', async () => {
  const shown = await booted(30, () => {}, { stored: { id: 'session-stored', events: [] } })
  assert.deepEqual(await shown.screen(), ['', 'read only · session-stored'])
})

test("the status line is the Layout `status`, the separated row `STATUS_LAYOUT` in the Chat: an author inserts a segment after `status.model`, and it is joined by ' · '", async () => {
  const inserted = await (
    await booted(40, (binnacle) => {
      binnacle.edit('status', { insert: { place: 'cwd' }, after: 'status.model' })
      binnacle.place('cwd', { lines: () => ['binnacle'] })
    })
  ).screen()
  const built = await booted(40, (binnacle) => {
    binnacle.layout('status', { ...STATUS_LAYOUT, row: STATUS_LAYOUT.row.toReversed() })
  })
  assert.deepEqual(
    [inserted, await built.screen()],
    [
      ['', 'idle · deepseek-v4 · binnacle'],
      ['', 'deepseek-v4 · idle'],
    ],
  )
})

test("each segment draws through the Look by its Place's name, given its value: setting `status.state` draws `running` in the accent colour, and only that segment changes", async () => {
  const shown = await booted(40, (binnacle) => {
    binnacle.look<(value: string) => string>(
      'status.state',
      (beneath) => (value) => (value === 'running' ? binnacle.paint('accent', value) : beneath(value)),
    )
  })
  const idle = [(await shown.style(0, 1)).colour, await shown.screen()]
  await shown.agent.status('running')
  const running = [(await shown.style(0, 1)).colour, (await shown.style(10, 1)).colour, await shown.screen()]
  assert.deepEqual(
    [idle, running],
    [
      ['default', ['', 'idle · deepseek-v4']],
      [6, 'default', ['', 'running · deepseek-v4']],
    ],
  )
})

test('a status line wider than the terminal is cut at its end with `…`, and never wraps; too narrow for `…`, it draws empty', async () => {
  const wide = await (await booted(10)).screen()
  const narrow = await booted(2, (binnacle) => binnacle.theme({ glyphs: { more: '...' } }))
  assert.deepEqual(
    [wide, await narrow.screen()],
    [
      ['', 'idle · de…'],
      ['', ''],
    ],
  )
})

test("the agent's status and model are made plain before they are drawn", async () => {
  const shown = await booted(40, () => {}, { model: { provider: 'deepseek', model: '\x1b[31mdeep\x07seek' } })
  await shown.agent.status('running')
  assert.deepEqual([await shown.screen(), (await shown.style(10, 1)).colour], [['', 'running · deepseek'], 'default'])
})

test("a segment and a copy's notice draw in the status line's own Tones, status.text, status.success, status.muted and status.error, which an author colours alone", async () => {
  const copy = createModel<CopyState>({})
  const shown = await booted(60, (binnacle) => {
    binnacle.model('copy', copy)
    binnacle.theme({ colors: { 'status.text': 'blue', 'status.success': 'magenta', 'status.muted': 'yellow', 'status.error': 'green' } })
  })
  const now = shown.ctx.binnacle.modelOf<ClockState>('clock').state?.now ?? 0
  const drawn: unknown[] = []
  for (const outcome of ['copied', 'sent', 'failed'] as const) {
    copy.set((state) => Object.assign(state, { last: { outcome, at: now } }))
    const row = (await shown.screen())[1] ?? ''
    drawn.push([row, (await shown.style(0, 1)).colour, (await shown.style(row.lastIndexOf('·') + 2, 1)).colour])
  }
  assert.deepEqual(drawn, [
    ['idle · deepseek-v4 · copied', 4, 5],
    ['idle · deepseek-v4 · sent to the terminal', 4, 3],
    ['idle · deepseek-v4 · copy failed', 4, 2],
  ])
})
