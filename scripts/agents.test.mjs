import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { builderOf, familyOf, headlessCommand, loadRoles, parseRole, pickReviewer, roleText } from './agents.mjs'

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
  assert.deepEqual(loadRoles({ root, home }).roles, {
    implementer: parseRole('subagent:sonnet'),
    reviewer: parseRole('headless:claude:opus'),
  })
})

test('each tool runs headless with its model and its thinking, and the prompt last', () => {
  assert.deepEqual(headlessCommand(parseRole('headless:pi:zai/glm-5.3@max'), 'go'), {
    file: 'pi',
    args: ['-p', '--model', 'zai/glm-5.3', '--thinking', 'max', 'go'],
  })
  assert.deepEqual(headlessCommand(parseRole('headless:claude:sonnet@high'), 'go').args, [
    '-p',
    '--model',
    'sonnet',
    '--effort',
    'high',
    '--permission-mode',
    'bypassPermissions',
    'go',
  ])
  assert.deepEqual(headlessCommand(parseRole('headless:codex:gpt-6.1-sol@medium'), 'go').args, [
    'exec',
    '-m',
    'gpt-6.1-sol',
    '-c',
    'model_reasoning_effort=medium',
    '--dangerously-bypass-approvals-and-sandbox',
    'go',
  ])
})
