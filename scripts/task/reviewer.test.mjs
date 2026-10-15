import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, logLines, makeWorld, SPEC, steps } from './world.mjs'
import { run } from './task.mjs'

function agentsOf(world, id) {
  return JSON.parse(readFileSync(join(world.home, 'tasks', id.replace('/', '.'), 'agents.json'), 'utf8'))
}

async function ready(world, id) {
  const worktree = join(world.home, 'worktrees', id.replace('/', '-'))
  appendFileSync(join(worktree, 'README.md'), `${id}\n`)
  git(worktree, ['commit', '-am', id])
  await steps(world, ['set', id, 'building', '--as', 'implementer'], ['set', id, 'ready', '--as', 'implementer'])
}

test("A Part's Rounds go to its Spec's Reviewer, in the Spec's checkout, and no other Reviewer starts", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead')
  assert.equal(existsSync(join(world.home, 'worktrees', 'cards-1-review')), false)

  await ready(world, 'cards/1')

  assert.deepEqual(
    world.runner.starts.map((agent) => `${agent.role} ${agent.cwd}`),
    [`reviewer ${join(world.home, 'worktrees', `${SPEC}-review`)}`],
  )
  assert.match(
    world.runner.prompts.at(-1).text,
    new RegExp(
      `^Round 1 of Part 1 of the Spec cards at \\w+: .*In your checkout ${join(world.home, 'worktrees', `${SPEC}-review`)}, .*Write the report to ${join(world.home, 'tasks', 'cards.1', 'review-1.md')}`,
    ),
  )
  assert.deepEqual(agentsOf(world, 'cards/1').reviewer, { role: 'reviewer', of: SPEC })
  const status = await run(['status', 'cards/1'], world.deps)
  assert.match(status.stdout, new RegExp(`^ {2}reviewer of the Spec ${SPEC}$`, 'm'))
})

test("A Part whose Spec's Reviewer is gone starts it again, from the Spec's own setting, and it continues its session", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead')
  const sessions = join(world.home, 'tasks', SPEC, 'agents', 'reviewer', 'sessions')
  mkdirSync(sessions, { recursive: true })
  writeFileSync(join(sessions, '2026-10-05T10-00-00_a.jsonl'), '{}\n')
  world.runner.states.reviewer = { state: 'gone' }

  await ready(world, 'cards/1')

  const again = world.runner.starts.at(-1)
  assert.equal(world.runner.starts.length, 2)
  assert.equal(again.sessionDir, join(world.home, 'tasks', SPEC, 'agents', 'reviewer', 'sessions'))
  assert.equal(again.cwd, join(world.home, 'worktrees', `${SPEC}-review`))
  assert.equal(again.model, 'openai-codex/gpt-6.1-sol')
  assert.equal(again.resume, true, 'it continues the session that it had')
  assert.equal(agentsOf(world, SPEC).reviewer.startedAt, '2026-10-05T10:05:00.000Z')
})

test("`task build --fresh-reviewer` gives the Part a Reviewer of its own, forked from the Spec Reviewer's session", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  const sessions = join(world.home, 'tasks', SPEC, 'agents', 'reviewer', 'sessions')
  mkdirSync(sessions, { recursive: true })
  writeFileSync(join(sessions, '2026-10-05T10-00-00_a.jsonl'), '{}\n')
  writeFileSync(join(sessions, '2026-10-05T10-01-00_b.jsonl'), '{}\n')

  await steps(world, ['build', 'cards/1', '--by', 'lead', '--fresh-reviewer'])
  await ready(world, 'cards/1')

  const forked = world.runner.starts.at(-1)
  assert.equal(forked.cwd, join(world.home, 'worktrees', 'cards-1-review'))
  assert.equal(forked.fork, join(sessions, '2026-10-05T10-01-00_b.jsonl'))
  assert.equal(forked.sessionDir, join(world.home, 'tasks', 'cards.1', 'agents', 'reviewer', 'sessions'))
  assert.match(world.runner.prompts.at(-1).text, /^You are the Reviewer\. .*Round 1 of Part 1 of the Spec cards/)
})

test('`task build --fresh-reviewer` refuses a Spec whose Reviewer has no session, and goes with no `--reviewer`', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  const none = await run(['build', 'cards/1', '--fresh-reviewer'], world.deps)
  assert.equal(none.code, 1)
  assert.match(none.stderr, /the Spec cards's Reviewer has no session to fork/)
  const both = await run(['build', 'cards/1', '--fresh-reviewer', '--reviewer', 'herdr:pi:google/gemini-3-pro'], world.deps)
  assert.equal(both.code, 2)
})

test("`task stop <slug>/<k>` leaves its Spec's Reviewer and checkout, and `task stop <slug>` refuses while a Part of it runs", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead')

  const early = await run(['stop', SPEC], world.deps)
  assert.equal(early.code, 1)
  assert.match(early.stderr, /the Part cards\/1 of the Spec cards is not stopped; stop it first, or pass --force/)

  await steps(world, ['stop', 'cards/1', '--force'])
  assert.deepEqual(world.runner.closed, [])
  assert.equal(existsSync(join(world.home, 'worktrees', `${SPEC}-review`)), true)

  await steps(world, ['stop', SPEC])
  assert.deepEqual(world.runner.closed, ['reviewer'])
  assert.equal(existsSync(join(world.home, 'worktrees', `${SPEC}-review`)), false)
})

test('An approved Spec goes back to `spec` for another pass of Round 0, until a Part of it is built', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  world.reply(SPEC)
  await steps(world, ['set', SPEC, 'spec'])

  assert.deepEqual(logLines(world, SPEC).at(-1), { at: '2026-10-05T10:03:00.000Z', role: 'lead', from: 'approved', to: 'spec', round: 0 })
  assert.match(world.runner.prompts.at(-1).text, /^Round 0, pass 2 of cards: .*review-0-2\.md/)

  await steps(world, ['set', SPEC, 'approved', '--as', 'reviewer'])
  await steps(world, ['build', 'cards/1', '--by', 'lead'])
  const late = await run(['set', SPEC, 'spec'], world.deps)
  assert.equal(late.code, 1)
  assert.match(late.stderr, /task cards: the Part cards\/1 is built from it; the Spec stays approved/)
})
