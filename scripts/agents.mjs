import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
export function loadRoles({ root, home }) {
  const shared = readJson(join(root, '.agents', 'roles.json'))
  const own = readJson(join(home, '.binnacle', 'roles.json'))
  const roles = {}
  for (const name of ['implementer', 'reviewer']) {
    const text = own[name] ?? own.default ?? shared[name]
    if (text === undefined) throw new Error(`no role ${name} in .agents/roles.json`)
    roles[name] = parseRole(text)
  }
  return { roles, families: { ...shared.families, ...own.families } }
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

// Each headless run starts a fresh session, and gives its final message on stdout.
export function headlessCommand(role, prompt) {
  const { tool, model, thinking } = role
  if (tool === 'pi') return { file: 'pi', args: ['-p', '--model', model, ...(thinking ? ['--thinking', thinking] : []), prompt] }
  // The agent works in a checkout of its own, so it runs without permission prompts, as pi does.
  if (tool === 'claude')
    return {
      file: 'claude',
      args: ['-p', '--model', model, ...(thinking ? ['--effort', thinking] : []), '--permission-mode', 'bypassPermissions', prompt],
    }
  if (tool === 'codex')
    return {
      file: 'codex',
      args: [
        'exec',
        '-m',
        model,
        ...(thinking ? ['-c', `model_reasoning_effort=${thinking}`] : []),
        '--dangerously-bypass-approvals-and-sandbox',
        prompt,
      ],
    }
  throw new Error(`a headless run takes ${TOOLS.join(', ')}, not ${tool ?? 'no tool'}`)
}

// The run's whole process group is stopped at its time limit: a child can outlive the leader.
export function runHeadless(role, prompt, { cwd, timeout, log }) {
  const { file, args } = headlessCommand(role, prompt)
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
