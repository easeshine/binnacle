import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logLines, makeWorld } from './world.mjs'
import { run } from './task.mjs'

function logOf(world, id) {
  return join(world.home, 'tasks', id.replace('/', '.'), 'log.ndjson')
}

async function started(world, n) {
  world.spec(n)
  return run(['start', n], world.deps)
}

test('a log that does not end with a newline, or holds a line that is not JSON, makes each command for that task refuse and name the file', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'menus')).code, 0)

  const log = logOf(world, 'menus')
  const whole = readFileSync(log, 'utf8')
  writeFileSync(log, whole.trimEnd())
  const cut = await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  assert.equal(cut.code, 1)
  assert.equal(cut.stderr, `${log}: the log does not end with a newline\n`)
  assert.equal((await run(['status', 'menus'], world.deps)).code, 1)

  writeFileSync(log, `${whole}not json\n`)
  const broken = await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  assert.equal(broken.code, 1)
  assert.equal(broken.stderr, `${log}: line 2 is not JSON\n`)
})

test('a command that finds a lock of a gone process removes nothing, and exits 1 naming the lock and the process id', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'menus')).code, 0)
  const lock = join(world.home, 'tasks', '.lock')
  const gone = spawnSync('true')
  writeFileSync(lock, `${gone.pid}`)

  const result = await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  assert.equal(result.code, 1)
  assert.equal(result.stderr, `${lock}: its process ${gone.pid} is gone; check it, then remove the lock by hand\n`)
  assert.equal(readFileSync(lock, 'utf8'), `${gone.pid}`)
  assert.deepEqual(logLines(world, 'menus').at(-1), { at: '2026-10-05T10:00:00.000Z', role: 'lead', from: null, to: 'spec', round: 0 })

  // The Lead removes the stale lock by hand, and the command runs.
  rmSync(lock)
  const after = await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  assert.equal(after.code, 0)
})

test('a start whose git step fails removes what it made, and exits with the error', async () => {
  const world = makeWorld()
  world.spec('menus')
  const worktrees = join(world.home, 'worktrees')
  mkdirSync(worktrees)
  chmodSync(worktrees, 0o555)
  onTestFinished(() => {
    chmodSync(worktrees, 0o755)
    world.remove()
  })

  const failed = await run(['start', 'menus'], world.deps)

  assert.equal(failed.code, 1)
  assert.match(failed.stderr, /git worktree add .* failed:/)
  assert.equal(existsSync(join(world.home, 'tasks', 'menus')), false)
  const branch = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'task/menus'], { cwd: world.repo })
  assert.notEqual(branch.status, 0)
  assert.equal(existsSync(join(worktrees, 'menus')), false)
})

test('a command that holds the lock releases it when it gets SIGINT', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'menus')).code, 0)
  await run(['set', 'menus', 'changes', '--as', 'reviewer'], world.deps)
  world.reply('menus')
  const lock = join(world.home, 'tasks', '.lock')

  // The command parks inside its own writing, holding the lock.
  let letGo
  const gate = new Promise((resolve) => {
    letGo = resolve
  })
  onTestFinished(() => letGo())
  const parked = run(['set', 'menus', 'spec'], {
    ...world.deps,
    runners: {
      herdr: {
        ...world.runner,
        prompt: () => gate,
      },
    },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(existsSync(lock), true)

  process.emit('SIGINT')

  assert.equal(existsSync(lock), false)
  letGo()
  assert.equal((await parked).code, 0)
})
