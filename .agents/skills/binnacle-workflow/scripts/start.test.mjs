import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { git, logLines, makeWorld, steps } from './world.mjs'
import { run } from './task.mjs'

test("`task start <slug>` makes the Reviewer's checkout `~/.binnacle/worktrees/<slug>-review` at `origin/main`, and a Spec's folder with the state `spec` at round 0. A Spec has no branch", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')

  const result = await run(['start', 'menus'], world.deps)

  assert.equal(result.code, 0, result.stderr)
  const review = join(world.home, 'worktrees', 'menus-review')
  assert.equal(git(review, ['rev-parse', 'HEAD']), git(world.repo, ['rev-parse', 'origin/main']))
  assert.equal(existsSync(join(world.home, 'worktrees', 'menus')), false)
  assert.equal(git(world.repo, ['branch', '--list', 'task/menus']), '')
  assert.deepEqual(JSON.parse(readFileSync(join(world.home, 'tasks', 'menus', 'task.json'), 'utf8')), {
    id: 'menus',
    kind: 'spec',
    slug: 'menus',
    createdAt: '2026-10-05T10:00:00.000Z',
  })
  assert.deepEqual(logLines(world, 'menus'), [{ at: '2026-10-05T10:00:00.000Z', role: 'lead', from: null, to: 'spec', round: 0 }])
})

test('`task start` refuses a slug with no Spec in the checkout, and a Part', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const missing = await run(['start', 'menus'], world.deps)
  assert.equal(missing.code, 1)
  assert.match(missing.stderr, /no Spec intents\/menus\/spec\.md; write it first/)
  const part = await run(['start', 'menus/1'], world.deps)
  assert.equal(part.code, 2)
  assert.match(part.stderr, /menus\/1: a Spec's Task is its slug alone/)
})

test("`task start` takes a Spec that is not merged yet: Round 0 reads it in the Lead's checkout", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus', { merged: false })
  assert.equal((await run(['start', 'menus'], world.deps)).code, 0)
  assert.equal(world.runner.prompts.length, 1)
  assert.match(world.runner.prompts[0].text, new RegExp(`${world.repo}/intents/menus/spec\\.md`))
})

test("A Spec's approval at round 0 is followed only by another pass, `spec`", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'], ['set', 'menus', 'approved', '--as', 'reviewer'])
  const building = await run(['set', 'menus', 'building', '--as', 'implementer'], world.deps)
  assert.equal(building.code, 1)
  assert.match(building.stderr, /task menus: building cannot follow approved; spec can follow it/)
})

test('`task start` refuses a slug whose task folder or review checkout exists, and changes nothing', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  world.spec('cards')
  assert.equal((await run(['start', 'menus'], world.deps)).code, 0)
  const before = readFileSync(join(world.home, 'tasks', 'menus', 'log.ndjson'), 'utf8')

  const again = await run(['start', 'menus'], world.deps)
  assert.equal(again.code, 1)
  assert.match(again.stderr, /task menus: the task folder .*exists already/)
  assert.equal(readFileSync(join(world.home, 'tasks', 'menus', 'log.ndjson'), 'utf8'), before)

  mkdirSync(join(world.home, 'worktrees', 'cards-review'))
  const atReview = await run(['start', 'cards'], world.deps)
  assert.equal(atReview.code, 1)
  assert.match(atReview.stderr, /task cards: the worktree .*cards-review exists already/)
  assert.equal(existsSync(join(world.home, 'tasks', 'cards')), false)
})

test('`task build <slug>/<k>` refuses a Spec that was not started, a Spec whose round 0 is not approved, and a Part that main does not hold', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const bare = await run(['build', 'menus'], world.deps)
  assert.equal(bare.code, 2)
  assert.match(bare.stderr, /menus: a Part's Task is <slug>\/<k>/)

  world.spec('menus', { merged: false, parts: 2 })
  const unstarted = await run(['build', 'menus/1'], world.deps)
  assert.equal(unstarted.code, 1)
  assert.match(unstarted.stderr, /the Spec menus has no task folder; run task start menus first/)

  await steps(world, ['start', 'menus'])
  const early = await run(['build', 'menus/1'], world.deps)
  assert.equal(early.code, 1)
  assert.match(early.stderr, /the Spec menus is spec at round 0; task build follows its approved at round 0/)

  await steps(world, ['set', 'menus', 'approved', '--as', 'reviewer'])
  const unmerged = await run(['build', 'menus/1'], world.deps)
  assert.equal(unmerged.code, 1)
  assert.match(unmerged.stderr, /origin\/main has no intents\/menus\/spec\.md; merge the Spec first/)

  world.spec('menus', { parts: 2 })
  const past = await run(['build', 'menus/3'], world.deps)
  assert.equal(past.code, 1)
  assert.match(past.stderr, /the Spec menus on origin\/main has no Part 3 under its Parts of the build/)
  assert.equal(existsSync(join(world.home, 'tasks', 'menus.3')), false)
  assert.equal(existsSync(join(world.home, 'worktrees', 'menus-3')), false)
})

test("`task build <slug>/<k>` makes the worktree on a new branch `task/<slug>-<k>` from `origin/main`, and a Part's folder that begins at its Spec's approval. The Spec's Reviewer reviews it in the Spec's checkout", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'], ['set', 'menus', 'approved', '--as', 'reviewer'])

  const result = await run(['build', 'menus/1'], world.deps)

  assert.equal(result.code, 0, result.stderr)
  const base = git(world.repo, ['rev-parse', 'origin/main'])
  assert.equal(result.stdout, `task menus/1: Part 1 of menus, built from ${base.slice(0, 7)}\n`)
  const worktree = join(world.home, 'worktrees', 'menus-1')
  assert.equal(git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']), 'task/menus-1')
  assert.equal(git(worktree, ['rev-parse', 'HEAD']), base)
  assert.equal(existsSync(join(world.home, 'worktrees', 'menus-1-review')), false)
  assert.equal(existsSync(join(world.home, 'worktrees', 'menus-review')), true)
  assert.deepEqual(JSON.parse(readFileSync(join(world.home, 'tasks', 'menus.1', 'task.json'), 'utf8')), {
    id: 'menus/1',
    kind: 'part',
    slug: 'menus',
    part: 1,
    branch: 'task/menus-1',
    worktree,
    sameFamily: false,
    createdAt: '2026-10-05T10:02:00.000Z',
  })
  assert.deepEqual(logLines(world, 'menus/1'), [{ at: '2026-10-05T10:02:00.000Z', role: 'lead', from: null, to: 'approved', round: 0 }])
})

test('`task build` refuses a Part whose task folder, worktree or branch exists, and changes nothing', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  world.spec('menus')
  await steps(world, ['start', 'menus'], ['set', 'menus', 'approved', '--as', 'reviewer'], ['build', 'menus/1'])

  const again = await run(['build', 'menus/1'], world.deps)
  assert.equal(again.code, 1)
  assert.match(again.stderr, /task menus\/1: the task folder .*exists already/)

  mkdirSync(join(world.home, 'worktrees', 'menus-2'))
  const atWorktree = await run(['build', 'menus/2'], world.deps)
  assert.equal(atWorktree.code, 1)
  assert.match(atWorktree.stderr, /task menus\/2: the worktree .*exists already/)
  assert.equal(existsSync(join(world.home, 'tasks', 'menus.2')), false)

  git(world.repo, ['branch', 'task/menus-3'])
  const atBranch = await run(['build', 'menus/3'], world.deps)
  assert.equal(atBranch.code, 1)
  assert.match(atBranch.stderr, /task menus\/3: the branch task\/menus-3 exists already/)
  assert.equal(existsSync(join(world.home, 'tasks', 'menus.3')), false)
  assert.equal(existsSync(join(world.home, 'worktrees', 'menus-3')), false)
})
