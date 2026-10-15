import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, logLines, makeWorld } from './world.mjs'
import { run } from './task.mjs'

async function merged(world, id) {
  // A Reviewer of the Part's own has a checkout of its own to remove.
  await built(world, Number(id.split('/')[1]), '--by', 'lead', '--reviewer', 'herdr:pi:google/gemini-3-pro')
  const worktree = join(world.home, 'worktrees', id.replace('/', '-'))
  appendFileSync(join(worktree, 'README.md'), 'more\n')
  git(worktree, ['add', 'README.md'])
  git(worktree, ['commit', '-m', 'work'])
  git(worktree, ['push', 'origin', `task/${id.replace('/', '-')}:main`])
}

function reviewOf(world, id) {
  return join(world.home, 'worktrees', `${id.replace('/', '-')}-review`)
}

test('`task stop <n>` removes the worktrees and the branch, sets `stopped`, and keeps the task folder as the record', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await merged(world, 'cards/1')
  const review = reviewOf(world, 'cards/1')
  const worktree = join(world.home, 'worktrees', 'cards-1')

  const stopped = await run(['stop', 'cards/1'], world.deps)

  assert.equal(stopped.code, 0)
  assert.equal(stopped.stdout, 'task cards/1: stopped round 0\n')
  assert.equal(existsSync(worktree), false)
  assert.equal(existsSync(review), false)
  assert.equal(git(world.repo, ['worktree', 'list']).includes('cards/1'), false)
  assert.equal(git(world.repo, ['branch', '--list', 'task/cards-1']), '')
  assert.deepEqual(logLines(world, 'cards/1').at(-1), {
    at: '2026-10-05T10:03:00.000Z',
    role: 'lead',
    from: 'approved',
    to: 'stopped',
    round: 0,
  })
  assert.equal(existsSync(join(world.home, 'tasks', 'cards.1', 'task.json')), true)

  // A second stop of a stopped task changes nothing and exits 0.
  const again = await run(['stop', 'cards/1'], world.deps)
  assert.equal(again.code, 0)
  assert.equal(logLines(world, 'cards/1').length, 2)
})

test('`task stop` refuses a worktree with changes that are not committed, and a branch that is not merged into `origin/main`, unless it gets `--force`', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await merged(world, 'cards/1')
  const worktree = join(world.home, 'worktrees', 'cards-1')
  appendFileSync(join(worktree, 'README.md'), 'not committed\n')

  const dirty = await run(['stop', 'cards/1'], world.deps)
  assert.equal(dirty.code, 1)
  assert.match(dirty.stderr, /cannot remove the worktree .*cards-1.*--force/)
  assert.equal(logLines(world, 'cards/1').at(-1).to, 'approved')
  assert.equal(existsSync(worktree), true)
  assert.match(git(world.repo, ['branch', '--list', 'task/cards-1']), /task\/cards-1$/)

  const forced = await run(['stop', 'cards/1', '--force'], world.deps)
  assert.equal(forced.code, 0)
  assert.equal(logLines(world, 'cards/1').at(-1).to, 'stopped')

  // A clean worktree goes, but a branch that is not merged into origin/main stays.
  await merged(world, 'cards/2')
  const clean = join(world.home, 'worktrees', 'cards-2')
  git(clean, ['commit', '--allow-empty', '-m', 'not merged'])
  const unmerged = await run(['stop', 'cards/2'], world.deps)
  assert.equal(unmerged.code, 1)
  assert.match(unmerged.stderr, /the branch task\/cards-2 is not merged into origin\/main/)
  assert.equal(logLines(world, 'cards/2').at(-1).to, 'approved')
  assert.equal(existsSync(clean), false)
  assert.match(git(world.repo, ['branch', '--list', 'task/cards-2']), /task\/cards-2$/)

  const forcedUnmerged = await run(['stop', 'cards/2', '--force'], world.deps)
  assert.equal(forcedUnmerged.code, 0)
  assert.equal(logLines(world, 'cards/2').at(-1).to, 'stopped')
  assert.equal(git(world.repo, ['branch', '--list', 'task/cards-2']), '')
})

test("`task stop` is the Lead's command: another role that passes `--as` is refused, and the state does not change", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await merged(world, 'cards/1')
  const worktree = join(world.home, 'worktrees', 'cards-1')

  for (const role of ['implementer', 'reviewer']) {
    const refused = await run(['stop', 'cards/1', '--as', role], world.deps)
    assert.equal(refused.code, 1)
    assert.match(refused.stderr, new RegExp(`the ${role} cannot stop a task; the lead stops it`))
    assert.equal(logLines(world, 'cards/1').at(-1).to, 'approved')
    assert.equal(existsSync(worktree), true)
  }

  const byLead = await run(['stop', 'cards/1', '--as', 'lead'], world.deps)
  assert.equal(byLead.code, 0)
  assert.equal(logLines(world, 'cards/1').at(-1).to, 'stopped')
})

test("`task stop <spec>` removes the Spec's review checkout, and sets `stopped`", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('boxes')
  assert.equal((await run(['start', 'boxes'], world.deps)).code, 0)
  const stopped = await run(['stop', 'boxes'], world.deps)
  assert.equal(stopped.code, 0, stopped.stderr)
  assert.equal(existsSync(reviewOf(world, 'boxes')), false)
  assert.equal(logLines(world, 'boxes').at(-1).to, 'stopped')
})

test('A `task stop` that failed part of the way can run again, and it finishes the stop', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await merged(world, 'cards/1')
  const review = reviewOf(world, 'cards/1')
  appendFileSync(join(review, 'README.md'), 'the Reviewer left a note\n')

  const failed = await run(['stop', 'cards/1'], world.deps)
  assert.equal(failed.code, 1)
  assert.match(failed.stderr, /cannot remove the worktree .*cards-1-review/)
  assert.equal(logLines(world, 'cards/1').at(-1).to, 'approved')
  assert.equal(existsSync(join(world.home, 'worktrees', 'cards-1')), false)
  assert.equal(existsSync(review), true)

  // The Reviewer's checkout is clean again, so the second run finishes the stop.
  git(review, ['restore', 'README.md'])
  const finished = await run(['stop', 'cards/1'], world.deps)
  assert.equal(finished.code, 0)
  assert.equal(logLines(world, 'cards/1').at(-1).to, 'stopped')
  assert.equal(existsSync(review), false)
  assert.equal(git(world.repo, ['worktree', 'list']).includes('cards/1'), false)
})
