import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { appendFileSync, chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { built, git, makeWorld, SPEC, steps } from './world.mjs'
import { run } from './task.mjs'

const MESSAGE = 'feat: the thing works\n\nWhat changed, and why.\n\nAuthor API: none.\n\nCloses #140\n'
const PR =
  '## Summary\n\nA card fills its line.\n\n## Evidence\n\n- **Before:** bare\n  **After:** filled\n\n## Merge danger\n\n**Blast radius:** tool cards\n'

async function approved(world, partDoor) {
  if (partDoor !== undefined) {
    world.spec(SPEC, { partDoors: { 1: partDoor } })
    await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  }
  await built(world, 1, '--by', 'lead')
  const worktree = join(world.home, 'worktrees', 'cards-1')
  for (const line of ['one', 'two']) {
    appendFileSync(join(worktree, 'README.md'), `${line}\n`)
    git(worktree, ['commit', '-am', line])
  }
  await steps(
    world,
    ['set', 'cards/1', 'building', '--as', 'implementer'],
    ['set', 'cards/1', 'ready', '--as', 'implementer'],
    ['set', 'cards/1', 'approved', '--as', 'reviewer'],
  )
  const folder = join(world.home, 'tasks', 'cards.1')
  writeFileSync(join(folder, 'message.md'), MESSAGE)
  writeFileSync(join(folder, 'pr.md'), PR)
  writeFileSync(join(folder, 'checked.md'), '# The proof of each test\n\n## one\n\n- **Break:** x\n')
  writeFileSync(join(folder, 'review-1.md'), 'Round 1: approved.')
  return { worktree, folder }
}

function originSubjects(world) {
  git(world.repo, ['fetch', 'origin'])
  return git(world.repo, ['log', '--format=%s', 'origin/main..origin/task/cards-1']).split('\n')
}

test('`task land` opens the PR with no `checked.md`, and leaves out what the builder checked', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { folder } = await approved(world)
  rmSync(join(folder, 'checked.md'))
  const landed = await run(['land', 'cards/1'], world.deps)
  assert.equal(landed.code, 0, landed.stderr)
  assert.doesNotMatch(world.gh.prs.get('task/cards-1').body, /What the builder checked/)
})

test('`task land <slug>/<k>` squashes the branch into one commit on top of `origin/main`, with `message.md` as its message and who built and who reviewed as its trailers, and pushes it', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { worktree } = await approved(world)
  const landed = await run(['land', 'cards/1'], world.deps)
  assert.equal(landed.code, 0, landed.stderr)
  assert.deepEqual(originSubjects(world), ['feat: the thing works'])
  assert.equal(
    git(worktree, ['log', '-1', '--format=%B']),
    `${MESSAGE.trim()}\n\nBuilt-by: the Lead, claude:claude-opus-5-5\nReviewed-by: herdr:pi:openai-codex/gpt-6.1-sol@medium`,
  )
  assert.equal(git(worktree, ['rev-parse', 'HEAD~1']), git(world.repo, ['rev-parse', 'origin/main']))
})

test("`task land` opens the PR: its title is the message's header, its body says where the Part fits, holds `pr.md` with the Door in its Merge danger, then Checked with the review, the Part and `checked.md`, and each report goes to a comment of its own", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world)
  const landed = await run(['land', 'cards/1'], world.deps)
  assert.equal(landed.stdout, 'task cards/1: landed https://github.com/o/r/pull/1\n')
  const pr = world.gh.prs.get('task/cards-1')
  assert.equal(pr.title, 'feat: the thing works')
  assert.match(
    pr.body,
    /^Part 1 of 3 of the Spec \*the cards\*, `intents\/cards\/spec\.md`\.\n\n## Summary\n\nA card fills its line\.\n\n## Evidence\n[^]*\n## Merge danger\n\n\*\*Door:\*\* two-way\.\n\n\*\*Blast radius:\*\* tool cards\n\n## Checked\n\n\*\*Review:\*\* 1 report, each in a comment below, oldest first\.\n\n<details><summary>The Part<\/summary>\n\n\*\*Slice 1\.\*\* Behaviour 1\./,
  )
  assert.match(pr.body, /\nAuthor API: none\.\n\nCloses #140\n$/)
  assert.doesNotMatch(pr.body, /Built-by/)
  assert.match(pr.body, /<details><summary>What the builder checked<\/summary>\n\n# The proof of each test/)
  assert.match(pr.body, /\n- \[x\] `vp run ready` passes/)
  assert.deepEqual(pr.labels, [])
  assert.deepEqual(
    world.gh.comments.map((comment) => comment.body.split('\n')[0]),
    ['<!-- binnacle-report: review-1.md -->'],
  )
  assert.match(world.gh.comments[0].body, /<details><summary>review-1\.md<\/summary>\n\nRound 1: approved\./)
})

test('A Part built and reviewed by one family says so, in its trailer and its PR', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  writeFileSync(join(world.home, 'roles.json'), JSON.stringify({ default: 'subagent:sonnet', lead: 'claude:opus' }))
  const { worktree } = await approved(world)
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 0)
  assert.match(git(worktree, ['log', '-1', '--format=%B']), /\nReviewed-by: subagent:sonnet, the builder's family$/)
  assert.match(world.gh.prs.get('task/cards-1').body, /The reviewer is of the builder's family: read the diff with more care\./)
})

test('A Part whose Door is one-way gives its PR the label `one-way`', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world, 'One-way: it moves a pin.')
  const landed = await run(['land', 'cards/1'], world.deps)
  assert.equal(landed.stdout, 'task cards/1: landed https://github.com/o/r/pull/1 (one-way)\n')
  assert.deepEqual(world.gh.prs.get('task/cards-1').labels, ['one-way'])
})

test('`task land` refuses before a round after round 0 is approved, and when an input is missing or wrong, and changes nothing', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 2, '--by', 'lead')
  const spec = await run(['land', SPEC], world.deps)
  assert.equal(spec.code, 2)
  assert.match(spec.stderr, /cards: a Part's Task is <slug>\/<k>/)
  const early = await run(['land', 'cards/2'], world.deps)
  assert.equal(early.code, 1)
  assert.match(early.stderr, /task cards\/2 is approved at round 0; task land follows approved after round 0/)

  const { worktree, folder } = await approved(world)
  const head = git(worktree, ['rev-parse', 'HEAD'])
  const refuses = async (reason) => {
    const result = await run(['land', 'cards/1'], world.deps)
    assert.equal(result.code, 1, `${reason}: ${result.stdout}`)
    assert.match(result.stderr, reason)
    assert.equal(git(worktree, ['rev-parse', 'HEAD']), head)
    assert.deepEqual(world.gh.calls, [])
  }
  rmSync(join(folder, 'message.md'))
  await refuses(/no message\.md/)
  writeFileSync(join(folder, 'message.md'), '\nno header\n')
  await refuses(/its first line, the header, is empty/)
  writeFileSync(join(folder, 'message.md'), MESSAGE)
  rmSync(join(folder, 'pr.md'))
  await refuses(/no pr\.md in .*; write it with the `pr` skill/)
  writeFileSync(join(folder, 'pr.md'), '## Summary\n\nA card.\n')
  await refuses(/pr\.md: it has no ## Evidence, ## Merge danger/)
  writeFileSync(join(folder, 'pr.md'), PR)
  rmSync(join(folder, 'review-1.md'))
  await refuses(/no review report of a round after round 0/)
  writeFileSync(join(folder, 'review-1.md'), 'Round 1.')
  world.spec(SPEC, { door: 'Later.' })
  await refuses(/the Part 1 of cards names no Door, and its Spec's ## Door does not start with One-way or Two-way/)
  world.spec(SPEC, { parts: 0 })
  await refuses(/the Spec cards on origin\/main has no Part 1/)
  world.spec(SPEC)
  appendFileSync(join(worktree, 'README.md'), 'not committed\n')
  await refuses(/has changes that are not committed/)
  git(worktree, ['checkout', 'README.md'])
  // origin/main moves on, and the branch does not hold it.
  appendFileSync(join(world.repo, 'README.md'), 'main moves\n')
  git(world.repo, ['commit', '-am', 'main moves'])
  git(world.repo, ['push', 'origin', 'main'])
  await refuses(/task\/cards-1 does not hold origin\/main/)
})

test('A `task land` that failed part of the way can run again: it finishes, and makes no second commit, PR or comment', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { worktree } = await approved(world)
  // GitHub takes the second comment, but its answer is lost.
  world.gh.failures.push({ match: (args) => args[1] === 'comment' && world.gh.comments.length === 0, lost: true })
  const first = await run(['land', 'cards/1'], world.deps)
  assert.equal(first.code, 1)
  assert.match(
    first.stderr,
    /task cards\/1: land stopped at the reports: error connecting to api\.github\.com; run task land cards\/1 again/,
  )
  const squashed = git(worktree, ['rev-parse', 'HEAD'])

  const again = await run(['land', 'cards/1'], world.deps)
  assert.equal(again.code, 0, again.stderr)
  assert.equal(git(worktree, ['rev-parse', 'HEAD']), squashed)
  assert.equal(world.gh.prs.size, 1)
  assert.equal(world.gh.calls.filter((call) => call.startsWith('pr create')).length, 1)
  assert.deepEqual(
    world.gh.comments.map((comment) => comment.body.split('\n')[0]),
    ['<!-- binnacle-report: review-1.md -->'],
  )
})

test('A squash whose commit fails puts the branch back as it was, so the next `task land` can run', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { worktree } = await approved(world)
  const head = git(worktree, ['rev-parse', 'HEAD'])
  const hooks = join(world.dir, 'hooks')
  mkdirSync(hooks)
  writeFileSync(join(hooks, 'commit-msg'), '#!/bin/sh\necho "the header is not conventional" >&2\nexit 1\n')
  chmodSync(join(hooks, 'commit-msg'), 0o755)
  git(world.repo, ['config', 'core.hooksPath', hooks])
  const failed = await run(['land', 'cards/1'], world.deps)
  assert.equal(failed.code, 1)
  assert.match(failed.stderr, /land stopped at the squash: the header is not conventional/)
  assert.equal(git(worktree, ['rev-parse', 'HEAD']), head)
  assert.equal(git(worktree, ['status', '--porcelain']), '')

  git(world.repo, ['config', '--unset', 'core.hooksPath'])
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 0)
})

test("`task land` writes `landed` with the PR's address to the events log. A `task land` after it refuses, and names the PR", async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { folder } = await approved(world)
  await run(['land', 'cards/1'], world.deps)
  const events = readFileSync(join(folder, 'events.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.deepEqual(events.at(-1).detail, { url: 'https://github.com/o/r/pull/1' })
  assert.equal(events.at(-1).event, 'landed')
  const second = await run(['land', 'cards/1'], world.deps)
  assert.equal(second.code, 1)
  assert.match(second.stderr, /task cards\/1 has landed already: https:\/\/github\.com\/o\/r\/pull\/1/)
})

test('A resumed `task land` knows its squash by the message as Git keeps it, so a message that Git cleans makes no second commit', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { worktree, folder } = await approved(world)
  // Git keeps one blank line where the file has two, and drops trailing space.
  writeFileSync(join(folder, 'message.md'), 'feat: the thing works\n\n\nWhat changed.   \n\n\nCloses #140\n')
  world.gh.failures.push({ match: (args) => args[1] === 'comment', lost: false })
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 1)
  const squashed = git(worktree, ['rev-parse', 'HEAD'])
  // A second squash in the same second would make the same commit: wait past it.
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 0)
  assert.equal(git(worktree, ['rev-parse', 'HEAD']), squashed)
})

test('A resumed `task land` makes no second commit when Git is set to keep a message verbatim', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  const { worktree, folder } = await approved(world)
  git(world.repo, ['config', 'commit.cleanup', 'verbatim'])
  writeFileSync(join(folder, 'message.md'), 'feat: the thing works\n\n\nWhat changed.\n\n\nCloses #140\n')
  world.gh.failures.push({ match: (args) => args[1] === 'comment', lost: false })
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 1)
  const squashed = git(worktree, ['rev-parse', 'HEAD'])
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert.equal((await run(['land', 'cards/1'], world.deps)).code, 0)
  assert.equal(git(worktree, ['rev-parse', 'HEAD']), squashed)
})

test('`task stop <slug>` says to mark the Spec built once each of its Parts landed, and names their PRs', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await approved(world)
  await steps(world, ['land', 'cards/1'], ['stop', 'cards/1', '--force'])

  const stopped = await run(['stop', SPEC], world.deps)

  assert.equal(
    stopped.stdout,
    "task cards: each Part landed (https://github.com/o/r/pull/1); set the Spec's Status to built\ntask cards: stopped round 0\n",
  )
})

test('`task stop <slug>` says the Spec is not built when a Part of it did not land', async () => {
  const world = makeWorld()
  onTestFinished(() => world.remove())
  await built(world, 1, '--by', 'lead')
  await steps(world, ['stop', 'cards/1', '--force'])

  const stopped = await run(['stop', SPEC], world.deps)

  assert.equal(stopped.stdout, 'task cards: a Part of it did not land, so the Spec is not built\ntask cards: stopped round 0\n')
})
