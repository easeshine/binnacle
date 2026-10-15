import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { makeHeadless } from './headless.mjs'

function world() {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-headless-'))
  onTestFinished(() => rmSync(home, { recursive: true, force: true }))
  const spawned = []
  const killed = []
  const runner = makeHeadless({
    home,
    spawnSupervisor: (script, dir) => spawned.push([script.split('/').at(-1), dir]),
    kill: (pid, signal) => killed.push(`${pid} ${signal}`),
    // Each process that close stops ends at once.
    alive: () => false,
    sleep: async () => {},
    now: () => new Date('2026-10-05T10:00:00.000Z'),
  })
  const dir = join(home, 'tasks', '140', 'agents', 'reviewer')
  const agent = {
    n: 140,
    role: 'reviewer',
    tool: 'pi',
    model: 'openai-codex/gpt-6.1-sol',
    thinking: 'medium',
    cwd: '/w/140-review',
    sessionDir: join(dir, 'sessions'),
    session: '140-reviewer',
    env: { BINNACLE_TASK: '140', BINNACLE_ROLE: 'reviewer' },
  }
  return { home, dir, agent, runner, spawned, killed }
}

function gonePid() {
  return spawnSync(process.execPath, ['-e', '']).pid
}

test("the headless runner records the agent's tool, model and session, and starts a supervisor", async () => {
  const { home, dir, agent, runner, spawned } = world()
  assert.deepEqual(await runner.start(agent), { dir })
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'agent.json'), 'utf8')), {
    role: 'reviewer',
    home,
    cwd: '/w/140-review',
    env: { BINNACLE_TASK: '140', BINNACLE_ROLE: 'reviewer' },
    tool: 'pi',
    model: 'openai-codex/gpt-6.1-sol',
    thinking: 'medium',
    sessionDir: join(dir, 'sessions'),
    session: '140-reviewer',
  })
  assert.deepEqual(spawned, [['supervise.mjs', dir]])
})

test('a prompt to a headless agent waits in a queue, and the command does not wait', async () => {
  const { dir, agent, runner, spawned } = world()
  await runner.start(agent)
  // A supervisor lives: the prompts only queue, in the order they came.
  writeFileSync(join(dir, 'supervisor.pid'), String(process.pid))
  await runner.prompt({ dir }, 'round 1')
  await runner.prompt({ dir }, 'round 2')
  const queued = readdirSync(join(dir, 'queue')).toSorted()
  assert.deepEqual(
    queued.map((name) => readFileSync(join(dir, 'queue', name), 'utf8')),
    ['round 1', 'round 2'],
  )
  assert.equal(spawned.length, 1)
})

test('a prompt to a headless agent whose supervisor is gone starts a new one', async () => {
  const { dir, agent, runner, spawned } = world()
  await runner.start(agent)
  writeFileSync(join(dir, 'supervisor.pid'), String(gonePid()))
  await runner.prompt({ dir }, 'round 1')
  assert.equal(spawned.length, 2)
  assert.equal(readdirSync(dir).includes('supervisor.pid'), false)
})

test('a headless agent works while its run lives, and is idle without one', async () => {
  const { dir, agent, runner } = world()
  await runner.start(agent)
  assert.deepEqual(await runner.activity({ dir }), { state: 'idle' })
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ supervisor: 1, pid: process.pid, prompt: 'a.txt', startedAt: 'x' }))
  assert.deepEqual(await runner.activity({ dir }), { state: 'working', root: process.pid })
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ supervisor: 1, pid: gonePid(), prompt: 'a.txt', startedAt: 'x' }))
  assert.deepEqual(await runner.activity({ dir }), { state: 'idle' })
})

test('closing a headless agent drops its queue, and stops its run with its children, and its supervisor', async () => {
  const { dir, agent, runner, killed } = world()
  await runner.start(agent)
  writeFileSync(join(dir, 'supervisor.pid'), '7001')
  await runner.prompt({ dir }, 'round 1')
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ supervisor: 7001, pid: 7002, prompt: 'a.txt', startedAt: 'x' }))
  await runner.close({ dir })
  assert.deepEqual(readdirSync(join(dir, 'queue')), [])
  assert.deepEqual(killed, ['-7002 SIGTERM', '7001 SIGTERM'])
})

test('closing a headless agent waits until its run and its supervisor are gone, and kills a run that ignores SIGTERM', async () => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-headless-'))
  onTestFinished(() => rmSync(home, { recursive: true, force: true }))
  const killed = []
  // The run's group is -7002.
  const live = new Set([7001, -7002])
  let waited = 0
  const runner = makeHeadless({
    home,
    spawnSupervisor: () => {},
    // The supervisor ends on SIGTERM; the run ignores it, and ends on SIGKILL.
    kill(pid, signal) {
      killed.push(`${pid} ${signal}`)
      if (pid === 7001) live.delete(7001)
      if (pid === -7002 && signal === 'SIGKILL') live.delete(-7002)
    },
    alive: (pid) => live.has(pid),
    sleep: async (ms) => {
      waited += ms
    },
    now: () => new Date('2026-10-05T10:00:00.000Z'),
  })
  const dir = join(home, 'tasks', '140', 'agents', 'reviewer')
  await runner.start({ n: 140, role: 'reviewer', tool: 'pi', model: 'm', cwd: '/w', sessionDir: join(dir, 'sessions'), env: {} })
  writeFileSync(join(dir, 'supervisor.pid'), '7001')
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ supervisor: 7001, pid: 7002, prompt: 'a.txt', startedAt: 'x' }))
  await runner.close({ dir })
  assert.deepEqual(killed, ['-7002 SIGTERM', '7001 SIGTERM', '-7002 SIGKILL'])
  assert.deepEqual([...live], [])
  assert.ok(waited >= 10_000, `waited ${waited} ms`)
})

test('closing a headless agent waits until the whole process group of its run is gone, after its leader too', async () => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-headless-'))
  onTestFinished(() => rmSync(home, { recursive: true, force: true }))
  const killed = []
  // The leader 7002 is gone; a child in its group ignores SIGTERM, and is gone
  // one check after SIGKILL. The supervisor 7001 has crashed.
  let group = 'alive'
  const runner = makeHeadless({
    home,
    spawnSupervisor: () => {},
    kill(pid, signal) {
      killed.push(`${pid} ${signal}`)
      if (pid === -7002 && signal === 'SIGKILL') group = 'dying'
    },
    alive(pid) {
      if (pid !== -7002) return false
      if (group === 'dying') {
        group = 'gone'
        return true
      }
      return group === 'alive'
    },
    sleep: async () => {},
    now: () => new Date('2026-10-05T10:00:00.000Z'),
  })
  const dir = join(home, 'tasks', '140', 'agents', 'reviewer')
  await runner.start({ n: 140, role: 'reviewer', tool: 'pi', model: 'm', cwd: '/w', sessionDir: join(dir, 'sessions'), env: {} })
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ supervisor: 7001, pid: 7002, prompt: 'a.txt', startedAt: 'x' }))
  await runner.close({ dir })
  assert.deepEqual(killed, ['-7002 SIGTERM', '7001 SIGTERM', '-7002 SIGKILL'])
  assert.equal(group, 'gone')
})
