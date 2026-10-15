import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, makeWorld, SPEC, steps } from './world.mjs'
import { run } from './task.mjs'

function agentsOf(world, id) {
  return JSON.parse(readFileSync(join(world.home, 'tasks', id.replace('/', '.'), 'agents.json'), 'utf8'))
}

async function ready(world, id) {
  const worktree = join(world.home, 'worktrees', id.replace('/', '-'))
  appendFileSync(join(worktree, 'README.md'), 'one\n')
  git(worktree, ['commit', '-am', 'one'])
  await steps(world, ['set', id, 'building', '--as', 'implementer'], ['set', id, 'ready', '--as', 'implementer'])
}

async function approved(world) {
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
}

test('`task start <slug> --reviewer <role>` and `task build --by <role>` name the runner, the tool and the model, and the family comes from them', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC, '--reviewer', 'headless:pi:google/gemini-3-pro@high'], ['set', SPEC, 'approved', '--as', 'reviewer'])
  const {
    handle: _handle,
    startedAt: _startedAt,
    cwd: _cwd,
    sessionDir: _dir,
    session: _session,
    ...setting
  } = agentsOf(world, SPEC).reviewer
  assert.deepEqual(setting, {
    role: 'reviewer',
    runner: 'headless',
    tool: 'pi',
    model: 'google/gemini-3-pro',
    thinking: 'high',
    family: 'google',
  })
  await steps(world, ['build', `${SPEC}/1`, '--by', 'herdr:codex:gpt-6.1-sol'])
  const { implementer, reviewer } = agentsOf(world, `${SPEC}/1`)
  assert.equal(`${implementer.runner} ${implementer.tool} ${implementer.model} ${implementer.family}`, 'herdr codex gpt-6.1-sol openai')
  assert.deepEqual(reviewer, { role: 'reviewer', of: SPEC }, "a Part's Reviewer is its Spec's")
})

test('With two families set up, `task build` refuses a builder and a Reviewer of one family, unless it gets `--same-family`', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world)
  const refused = await run(['build', `${SPEC}/1`, '--by', 'herdr:pi:openai-codex/gpt-6-luna'], world.deps)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /the builder and the reviewer are of the same family openai; choose another, or pass --same-family/)

  const subagents = await run(['build', `${SPEC}/1`, '--by', 'subagent:sonnet', '--reviewer', 'subagent:opus'], world.deps)
  assert.equal(subagents.code, 1)
  assert.match(subagents.stderr, /of the same family anthropic/)

  await steps(world, ['build', `${SPEC}/1`, '--by', 'herdr:pi:openai-codex/gpt-6-luna', '--same-family'])
  assert.equal(agentsOf(world, `${SPEC}/1`).implementer.model, 'openai-codex/gpt-6-luna')
})

test("With one family set up, as a person with one agent has, `task build` takes one family for both roles, and the Part's record says so", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  writeFileSync(join(world.home, 'roles.json'), JSON.stringify({ default: 'subagent:sonnet', lead: 'claude:opus' }))
  await approved(world)
  const result = await run(['build', `${SPEC}/1`], world.deps)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /, by one family, anthropic\n/)
  assert.equal(JSON.parse(readFileSync(join(world.home, 'tasks', `${SPEC}.1`, 'task.json'), 'utf8')).sameFamily, true)
})

test('`task build` refuses a model whose provider has no family, and a choice that is not a role', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world)
  const unknown = await run(['build', `${SPEC}/1`, '--by', 'herdr:pi:mistral/large'], world.deps)
  assert.equal(unknown.code, 1)
  assert.match(unknown.stderr, /herdr:pi:mistral\/large: no family; add its provider to families in roles\.json/)
  for (const by of ['pi', 'herdr:gemini:x', 'subagent:']) {
    const bad = await run(['build', `${SPEC}/1`, '--by', by], world.deps)
    assert.equal(bad.code, 2, by)
  }
  const leadReviewer = await run(['build', `${SPEC}/1`, '--reviewer', 'lead'], world.deps)
  assert.equal(leadReviewer.code, 2)
  assert.match(leadReviewer.stderr, /only the builder can be the Lead/)
})

test("`task build --by subagent:<model>` starts no agent: it records the subagent, and gives the Lead the Implementer's prompt", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world)
  const startsBefore = world.runner.starts.length

  const result = await run(['build', `${SPEC}/1`, '--by', 'subagent:sonnet'], world.deps)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(world.runner.starts.length, startsBefore)
  assert.match(
    result.stdout.split('\n')[1],
    /^task cards\/1: for the implementer \(subagent\): You are the Implementer\. .*Build Part 1 of the Spec intents\/cards\/spec\.md/,
  )
  const { implementer } = agentsOf(world, `${SPEC}/1`)
  assert.equal(`${implementer.runner} ${implementer.model} ${implementer.family}`, 'subagent sonnet anthropic')
  const status = await run(['status', `${SPEC}/1`], world.deps)
  assert.match(status.stdout, /^ {2}implementer subagent:sonnet$/m)
  assert.match(status.stdout, /^ {2}reviewer of the Spec cards$/m)
})

test('A Reviewer chosen for the Part starts at its first `ready`, in its own checkout, and that prompt tells it its role', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead', '--reviewer', 'herdr:pi:google/gemini-3-pro')
  assert.deepEqual(
    world.runner.starts.map((agent) => `${agent.role} ${agent.cwd}`),
    [`reviewer ${join(world.home, 'worktrees', `${SPEC}-review`)}`],
  )
  await ready(world, `${SPEC}/1`)
  assert.equal(world.runner.starts.at(-1).cwd, join(world.home, 'worktrees', `${SPEC}-1-review`))
  assert.match(
    world.runner.prompts.at(-1).text,
    /^You are the Reviewer\. Read .*reviewer\.md first\. Round 1 of Part 1 of the Spec cards at /,
  )
})

test('A hand-off to a subagent wakes the Lead with its prompt, and names the subagent', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead', '--reviewer', 'subagent:opus', '--same-family')
  await ready(world, `${SPEC}/1`)
  await run(['watch'], world.deps)
  const woken = await run(['watch'], world.deps)
  assert.match(woken.stdout, /^cards\/1 reviewer \(subagent\): You are the Reviewer\. .*Round 1 of Part 1 of the Spec cards/)
})
