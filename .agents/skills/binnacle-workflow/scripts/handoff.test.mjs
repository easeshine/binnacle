import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, makeWorld, SPEC, steps } from './world.mjs'
import { run } from './task.mjs'

function events(world, id) {
  const path = join(world.home, 'tasks', id.replace('/', '.'), 'events.ndjson')
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const PART = `${SPEC}/1`

async function building(world) {
  await built(world, 1)
}

function commit(world, id, message) {
  const worktree = join(world.home, 'worktrees', id.replace('/', '-'))
  appendFileSync(join(worktree, 'README.md'), `${message}\n`)
  git(worktree, ['commit', '-am', message])
  return git(worktree, ['rev-parse', 'HEAD'])
}

test("`task start <slug>` makes the Reviewer's checkout, starts the Reviewer with the role that `.agents/roles.json` names, and sends it round 0", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'])

  const review = join(world.home, 'worktrees', 'menus-review')
  assert.equal(git(review, ['rev-parse', 'HEAD']), git(world.repo, ['rev-parse', 'origin/main']))
  const [agent] = world.runner.starts
  assert.deepEqual(agent, {
    n: 'menus',
    role: 'reviewer',
    tool: 'pi',
    model: 'openai-codex/gpt-6.1-sol',
    thinking: 'medium',
    cwd: review,
    sessionDir: join(world.home, 'tasks', 'menus', 'agents', 'reviewer', 'sessions'),
    session: 'menus-reviewer',
    env: { BINNACLE_TASK: 'menus', BINNACLE_ROLE: 'reviewer' },
  })
  assert.equal(world.runner.prompts.length, 1)
  assert.equal(world.runner.prompts[0].role, 'reviewer')
  assert.match(
    world.runner.prompts[0].text,
    /^You are the Reviewer\. Read .*binnacle-workflow\/reviewer\.md first\. Round 0 of the Spec menus.*tasks\/menus\/review-0\.md/,
  )
  assert.deepEqual(
    events(world, 'menus').map((event) => `${event.event} ${event.role} ${event.detail.id}`),
    ['handoff reviewer h1', 'started reviewer h1', 'prompted reviewer h1'],
  )
})

test('`task build <slug>/<k>` starts the Implementer with the role that `.agents/roles.json` names, and sends it the Part', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1)
  assert.deepEqual(
    world.runner.starts.map((agent) => `${agent.role} ${agent.model} ${agent.cwd} ${agent.session}`),
    [
      `reviewer openai-codex/gpt-6.1-sol ${join(world.home, 'worktrees', `${SPEC}-review`)} cards-reviewer`,
      `implementer zai/glm-5.3 ${join(world.home, 'worktrees', 'cards-1')} cards-1-implementer`,
    ],
  )
  assert.match(
    world.runner.prompts.at(-1).text,
    /^You are the Implementer\. Read .*implementer\.md first\. Build Part 1 of the Spec intents\/cards\/spec\.md .* on the branch task\/cards-1\./,
  )
})

test('Each agent that the tool starts knows its task and its role, so `task set` needs no `--as`', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  const implementer = { ...world.deps, env: { BINNACLE_TASK: PART, BINNACLE_ROLE: 'implementer' } }
  const set = await run(['set', 'building'], implementer)
  assert.equal(set.code, 0, set.stderr)
  assert.equal(set.stdout, 'task cards/1: building round 0\n')
  const mixed = await run(['set', 'ready', '--as', 'reviewer'], implementer)
  assert.equal(mixed.code, 1)
  assert.match(mixed.stderr, /--as reviewer differs from BINNACLE_ROLE implementer/)
})

test('A state that hands the task on sends the hand-off to the next role: `ready` sends the tip to the Reviewer, and `changes` after round 0 sends the report to the Implementer', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  const base = git(world.repo, ['rev-parse', 'origin/main'])
  const first = commit(world, PART, 'one')
  await steps(world, ['set', PART, 'building', '--as', 'implementer'], ['set', PART, 'ready', '--as', 'implementer'])
  const review = world.runner.prompts.at(-1)
  assert.equal(review.role, 'reviewer')
  assert.match(
    review.text,
    new RegExp(`^Round 1 of Part 1 of the Spec cards at ${first}: the commits ${base}\\.\\.${first}\\..*review-1\\.md`),
  )

  await steps(world, ['set', PART, 'changes', '--as', 'reviewer'])
  assert.equal(world.runner.prompts.at(-1).role, 'implementer')
  assert.match(world.runner.prompts.at(-1).text, /^Round 1 of cards\/1 has findings: read .*tasks\/cards\.1\/review-1\.md in full/)

  const second = commit(world, PART, 'two')
  await steps(world, ['set', PART, 'ready', '--as', 'implementer'])
  assert.match(
    world.runner.prompts.at(-1).text,
    new RegExp(`^Round 2 of Part 1 of the Spec cards at ${second}: the commits ${first}\\.\\.${second}\\.`),
  )
})

test('`approved` after round 0 asks the Implementer for `message.md`, and wakes the Lead', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  commit(world, PART, 'one')
  await steps(
    world,
    ['set', PART, 'building', '--as', 'implementer'],
    ['set', PART, 'ready', '--as', 'implementer'],
    ['set', PART, 'approved', '--as', 'reviewer'],
  )
  assert.equal(world.runner.prompts.at(-1).role, 'implementer')
  assert.match(world.runner.prompts.at(-1).text, /^Round 1 of cards\/1 is approved\. Write .*tasks\/cards\.1\/message\.md/)
  assert.equal((await run(['watch'], world.deps)).stdout, `${SPEC} approved round 0 (reviewer)\n`)
  assert.equal((await run(['watch'], world.deps)).stdout, 'cards/1 approved round 1 (reviewer)\n')
})

test('`task answer` sends the answer to the role that asked', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  const folder = join(world.home, 'tasks', 'cards.1')
  writeFileSync(join(folder, 'question.md'), 'Which seam?\n')
  await steps(world, ['ask', PART, '--as', 'implementer'])
  writeFileSync(join(folder, 'answer.md'), 'The command.\n')
  await steps(world, ['answer', PART])
  assert.equal(world.runner.prompts.at(-1).role, 'implementer')
  assert.match(world.runner.prompts.at(-1).text, /read .*tasks\/cards\.1\/answer-1\.md/)
})

test("Setting `spec` again at round 0 needs the Lead's reply, sends the Spec and the reply to the Reviewer for its next pass, and names a new report file", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'], ['set', 'menus', 'changes', '--as', 'reviewer'])
  const unanswered = await run(['set', 'menus', 'spec', '--as', 'lead'], world.deps)
  assert.equal(unanswered.code, 1)
  assert.match(unanswered.stderr, /no reply\.md in .*; answer each finding there, then set spec again/)
  world.reply('menus')
  await steps(world, ['set', 'menus', 'spec', '--as', 'lead'])
  assert.equal(world.runner.prompts.length, 2)
  assert.match(
    world.runner.prompts[1].text,
    /^Round 0, pass 2 of menus: .*tasks\/menus\/reply-2\.md answers each finding.*tasks\/menus\/review-0-2\.md/,
  )
  assert.equal(existsSync(join(world.home, 'tasks', 'menus', 'reply-2.md')), true)
  assert.equal(world.runner.starts.length, 1)
})

test('A change that the Lead sets does not wake the Lead', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'])
  // The Lead asks, and answers, a question of its own: `blocked` by the Lead.
  const folder = join(world.home, 'tasks', 'menus')
  writeFileSync(join(folder, 'question.md'), 'Is the spec right?\n')
  await steps(world, ['ask', 'menus', '--as', 'lead'])
  writeFileSync(join(folder, 'answer.md'), 'Yes.\n')
  await steps(world, ['answer', 'menus'], ['set', 'menus', 'changes', '--as', 'reviewer'])
  assert.equal((await run(['watch'], world.deps)).stdout, 'menus changes round 0 (reviewer)\n')
  const counts = JSON.parse(readFileSync(join(world.home, 'tasks', 'watch.json'), 'utf8'))
  assert.deepEqual(counts.menus, { log: 4, events: 0 })
})

test('A prompt that did not land fails the hand-off: the command exits 3, the change stays, and the watch tells the Lead', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  commit(world, PART, 'one')
  await steps(world, ['set', PART, 'building', '--as', 'implementer'])
  world.runner.failPrompt.add('reviewer')
  const ready = await run(['set', PART, 'ready', '--as', 'implementer'], world.deps)
  assert.equal(ready.code, 3)
  assert.equal(ready.stdout, 'task cards/1: ready round 1\n')
  assert.match(ready.stderr, /task cards\/1: the hand-off h2 to the reviewer failed: agent_prompt_stalled; run task resend cards\/1/)
  assert.equal((await run(['status', PART], world.deps)).stdout.split('\n')[0].startsWith('cards/1 ready round 1'), true)
  await run(['watch'], world.deps)
  assert.equal((await run(['watch'], world.deps)).stdout, 'cards/1 reviewer hand-off h2 failed: agent_prompt_stalled\n')
})

test('`task resend <task>` sends the hand-off of the last change again, and starts the agent first if it is not running', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  world.runner.failStart.add('implementer')
  assert.equal((await run(['build', PART], world.deps)).code, 3)
  world.runner.failStart.delete('implementer')

  const resent = await run(['resend', PART], world.deps)
  assert.equal(resent.code, 0, resent.stderr)
  assert.equal(resent.stdout, 'task cards/1: resend h1 to the implementer\n')
  assert.equal(world.runner.starts.at(-1).role, 'implementer')
  assert.match(world.runner.prompts.at(-1).text, /^You are the Implementer\./)
  assert.deepEqual(
    events(world, PART)
      .filter((event) => event.detail?.id === 'h1')
      .map((event) => event.event),
    ['handoff', 'handoff-failed', 'started', 'prompted'],
  )
  const nothing = await run(['resend', PART], world.deps)
  assert.equal(nothing.code, 1)
  assert.match(nothing.stderr, /task cards\/1 has no hand-off to resend/)
})

test('An agent that is started again continues its session', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  commit(world, PART, 'one')
  await steps(world, ['set', PART, 'building', '--as', 'implementer'])
  world.runner.states.reviewer = { state: 'gone' }
  await steps(world, ['set', PART, 'ready', '--as', 'implementer'])
  const restarted = world.runner.starts.at(-1)
  assert.equal(restarted.role, 'reviewer')
  assert.equal(restarted.resume, true)
})

test('A hand-off that no command sent, because the command stopped after the change, is reported by the watch', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'])
  // A command that stopped after it wrote its hand-off, before it tried it.
  appendFileSync(
    join(world.home, 'tasks', 'menus', 'events.ndjson'),
    `${JSON.stringify({ at: '2026-10-05T10:05:00.000Z', event: 'handoff', role: 'reviewer', detail: { id: 'h2', start: false, text: 'round 0' } })}\n`,
  )
  assert.equal((await run(['watch'], world.deps)).stdout, 'menus reviewer hand-off h2 was not sent; run task resend menus\n')
})

test('`task status` shows a folder that it cannot read as one line with the reason, and still shows each other task', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'])
  const old = join(world.home, 'tasks', 'askew')
  mkdirSync(old)
  writeFileSync(join(old, 'state'), 'ready\n')
  const all = await run(['status'], world.deps)
  assert.equal(all.code, 0)
  assert.equal(all.stdout.split('\n')[0], `askew unreadable: ${old}: no task folder`)
  assert.match(all.stdout, /^menus spec round 0/m)
  const one = await run(['status', 'askew'], world.deps)
  assert.equal(one.code, 1)
})

test('`task stop` closes each agent of the task, and its pane or its run', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--reviewer', 'herdr:pi:google/gemini-3-pro')
  commit(world, PART, 'one')
  await steps(world, ['set', PART, 'building', '--as', 'implementer'], ['set', PART, 'ready', '--as', 'implementer'])
  assert.equal((await run(['stop', PART, '--force'], world.deps)).code, 0)
  assert.deepEqual(world.runner.closed.toSorted(), ['implementer', 'reviewer'])
  assert.deepEqual(
    events(world, PART)
      .filter((event) => event.event === 'closed')
      .map((event) => event.role)
      .toSorted(),
    ['implementer', 'reviewer'],
  )
})

test('`task status` shows a task whose events or agents cannot be read as one line, and still shows each other task', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('cards')
  world.spec('menus')
  await steps(world, ['start', 'cards'], ['start', 'menus'])
  const folder = join(world.home, 'tasks', 'cards')
  const whole = readFileSync(join(folder, 'events.ndjson'), 'utf8')
  for (const [file, text, reason] of [
    ['events.ndjson', `${whole}not json\n`, /events\.ndjson: line 4 is not JSON/],
    ['agents.json', '{ broken', /agents\.json/],
  ]) {
    const kept = existsSync(join(folder, file)) ? readFileSync(join(folder, file), 'utf8') : undefined
    writeFileSync(join(folder, file), text)
    const all = await run(['status'], world.deps)
    assert.equal(all.code, 0, file)
    const [first, ...rest] = all.stdout.split('\n')
    assert.match(first, /^cards unreadable: /, file)
    assert.match(first, reason, file)
    assert.match(rest.join('\n'), /^menus spec round 0/m, file)
    if (kept !== undefined) writeFileSync(join(folder, file), kept)
  }
})

test("`task resend <task>` sends a hand-off again when its agent's run failed after it took the prompt, unless the agent is at work", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await building(world)
  commit(world, PART, 'one')
  await steps(world, ['set', PART, 'building', '--as', 'implementer'], ['set', PART, 'ready', '--as', 'implementer'])
  const sent = world.runner.prompts.at(-1)
  assert.equal(sent.role, 'reviewer')
  const none = await run(['resend', PART], world.deps)
  assert.equal(none.code, 1)
  assert.match(none.stderr, /task cards\/1 has no hand-off to resend/)

  // The Part's Reviewer is the Spec's agent, so its supervisor writes the run's end in the Spec's folder.
  world.tick()
  const failed = { at: world.deps.now().toISOString(), event: 'run-failed', role: 'reviewer', detail: { prompt: 'p.txt', error: 'ended' } }
  appendFileSync(join(world.home, 'tasks', SPEC, 'events.ndjson'), `${JSON.stringify(failed)}\n`)
  world.tick()
  world.runner.states.reviewer = { state: 'working' }
  const busy = await run(['resend', PART], world.deps)
  assert.equal(busy.code, 1)
  assert.match(busy.stderr, /task cards\/1: the reviewer is at work; resend when its run ends/)

  delete world.runner.states.reviewer
  const resent = await run(['resend', PART], world.deps)
  assert.equal(resent.code, 0, resent.stderr)
  assert.match(resent.stdout, /^task cards\/1: resend h\d+ to the reviewer\n$/)
  assert.equal(world.runner.prompts.at(-1).text, sent.text)
  const again = await run(['resend', PART], world.deps)
  assert.equal(again.code, 1)
  assert.match(again.stderr, /has no hand-off to resend/)

  // The Spec's Round 0 is done: a failed run of its Reviewer on the Part does not send Round 0 again.
  const spec = await run(['resend', SPEC], world.deps)
  assert.equal(spec.code, 1)
  assert.match(spec.stderr, /task cards has no hand-off to resend/)
})

test('`task resend <task>` does not send a hand-off again when the failed run left another Task waiting', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec(SPEC)
  await steps(world, ['start', SPEC])
  world.tick()
  const failed = {
    at: world.deps.now().toISOString(),
    event: 'run-failed',
    role: 'reviewer',
    detail: { prompt: 'p.txt', task: 'menus', error: 'ended' },
  }
  appendFileSync(join(world.home, 'tasks', SPEC, 'events.ndjson'), `${JSON.stringify(failed)}\n`)
  const other = await run(['resend', SPEC], world.deps)
  assert.equal(other.code, 1)
  assert.match(other.stderr, /task cards has no hand-off to resend/)
})
