// A log that does not end in a newline, or holds a line that is not JSON, is broken: each command refuses it, and the Lead repairs it by hand.
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const standalone = /scripts[/\\]task[/\\]task\.mjs$/.test(process.argv[1] ?? '')

export const OWNERS = { spec: 'lead', changes: 'reviewer', approved: 'reviewer', building: 'implementer', ready: 'implementer' }

export function readLog(folder) {
  const path = join(folder, 'log.ndjson')
  if (!existsSync(path)) throw new Error(`${path}: no log to read`)
  const text = readFileSync(path, 'utf8')
  if (text === '') throw new Error(`${path}: no line to read`)
  if (!text.endsWith('\n')) throw new Error(`${path}: the log does not end with a newline`)
  return text
    .split('\n')
    .slice(0, -1)
    .map((line, index) => {
      let entry
      try {
        entry = JSON.parse(line)
      } catch (error) {
        throw new Error(`${path}: line ${index + 1} is not JSON`, { cause: error })
      }
      for (const key of ['at', 'role', 'to', 'round']) {
        if (!(key in entry)) throw new Error(`${path}: line ${index + 1} has no ${key}`)
      }
      return entry
    })
}

// A Spec's Task is its slug, and a Part's is `<slug>/<k>`, as its Spec numbers it under its Parts.
export function parseId(text) {
  const match = /^([a-z0-9][a-z0-9-]*)(?:\/([1-9]\d*))?$/.exec(text ?? '')
  if (match === null) return undefined
  return { id: text, slug: match[1], ...(match[2] === undefined ? {} : { part: Number(match[2]) }) }
}

// A Part's id holds a slash, so its folder, its branch and its worktree hold a dot or a dash.
export function folderOf(home, id) {
  return join(home, 'tasks', id.replace('/', '.'))
}

export function nameOf(id) {
  return id.replace('/', '-')
}

export function readTask(folder) {
  const path = join(folder, 'task.json')
  if (!existsSync(path)) throw new Error(`${folder}: no task folder`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${path}: not JSON; repair it by hand`, { cause: error })
    throw error
  }
}

// A Spec has only Round 0. Its approval goes back to `spec` for another pass, such as of its Parts, until a Part is built from it.
// A Part begins at its Spec's approval, so it has no Round 0 of its own.
export function followers(kind, from, round) {
  if (kind === 'spec')
    switch (from) {
      case 'spec':
        return ['changes', 'approved']
      case 'changes':
      case 'approved':
        return ['spec']
      default:
        return []
    }
  switch (from) {
    case 'changes':
      return ['building', 'ready']
    case 'approved':
      return round === 0 ? ['building'] : []
    case 'building':
      return ['ready']
    case 'ready':
      return ['changes', 'approved']
    default:
      return []
  }
}

export function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

export function writeJson(path, value) {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value)}\n`)
  renameSync(tmp, path)
}

export function readTasks(home) {
  const tasks = new Map()
  const unreadable = []
  const folder = join(home, 'tasks')
  if (!existsSync(folder)) return { tasks, unreadable }
  for (const entry of readdirSync(folder, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .toSorted((a, b) => a.name.localeCompare(b.name))) {
    const id = entry.name.replace('.', '/')
    try {
      const record = readTask(join(folder, entry.name))
      const lines = readLog(join(folder, entry.name))
      const last = lines.at(-1)
      tasks.set(id, {
        id,
        folder: join(folder, entry.name),
        kind: record.kind,
        slug: record.slug,
        part: record.part,
        state: last.to,
        round: last.round,
        lines,
      })
    } catch (error) {
      unreadable.push({ id, reason: error.message })
    }
  }
  return { tasks, unreadable }
}

export function readAgents(folder) {
  const path = join(folder, 'agents.json')
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${path}: not JSON; repair it by hand`, { cause: error })
  }
}

export function readEvents(folder) {
  const path = join(folder, 'events.ndjson')
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  if (text === '') return []
  if (!text.endsWith('\n')) throw new Error(`${path}: the log does not end with a newline`)
  return text
    .split('\n')
    .slice(0, -1)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${path}: line ${index + 1} is not JSON`, { cause: error })
      }
    })
}

export function appendEvent(folder, event) {
  writeFileSync(join(folder, 'events.ndjson'), `${JSON.stringify(event)}\n`, { flag: 'a' })
}
