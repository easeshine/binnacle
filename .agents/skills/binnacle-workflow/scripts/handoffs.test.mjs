import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { handoffFor, reportFile } from './handoffs.mjs'

const task = {
  id: 'cards/1',
  slug: 'cards',
  part: 1,
  branch: 'task/cards-1',
  repo: '/r',
  folder: '/h/tasks/cards.1',
  worktree: '/h/worktrees/cards-1',
  review: '/h/worktrees/cards-review',
  round: 0,
  pass: 1,
}

test('the report file names each pass of round 0 and each later round', () => {
  assert.deepEqual(
    [reportFile(0, 1), reportFile(0, 2), reportFile(0, 3), reportFile(1, 1), reportFile(2, 4)],
    ['review-0.md', 'review-0-2.md', 'review-0-3.md', 'review-1.md', 'review-2.md'],
  )
})

test('`ready` sends the Reviewer the round, the tip, the commits since the last round and the report file', () => {
  const handoff = handoffFor({ kind: 'set', to: 'ready' }, { ...task, round: 2, tip: 'b2', base: 'a1' })
  assert.equal(handoff.role, 'reviewer')
  assert.equal(handoff.start, false)
  assert.equal(
    handoff.text,
    'Round 2 of Part 1 of the Spec cards at b2: the commits a1..b2. In your checkout /h/worktrees/cards-review, run `git switch --detach b2`, then `vp install`. Check each finding of the last Round first, then what the commits touched. Write the report to /h/tasks/cards.1/review-2.md, then set the state with `pnpm -C /r task set cards/1 changes --as reviewer` or `pnpm -C /r task set cards/1 approved --as reviewer`, and end your turn. If you cannot write the file, give the report as your final message, and the Lead writes it.',
  )
})

test('each change hands the task to the role that acts next, or to no agent', () => {
  const to = (change, c = {}, asker) => handoffFor(change, { ...task, ...c }, asker)?.role ?? 'the Lead'
  assert.deepEqual(
    [
      to({ kind: 'start' }),
      to({ kind: 'set', to: 'spec' }, { pass: 2 }),
      to({ kind: 'set', to: 'changes' }),
      to({ kind: 'set', to: 'approved' }),
      to({ kind: 'build' }),
      to({ kind: 'set', to: 'building' }),
      to({ kind: 'set', to: 'changes' }, { round: 1 }),
      to({ kind: 'set', to: 'approved' }, { round: 1 }),
      to({ kind: 'answer' }, { k: 1 }, 'implementer'),
    ],
    ['reviewer', 'reviewer', 'the Lead', 'the Lead', 'implementer', 'the Lead', 'implementer', 'implementer', 'implementer'],
  )
  assert.match(handoffFor({ kind: 'set', to: 'spec' }, { ...task, pass: 2 }).text, /pass 2 .*review-0-2\.md/)
  assert.match(handoffFor({ kind: 'set', to: 'approved' }, { ...task, round: 1 }).text, /message\.md/)
  assert.match(handoffFor({ kind: 'answer' }, { ...task, k: 2 }, 'reviewer').text, /answer-2\.md/)
})

test("the Lead's `changes` after its try sends the Implementer the try's report, and the next round's Reviewer checks it first", () => {
  const changes = handoffFor({ kind: 'set', to: 'changes' }, { ...task, round: 1, tried: true })
  assert.equal(changes.role, 'implementer')
  assert.equal(
    changes.text,
    "The Lead's try of Round 1 of cards/1 has findings: read /h/tasks/cards.1/try-1.md in full, fix each finding, and set `ready` again with `pnpm -C /r task set cards/1 ready --as implementer`.",
  )
  const ready = handoffFor({ kind: 'set', to: 'ready' }, { ...task, round: 2, tip: 'b2', base: 'a1', tried: true })
  assert.match(
    ready.text,
    /Check each finding of the Lead's try of the last Round first, in \/h\/tasks\/cards\.1\/try-1\.md, then what the commits touched\. Write the report to \/h\/tasks\/cards\.1\/review-2\.md/,
  )
})

test('each prompt names the tool of the main checkout, never the tool of the checkout the agent works in, and the role, which a subagent has in no environment', () => {
  const c = { ...task, repo: '/src/binnacle' }
  const verdict = handoffFor({ kind: 'start' }, c).text
  assert.match(
    verdict,
    /`pnpm -C \/src\/binnacle task set cards\/1 changes --as reviewer` or `pnpm -C \/src\/binnacle task set cards\/1 approved --as reviewer`/,
  )
  assert.match(handoffFor({ kind: 'build' }, c).text, /`pnpm -C \/src\/binnacle task set cards\/1 <state> --as implementer`/)
  assert.match(
    handoffFor({ kind: 'set', to: 'changes' }, { ...c, round: 1 }).text,
    /`pnpm -C \/src\/binnacle task set cards\/1 ready --as implementer`/,
  )
})
