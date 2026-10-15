import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  builderOf,
  familiesSetUp,
  familyOf,
  loadRoles,
  paneArgs,
  parseRole,
  pickReviewer,
  printCommand,
  roleText,
  sessionUuid,
} from './roles.mjs'

const FAMILIES = { zai: 'zai', 'openai-codex': 'openai', anthropic: 'anthropic' }

test('a role names its runner, its tool, its model and its thinking', () => {
  assert.deepEqual(parseRole('headless:pi:zai/glm-5.3@max'), { runner: 'headless', tool: 'pi', model: 'zai/glm-5.3', thinking: 'max' })
  assert.deepEqual(parseRole('subagent:sonnet@high'), { runner: 'subagent', model: 'sonnet', thinking: 'high' })
  assert.deepEqual(parseRole('herdr:codex:gpt-6.1-sol'), { runner: 'herdr', tool: 'codex', model: 'gpt-6.1-sol' })
  assert.deepEqual(parseRole('lead'), { runner: 'lead' })
})

test('a role is written back as it was read', () => {
  for (const text of ['headless:pi:zai/glm-5.3@max', 'subagent:sonnet', 'lead']) assert.equal(roleText(parseRole(text)), text)
})

test('a role with an unknown runner or tool, or no model, is refused', () => {
  assert.throws(() => parseRole('tmux:pi:x'), /starts with lead/)
  assert.throws(() => parseRole('headless:gemini:x'), /tool is one of/)
  assert.throws(() => parseRole('headless:pi:'), /names no model/)
  assert.throws(() => parseRole('lead:opus'), /takes no tool/)
})

test('a family comes from the tool, the provider, or the model name', () => {
  assert.equal(familyOf(parseRole('headless:pi:zai/glm-5.3'), FAMILIES), 'zai')
  assert.equal(familyOf(parseRole('headless:claude:sonnet'), FAMILIES), 'anthropic')
  assert.equal(familyOf(parseRole('headless:codex:gpt-6.1-sol'), FAMILIES), 'openai')
  assert.equal(familyOf(parseRole('subagent:opus'), FAMILIES), 'anthropic')
  assert.equal(familyOf(builderOf('pi:openai-codex/gpt-6.1-sol'), FAMILIES), 'openai')
})

const config = (reviewer, implementer) => ({
  roles: { reviewer: parseRole(reviewer), implementer: parseRole(implementer) },
  families: FAMILIES,
})

test('the reviewer is of another family than the builder', () => {
  const pick = pickReviewer(config('headless:pi:openai-codex/gpt-6.1-sol', 'herdr:pi:zai/glm-5.3'), builderOf('claude:opus'))
  assert.deepEqual(pick, { role: parseRole('headless:pi:openai-codex/gpt-6.1-sol'), family: 'openai', sameFamily: false })
})

test('a builder of the reviewer family gets the other configured role', () => {
  const pick = pickReviewer(config('headless:pi:openai-codex/gpt-6.1-sol', 'herdr:pi:zai/glm-5.3'), builderOf('codex:gpt-6.1-sol'))
  assert.equal(pick.family, 'zai')
})

test('with one family only, the reviewer is of the same family, and the pick says so', () => {
  const pick = pickReviewer(config('headless:claude:sonnet', 'subagent:sonnet'), builderOf('claude:opus'))
  assert.deepEqual(pick, { role: parseRole('headless:claude:sonnet'), family: 'anthropic', sameFamily: true })
})

test("a person's own default replaces each role that it does not name", () => {
  const root = mkdtempSync(join(tmpdir(), 'roles-'))
  const home = mkdtempSync(join(tmpdir(), 'home-'))
  mkdirSync(join(root, '.agents'))
  mkdirSync(join(home, '.binnacle'))
  writeFileSync(
    join(root, '.agents', 'roles.json'),
    JSON.stringify({ implementer: 'herdr:pi:zai/glm-5.3', reviewer: 'headless:pi:openai-codex/x' }),
  )
  writeFileSync(join(home, '.binnacle', 'roles.json'), JSON.stringify({ default: 'subagent:sonnet', reviewer: 'headless:claude:opus' }))
  assert.deepEqual(loadRoles({ root, binnacle: join(home, '.binnacle') }).roles, {
    implementer: parseRole('subagent:sonnet'),
    reviewer: parseRole('headless:claude:opus'),
  })
})

test('each tool runs headless with its model and its thinking, and the prompt last', () => {
  assert.deepEqual(printCommand(parseRole('headless:pi:zai/glm-5.3@max'), 'go'), {
    file: 'pi',
    args: ['-p', '--model', 'zai/glm-5.3', '--thinking', 'max', 'go'],
  })
  assert.deepEqual(printCommand(parseRole('headless:claude:sonnet@high'), 'go').args, [
    '-p',
    '--model',
    'sonnet',
    '--effort',
    'high',
    '--permission-mode',
    'bypassPermissions',
    'go',
  ])
  assert.deepEqual(printCommand(parseRole('headless:codex:gpt-6.1-sol@medium'), 'go').args, [
    'exec',
    '-m',
    'gpt-6.1-sol',
    '-c',
    'model_reasoning_effort=medium',
    '--dangerously-bypass-approvals-and-sandbox',
    'go',
  ])
})

const agent = (tool, model, resume) => ({ tool, model, session: 'cards-2-implementer', sessionDir: '/s', resume })

test('a headless session continues: pi by its name, claude by its UUID, codex by the newest in its checkout', () => {
  assert.deepEqual(printCommand(agent('pi', 'zai/glm-5.3'), 'go').args, [
    '-p',
    '--model',
    'zai/glm-5.3',
    '--session-dir',
    '/s',
    '--session-id',
    'cards-2-implementer',
    'go',
  ])
  const uuid = sessionUuid('cards-2-implementer')
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.deepEqual(printCommand(agent('claude', 'sonnet', false), 'go').args.slice(-3), ['--session-id', uuid, 'go'])
  assert.deepEqual(printCommand(agent('claude', 'sonnet', true), 'go').args.slice(-3), ['--resume', uuid, 'go'])
  assert.deepEqual(printCommand(agent('codex', 'gpt-6.1-sol', true), 'go').args.slice(0, 3), ['exec', 'resume', '--last'])
  assert.deepEqual(printCommand(agent('codex', 'gpt-6.1-sol', false), 'go').args.slice(0, 2), ['exec', '-m'])
})

test('a pane starts each tool with its session, and continues it when started again', () => {
  const pane = { model: 'm', sessionDir: '/s', session: 'cards-reviewer' }
  assert.deepEqual(paneArgs({ ...pane, tool: 'pi', thinking: 'max' }), ['--model', 'm', '--thinking', 'max', '--session-dir', '/s'])
  assert.deepEqual(paneArgs({ ...pane, tool: 'pi', resume: true }).at(-1), '--continue')
  assert.deepEqual(paneArgs({ ...pane, tool: 'claude', resume: true }).slice(-2), ['--resume', sessionUuid('cards-reviewer')])
  assert.deepEqual(paneArgs({ ...pane, tool: 'codex', resume: true }).slice(0, 2), ['resume', '--last'])
})

test('the families set up count the builder, the reviewer and the lead', () => {
  const roles = { implementer: parseRole('subagent:sonnet'), reviewer: parseRole('headless:claude:opus') }
  assert.deepEqual([...familiesSetUp({ roles, lead: builderOf('claude:opus'), families: FAMILIES })], ['anthropic'])
  assert.equal(familiesSetUp({ roles: { ...roles, reviewer: parseRole('headless:pi:zai/glm-5.3') }, families: FAMILIES }).size, 2)
})
