import { onTestFinished, test } from 'vite-plus/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { built, logLines, makeWorld } from './world.mjs'
import { run } from './task.mjs'

async function started(world, n) {
  world.spec(n)
  return run(['start', n], world.deps)
}

function stateOf(world, n) {
  const last = logLines(world, n).at(-1)
  return { state: last.to, round: last.round }
}

test('The Reviewer sets `approved` or `changes` after round 0', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'menus')).code, 0)
  world.tick()

  const approved = await run(['set', 'menus', 'approved', '--as', 'reviewer'], world.deps)
  assert.equal(approved.code, 0)
  assert.equal(approved.stdout, 'task menus: approved round 0\n')
  assert.deepEqual(stateOf(world, 'menus'), { state: 'approved', round: 0 })
  assert.deepEqual(logLines(world, 'menus').at(-1), {
    at: '2026-10-05T10:01:00.000Z',
    role: 'reviewer',
    from: 'spec',
    to: 'approved',
    round: 0,
  })

  assert.equal((await started(world, 'tables')).code, 0)
  const changed = await run(['set', 'tables', 'changes', '--as', 'reviewer'], world.deps)
  assert.equal(changed.code, 0)
  assert.deepEqual(stateOf(world, 'tables'), { state: 'changes', round: 0 })
})

test("The Implementer sets `building` on a Part, which begins at its Spec's approval, and `ready` when the tip is ready for a round", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1)

  const building = await run(['set', 'cards/1', 'building', '--as', 'implementer'], world.deps)
  assert.equal(building.code, 0)
  assert.equal(building.stdout, 'task cards/1: building round 0\n')
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'building', round: 0 })

  const ready = await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)
  assert.equal(ready.code, 0)
  assert.equal(ready.stdout, 'task cards/1: ready round 1\n')
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'ready', round: 1 })
})

test('Each `ready` starts the next round. The round number goes up by one', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1)
  await run(['set', 'cards/1', 'building', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)

  // A later round: the Reviewer finds changes, and the Implementer answers with a new tip.
  await run(['set', 'cards/1', 'changes', '--as', 'reviewer'], world.deps)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'changes', round: 1 })
  await run(['set', 'cards/1', 'building', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'ready', round: 2 })

  // `ready` can also follow `changes` after round 0, and still starts the next round.
  await run(['set', 'cards/1', 'changes', '--as', 'reviewer'], world.deps)
  await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'ready', round: 3 })
})

test('A role that sets a state it does not own is refused, and the state does not change', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1)

  const byLead = await run(['set', 'cards/1', 'building'], world.deps)
  assert.equal(byLead.code, 1)
  assert.match(byLead.stderr, /the lead cannot set building; the implementer sets it/)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'approved', round: 0 })

  const byReviewer = await run(['set', 'cards/1', 'ready', '--as', 'reviewer'], world.deps)
  assert.equal(byReviewer.code, 1)
  assert.match(byReviewer.stderr, /the reviewer cannot set ready; the implementer sets it/)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'approved', round: 0 })

  const specByReviewer = await run(['set', 'cards/1', 'spec', '--as', 'reviewer'], world.deps)
  assert.equal(specByReviewer.code, 1)
  assert.match(specByReviewer.stderr, /the reviewer cannot set spec; the lead sets it/)
})

test('A state that cannot follow the current state is refused, and the error names the states that can follow', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'menus')).code, 0)

  // At round 0, from spec, only the Reviewer's verdict follows.
  const fromSpec = await run(['set', 'menus', 'ready', '--as', 'implementer'], world.deps)
  assert.equal(fromSpec.code, 1)
  assert.match(fromSpec.stderr, /ready cannot follow spec; changes, approved can follow it/)
  assert.deepEqual(stateOf(world, 'menus'), { state: 'spec', round: 0 })

  // The Implementer cannot start before round 0 is approved.
  await run(['set', 'menus', 'changes', '--as', 'reviewer'], world.deps)
  const fromChanges = await run(['set', 'menus', 'building', '--as', 'implementer'], world.deps)
  assert.equal(fromChanges.code, 1)
  assert.match(fromChanges.stderr, /building cannot follow changes; spec can follow it/)

  // A Ticket has no Round 0 of its own, so `spec` never follows on it.
  await built(world, 2)
  await run(['set', 'cards/2', 'building', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/2', 'ready', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/2', 'changes', '--as', 'reviewer'], world.deps)
  const specOnTicket = await run(['set', 'cards/2', 'spec'], world.deps)
  assert.equal(specOnTicket.code, 1)
  assert.match(specOnTicket.stderr, /spec cannot follow changes; building, ready can follow it/)

  // After a later round's approval, only the Lead's `changes` from its try follows: the Lead takes the message and the PR.
  await run(['set', 'cards/2', 'ready', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/2', 'approved', '--as', 'reviewer'], world.deps)
  const fromApproved = await run(['set', 'cards/2', 'building', '--as', 'implementer'], world.deps)
  assert.equal(fromApproved.code, 1)
  assert.match(fromApproved.stderr, /building cannot follow approved; changes can follow it/)

  // `task set` cannot set what only `task ask` and `task stop` set.
  const blocked = await run(['set', 'menus', 'blocked', '--as', 'implementer'], world.deps)
  assert.equal(blocked.code, 1)
  assert.match(blocked.stderr, /task set cannot set blocked; only task ask sets it/)
})

test("The Lead sets `changes` on a Part after a later round's approval, with the report of its try, and the round stays until the fix is ready for the next round", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1)
  await run(['set', 'cards/1', 'building', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)
  await run(['set', 'cards/1', 'approved', '--as', 'reviewer'], world.deps)

  const byReviewer = await run(['set', 'cards/1', 'changes', '--as', 'reviewer'], world.deps)
  assert.equal(byReviewer.code, 1)
  assert.match(byReviewer.stderr, /the reviewer cannot set changes after approved; the lead sets it/)

  const noTry = await run(['set', 'cards/1', 'changes'], world.deps)
  assert.equal(noTry.code, 1)
  assert.match(noTry.stderr, /task cards\/1: no try-1\.md in .*; write what the try found there, then set changes again/)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'approved', round: 1 })

  writeFileSync(join(world.home, 'tasks', 'cards.1', 'try-1.md'), 'The float leaves the fill on the edge.')
  const tried = await run(['set', 'cards/1', 'changes'], world.deps)
  assert.equal(tried.code, 0)
  assert.equal(tried.stdout.split('\n')[0], 'task cards/1: changes round 1')
  assert.deepEqual(logLines(world, 'cards/1').at(-1).role, 'lead')

  await run(['set', 'cards/1', 'ready', '--as', 'implementer'], world.deps)
  assert.deepEqual(stateOf(world, 'cards/1'), { state: 'ready', round: 2 })
})

test('The Lead sets `spec` again after an edit of the Spec at round 0', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'tables')).code, 0)
  await run(['set', 'tables', 'changes', '--as', 'reviewer'], world.deps)
  world.reply('tables')

  const again = await run(['set', 'tables', 'spec'], world.deps)
  assert.equal(again.code, 0)
  assert.deepEqual(logLines(world, 'tables').at(-1), {
    at: '2026-10-05T10:00:00.000Z',
    role: 'lead',
    from: 'changes',
    to: 'spec',
    round: 0,
  })
})

test("The Lead's `spec` is refused while the Lead has no reply to the last pass, and the state does not change", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  assert.equal((await started(world, 'tables')).code, 0)
  world.tick()
  await run(['set', 'tables', 'changes', '--as', 'reviewer'], world.deps)

  const bare = await run(['set', 'tables', 'spec'], world.deps)
  assert.equal(bare.code, 1)
  assert.match(bare.stderr, /task tables: no reply\.md in .*tables; answer each finding there, then set spec again/)
  assert.deepEqual(stateOf(world, 'tables'), { state: 'changes', round: 0 })
})
