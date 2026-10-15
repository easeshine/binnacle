import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, makeWorld, SPEC, steps } from './world.mjs'
import { run } from './task.mjs'

async function byLead(world) {
  await built(world, 1, '--by', 'lead')
}

test('`task build <slug>/<k> --by lead` records the Lead as the Implementer, and starts no agent', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await byLead(world)
  assert.deepEqual(
    world.runner.starts.map((agent) => agent.role),
    ['reviewer'],
  )
  const agents = JSON.parse(readFileSync(join(world.home, 'tasks', 'cards.1', 'agents.json'), 'utf8'))
  assert.equal(agents.implementer.runner, 'lead')
  assert.equal(world.runner.prompts.length, 1)
})

test('`task build --by lead` refuses when the Lead and the Reviewer are of the same family', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const roles = join(world.repo, '.agents', 'roles.json')
  writeFileSync(roles, JSON.stringify({ ...JSON.parse(readFileSync(roles, 'utf8')), lead: 'codex:gpt-6.1-sol' }))
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  const refused = await run(['build', 'cards/1', '--by', 'lead'], world.deps)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /the builder and the reviewer are of the same family openai/)
})

test("A hand-off to an Implementer that is the Lead starts no agent, and wakes the Lead with the prompt's text", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await byLead(world)
  const worktree = join(world.home, 'worktrees', 'cards-1')
  appendFileSync(join(worktree, 'README.md'), 'one\n')
  git(worktree, ['commit', '-am', 'one'])
  await steps(
    world,
    ['set', 'cards/1', 'building', '--as', 'implementer'],
    ['set', 'cards/1', 'ready', '--as', 'implementer'],
    ['set', 'cards/1', 'changes', '--as', 'reviewer'],
  )
  assert.deepEqual(
    world.runner.prompts.map((prompt) => prompt.role),
    ['reviewer', 'reviewer'],
  )
  await run(['watch'], world.deps)
  const woken = await run(['watch'], world.deps)
  assert.match(woken.stdout, /^cards\/1 implementer \(lead\): Round 1 of cards\/1 has findings: read .*review-1\.md/)
  const nothing = await run(['resend', 'cards/1'], world.deps)
  assert.equal(nothing.code, 1)
  assert.match(nothing.stderr, /no hand-off to resend/)
})

test('`task status` shows the Lead as the Implementer, and `task stop` and the watch leave it alone', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await byLead(world)
  const status = await run(['status', 'cards/1'], world.deps)
  assert.equal(status.code, 0)
  assert.match(status.stdout, /^ {2}implementer lead$/m)
  world.runner.states.reviewer = { state: 'idle' }
  const deps = { ...world.deps, sleep: async () => Promise.reject(new Error('nothing to report')) }
  await run(['watch'], world.deps)
  const quiet = await run(['watch'], deps)
  assert.equal(quiet.stderr, 'nothing to report\n')
  assert.equal((await run(['stop', 'cards/1', '--force'], world.deps)).code, 0)
  assert.deepEqual(world.runner.closed, [], "the Part's Reviewer had no Round, so it never started")
})
