import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const RUNNERS = ['lead', 'subagent', 'headless', 'herdr']
export const TOOLS = ['claude', 'codex', 'pi']

// `headless:pi:zai/glm-5.3@max`, `subagent:sonnet@high`, `lead`.
export function parseRole(text) {
  const [runner, ...rest] = text.split(':')
  if (!RUNNERS.includes(runner)) throw new Error(`${text}: a role starts with ${RUNNERS.join(', ')}`)
  if (runner === 'lead') {
    if (rest.length > 0) throw new Error(`${text}: the lead takes no tool and no model`)
    return { runner }
  }
  const tool = runner === 'subagent' ? undefined : rest.shift()
  if (tool !== undefined && !TOOLS.includes(tool)) throw new Error(`${text}: the tool is one of ${TOOLS.join(', ')}`)
  const [model, thinking] = rest.join(':').split('@')
  if (model === '') throw new Error(`${text}: names no model`)
  return { runner, ...(tool === undefined ? {} : { tool }), model, ...(thinking === undefined ? {} : { thinking }) }
}

export function roleText(role) {
  if (role.runner === 'lead') return 'lead'
  return [role.runner, role.tool, `${role.model}${role.thinking === undefined ? '' : `@${role.thinking}`}`].filter(Boolean).join(':')
}

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})

// The committed file holds the Maintainer's roles. A person's own file in ~/.binnacle replaces a role,
// and its `default` replaces every role it does not name: one agent can take each role.
export function loadRoles({ root, binnacle }) {
  const shared = readJson(join(root, '.agents', 'roles.json'))
  const own = readJson(join(binnacle, 'roles.json'))
  const roles = {}
  for (const name of ['implementer', 'reviewer']) {
    const text = own[name] ?? own.default ?? shared[name]
    if (text === undefined) throw new Error(`no role ${name} in .agents/roles.json`)
    roles[name] = parseRole(text)
  }
  const lead = own.lead ?? shared.lead
  return { roles, ...(lead === undefined ? {} : { lead: builderOf(lead) }), families: { ...shared.families, ...own.families } }
}

// Two families set up means a review of another family is possible, so one family for both roles is refused.
export function familiesSetUp({ roles, lead, families }) {
  return new Set(
    [roles.implementer, roles.reviewer, lead]
      .filter(Boolean)
      .map((role) => familyOf(role, families))
      .filter(Boolean),
  )
}

export function familyOf(role, families) {
  if (role.runner === 'lead') return undefined
  if (role.tool === 'pi') return families[role.model.split('/')[0]]
  if (role.tool === 'claude') return 'anthropic'
  if (role.tool === 'codex') return 'openai'
  const model = role.model ?? ''
  if (model.includes('/')) return families[model.split('/')[0]]
  if (/claude|opus|sonnet|haiku|fable/.test(model)) return 'anthropic'
  if (/gpt|codex/.test(model)) return 'openai'
  return undefined
}

// A builder names itself as `<tool>:<model>`, or a subagent's model alone, such as `claude:opus` or `pi:zai/glm-5.3`.
export function builderOf(text) {
  const [first, ...rest] = text.split(':')
  if (TOOLS.includes(first) && rest.length > 0) return { runner: 'headless', tool: first, model: rest.join(':') }
  return { runner: 'subagent', model: text }
}

// The first configured role of another family than the builder's. With one family only,
// the reviewer is a fresh session of the same family, and the record says so.
export function pickReviewer({ roles, families }, builder) {
  const mine = familyOf(builder, families)
  for (const role of [roles.reviewer, roles.implementer]) {
    const family = familyOf(role, families)
    if (role.runner !== 'lead' && family !== undefined && family !== mine) return { role, family, sameFamily: false }
  }
  return { role: roles.reviewer, family: familyOf(roles.reviewer, families), sameFamily: true }
}

// claude takes a session id that is a UUID, so each session name gives one.
export function sessionUuid(name) {
  const hex = createHash('sha1').update(name).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const effort = (flag, thinking) => (thinking === undefined ? [] : [flag, thinking])

// The arguments that start a role's tool in a pane. An agent started again continues its session:
// pi from its session folder, claude from its UUID, and codex from the newest session in its checkout.
export function paneArgs(agent) {
  const { tool, model, thinking } = agent
  if (tool === 'pi')
    return [
      '--model',
      model,
      ...effort('--thinking', thinking),
      '--session-dir',
      agent.sessionDir,
      ...(agent.resume ? ['--continue'] : agent.fork === undefined ? [] : ['--fork', agent.fork]),
    ]
  // The agent works in a checkout of its own, so it runs without permission prompts, as pi does.
  if (tool === 'claude')
    return [
      '--model',
      model,
      ...effort('--effort', thinking),
      '--permission-mode',
      'bypassPermissions',
      agent.resume ? '--resume' : '--session-id',
      sessionUuid(agent.session),
    ]
  if (tool === 'codex')
    return [
      ...(agent.resume ? ['resume', '--last'] : []),
      '-m',
      model,
      ...effort('-c', thinking === undefined ? undefined : `model_reasoning_effort=${thinking}`),
      '--dangerously-bypass-approvals-and-sandbox',
    ]
  throw new Error(`the tool is one of ${TOOLS.join(', ')}, not ${tool ?? 'none'}`)
}

// The command that runs one prompt headless. Its final message comes on stdout.
// With a session, a later prompt continues it. With none, each run is fresh.
export function printCommand(agent, prompt) {
  const { tool, model, thinking, session } = agent
  if (tool === 'pi')
    return {
      file: 'pi',
      args: [
        '-p',
        '--model',
        model,
        ...effort('--thinking', thinking),
        ...(session === undefined ? [] : ['--session-dir', agent.sessionDir, '--session-id', session]),
        prompt,
      ],
    }
  if (tool === 'claude')
    return {
      file: 'claude',
      args: [
        '-p',
        '--model',
        model,
        ...effort('--effort', thinking),
        '--permission-mode',
        'bypassPermissions',
        ...(session === undefined ? [] : [agent.resume ? '--resume' : '--session-id', sessionUuid(session)]),
        prompt,
      ],
    }
  if (tool === 'codex')
    return {
      file: 'codex',
      args: [
        'exec',
        ...(session !== undefined && agent.resume ? ['resume', '--last'] : []),
        '-m',
        model,
        ...effort('-c', thinking === undefined ? undefined : `model_reasoning_effort=${thinking}`),
        '--dangerously-bypass-approvals-and-sandbox',
        prompt,
      ],
    }
  throw new Error(`a headless run takes ${TOOLS.join(', ')}, not ${tool ?? 'no tool'}`)
}

const newest = (files) => files.reduce((last, file) => Math.max(last, statSync(file).mtimeMs), 0) || undefined

// When the agent's tool last wrote its session: the watch reads a long silence as a stall.
export function sessionWritten(agent, userHome) {
  if (agent.tool === 'pi') {
    if (agent.sessionDir === undefined || !existsSync(agent.sessionDir)) return undefined
    return newest(
      readdirSync(agent.sessionDir)
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => join(agent.sessionDir, name)),
    )
  }
  if (agent.tool === 'claude') {
    const file = join(userHome, '.claude', 'projects', agent.cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionUuid(agent.session)}.jsonl`)
    return existsSync(file) ? statSync(file).mtimeMs : undefined
  }
  if (agent.tool === 'codex') return codexWritten(agent.cwd, userHome)
  return undefined
}

// codex keeps each session by date, and names its checkout in the session's first line.
function codexWritten(cwd, userHome) {
  const root = join(userHome, '.codex', 'sessions')
  if (!existsSync(root)) return undefined
  const days = []
  for (const year of readdirSync(root).toSorted().slice(-1))
    for (const month of readdirSync(join(root, year)).toSorted().slice(-2))
      for (const day of readdirSync(join(root, year, month))
        .toSorted()
        .slice(-3))
        days.push(join(root, year, month, day))
  const mine = days
    .flatMap((day) => readdirSync(day).map((name) => join(day, name)))
    .filter(
      (file) =>
        file.endsWith('.jsonl') &&
        readFileSync(file, 'utf8')
          .split('\n', 1)[0]
          .includes(`"cwd":${JSON.stringify(cwd)}`),
    )
  return newest(mine)
}

// The run's whole process group is stopped at its time limit: a child can outlive the leader.
export function runHeadless(role, prompt, { cwd, timeout, log }) {
  const { file, args } = printCommand(role, prompt)
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk) => {
      out += chunk
    })
    child.stderr.on('data', (chunk) => log?.(chunk))
    const timer = setTimeout(() => {
      process.kill(-child.pid, 'SIGTERM')
      reject(new Error(`${file} ran past ${timeout / 60000} min, and was stopped`))
    }, timeout)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out.trim())
      else reject(new Error(`${file} exited ${code}`))
    })
  })
}
