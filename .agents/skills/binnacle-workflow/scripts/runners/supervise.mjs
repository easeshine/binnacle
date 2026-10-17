// A run gets no standard input: when it is not a terminal, pi reads it to its end before it starts (`pi:packages/coding-agent/src/main.ts`).
// Each run leads its own process group, so the time limit also stops its children.
import { spawn as spawnProcess } from 'node:child_process'
import { closeSync, existsSync, linkSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { printCommand } from '../../../../roles.mjs'
import { locked } from '../lock.mjs'
import { alive, appendEvent, readAgents, readTasks, writeJson } from '../state.mjs'

export const LIMIT = 45 * 60_000

export const GRACE = 10_000

export const IDLE = 10 * 60_000

// The states in which a Task waits on each role to move it.
export const WAITS = {
  reviewer: (line) => line.to === 'spec' || line.to === 'ready',
  implementer: (line) => line.to === 'building' || line.to === 'changes' || (line.to === 'approved' && line.round === 0),
}

// A run can end without its work, as when the tool's quota runs out. Each Task that the agent serves, and that still waits on it, says so.
function stillWaiting(agent, folder) {
  const waits = WAITS[agent.role]
  if (waits === undefined) return undefined
  let tasks
  try {
    tasks = readTasks(agent.home).tasks
  } catch {
    // The run's end is still recorded; only the check is lost.
    return undefined
  }
  const owner = [...tasks.values()].find((task) => task.folder === folder)
  if (owner === undefined) return undefined
  for (const task of tasks.values()) {
    let of
    try {
      of = readAgents(task.folder)[agent.role]?.of
    } catch {
      continue
    }
    if (task.folder !== folder && of !== owner.id) continue
    if (waits(task.lines.at(-1))) return task
  }
  return undefined
}

function lastLine(path) {
  try {
    return readFileSync(path, 'utf8').trim().split('\n').at(-1).slice(0, 300)
  } catch {
    return ''
  }
}

export function waiting(dir) {
  const queue = join(dir, 'queue')
  if (!existsSync(queue)) return []
  return readdirSync(queue)
    .filter((name) => name.endsWith('.txt'))
    .toSorted()
}

export async function supervise(dir, deps) {
  const agent = JSON.parse(readFileSync(join(dir, 'agent.json'), 'utf8'))
  const folder = dirname(dirname(dir))
  const claim = join(dir, 'supervisor.pid')
  const candidate = join(dir, `supervisor.pid.${process.pid}.tmp`)
  writeFileSync(candidate, String(process.pid))
  // Under the task lock, as a wake removes a stale claim: so a wake never
  // removes a claim that was made after it looked.
  const claimed = await locked({ home: agent.home, sleep: deps.sleep }, () => {
    try {
      linkSync(candidate, claim)
      return true
    } catch (error) {
      if (error.code === 'EEXIST') return false
      throw error
    } finally {
      rmSync(candidate, { force: true })
    }
  })
  if (!claimed) return
  const event = (name, detail) => appendEvent(folder, { at: deps.now().toISOString(), event: name, role: agent.role, detail })
  let idleSince = deps.now()
  while (true) {
    const [next] = waiting(dir)
    if (next === undefined) {
      if (deps.now().getTime() - idleSince.getTime() >= IDLE) {
        // Under the lock, so a prompt that comes now sees no supervisor and
        // starts a new one.
        const done = await locked({ home: agent.home, sleep: deps.sleep }, () => {
          if (waiting(dir).length > 0) return false
          rmSync(claim, { force: true })
          return true
        })
        if (done) return
      }
      await deps.sleep(1000)
      continue
    }
    const path = join(dir, 'queue', next)
    const text = readFileSync(path, 'utf8')
    let child
    try {
      // The first run starts the session, and each later run continues it.
      const { file, args } = printCommand({ ...agent, resume: existsSync(join(dir, 'started')) }, text)
      child = deps.spawn(file, args, { cwd: agent.cwd, env: agent.env, out: join(dir, 'out.log') })
      if (child.pid !== undefined) writeFileSync(join(dir, 'started'), '')
    } catch (error) {
      child = { pid: undefined, exited: Promise.resolve(-1), error: error.message }
    }
    writeJson(join(dir, 'run.json'), { supervisor: process.pid, pid: child.pid, prompt: next, startedAt: deps.now().toISOString() })
    const ended = await Promise.race([child.exited.then((code) => ({ code })), deps.timer(LIMIT).then(() => undefined)])
    if (ended === undefined) {
      deps.kill(-child.pid, 'SIGTERM')
      const stopped = await Promise.race([child.exited.then(() => true), deps.timer(GRACE).then(() => false)])
      if (!stopped) deps.kill(-child.pid, 'SIGKILL')
      await child.exited
      event('timed-out', { prompt: next, minutes: LIMIT / 60_000 })
    } else if (child.error !== undefined) event('run-failed', { prompt: next, error: child.error })
    else {
      const left = waiting(dir).length === 1 ? stillWaiting(agent, folder) : undefined
      if (left === undefined) event('run-ended', { prompt: next, code: ended.code })
      else
        event('run-failed', {
          prompt: next,
          task: left.id,
          error: `ended, and ${left.id} still waits on the ${agent.role} at ${left.state}: ${lastLine(join(dir, 'out.log'))}; run task resend ${left.id}`,
        })
    }
    rmSync(path, { force: true })
    rmSync(join(dir, 'run.json'), { force: true })
    idleSince = deps.now()
  }
}

export function supervised(dir) {
  try {
    const owner = readFileSync(join(dir, 'supervisor.pid'), 'utf8').trim()
    return /^\d+$/.test(owner) && alive(Number(owner))
  } catch {
    return false
  }
}

export function systemDeps(onSpawn = () => {}) {
  return {
    spawn(file, args, options) {
      const out = openSync(options.out, 'a')
      const child = spawnProcess(file, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', out, out],
        detached: true,
      })
      closeSync(out)
      const run = { pid: child.pid, error: undefined }
      // A tool that cannot start emits `error`, and no `exit`.
      run.exited = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve(code ?? 128 + (signal === 'SIGKILL' ? 9 : 15)))
        child.on('error', (error) => {
          run.error = error.message
          resolve(-1)
        })
      })
      if (child.pid !== undefined) onSpawn(child.pid)
      return run
    },
    kill(pid, signal) {
      try {
        process.kill(pid, signal)
      } catch {
        // Gone already.
      }
    },
    timer: (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref()),
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]
  let current
  const deps = systemDeps((pid) => (current = pid))
  // Stopped from outside, the supervisor stops its run, then lets its claim go.
  const leave = () => {
    if (current !== undefined) deps.kill(-current, 'SIGTERM')
    setTimeout(() => {
      if (current !== undefined) deps.kill(-current, 'SIGKILL')
      try {
        if (readFileSync(join(dir, 'supervisor.pid'), 'utf8').trim() === String(process.pid)) rmSync(join(dir, 'supervisor.pid'))
      } catch {
        // Gone already.
      }
      process.exit(143)
    }, GRACE)
  }
  process.on('SIGTERM', leave)
  process.on('SIGINT', leave)
  await supervise(dir, deps)
}
