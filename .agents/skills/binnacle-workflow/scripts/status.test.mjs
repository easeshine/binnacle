import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeWorld } from './world.mjs'
import { run } from './task.mjs'

test('Each change of state adds one line to `log.ndjson`: the time, the role, the state before, the state after and the round', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('cards')

  const steps = [
    [['set', 'cards', 'changes', '--as', 'reviewer'], 1],
    [['set', 'cards', 'spec'], 2],
    [['set', 'cards', 'approved', '--as', 'reviewer'], 3],
    [['build', 'cards/2'], 4],
    [['set', 'cards/2', 'building', '--as', 'implementer'], 5],
    [['set', 'cards/2', 'ready', '--as', 'implementer'], 6],
    [['set', 'cards/2', 'changes', '--as', 'reviewer'], 7],
  ]
  assert.equal((await run(['start', 'cards'], world.deps)).code, 0)
  for (const [argv, minutes] of steps) {
    world.tick()
    // The Lead answers the findings before it sets `spec` again.
    if (argv[2] === 'spec') world.reply('cards')
    assert.equal((await run(argv, world.deps)).code, 0, `${argv.join(' ')} at minute ${minutes}`)
  }

  const lines = (id) =>
    readFileSync(join(world.home, 'tasks', id.replace('/', '.'), 'log.ndjson'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  assert.deepEqual(lines('cards'), [
    { at: '2026-10-05T10:00:00.000Z', role: 'lead', from: null, to: 'spec', round: 0 },
    { at: '2026-10-05T10:01:00.000Z', role: 'reviewer', from: 'spec', to: 'changes', round: 0 },
    { at: '2026-10-05T10:02:00.000Z', role: 'lead', from: 'changes', to: 'spec', round: 0 },
    { at: '2026-10-05T10:03:00.000Z', role: 'reviewer', from: 'spec', to: 'approved', round: 0 },
  ])
  assert.deepEqual(lines('cards/2'), [
    { at: '2026-10-05T10:04:00.000Z', role: 'lead', from: null, to: 'approved', round: 0 },
    { at: '2026-10-05T10:05:00.000Z', role: 'implementer', from: 'approved', to: 'building', round: 0 },
    { at: '2026-10-05T10:06:00.000Z', role: 'implementer', from: 'building', to: 'ready', round: 1 },
    { at: '2026-10-05T10:07:00.000Z', role: 'reviewer', from: 'ready', to: 'changes', round: 1 },
  ])
})

test('`task status` shows each task, its state, its round, and the time since its last change', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  world.spec('tables')
  assert.equal((await run(['start', 'menus'], world.deps)).code, 0)
  assert.equal((await run(['start', 'tables'], world.deps)).code, 0)

  world.tick(120_000)
  await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  world.tick(3_600_000)
  world.tick(3_600_000)

  const all = await run(['status'], world.deps)
  assert.equal(all.code, 0)
  assert.equal(
    all.stdout,
    [
      'menus approved round 0 (2h ago)',
      '  reviewer herdr:pi:openai-codex/gpt-6.1-sol@medium idle, last session record 2h2m ago',
      'tables spec round 0 (2h2m ago)',
      '  reviewer herdr:pi:openai-codex/gpt-6.1-sol@medium idle, last session record 2h2m ago',
      '',
    ].join('\n'),
  )

  const one = await run(['status', 'tables'], world.deps)
  assert.equal(one.code, 0)
  assert.equal(
    one.stdout,
    'tables spec round 0 (2h2m ago)\n  reviewer herdr:pi:openai-codex/gpt-6.1-sol@medium idle, last session record 2h2m ago\n',
  )

  const none = await run(['status', 'nowhere'], world.deps)
  assert.equal(none.code, 1)
  assert.match(none.stderr, /no task nowhere/)
})
