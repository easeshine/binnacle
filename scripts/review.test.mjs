import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { parseRole } from './agents.mjs'
import { chooseReviewer, nextRound, parseArgs, reviewedBy, reviewPrompt, sourceOf, verdictOf } from './review.mjs'

test('a review needs the builder to name itself', () => {
  assert.throws(() => parseArgs([]), /--as/)
  assert.deepEqual(parseArgs(['--as', 'claude:opus', '--source', '13']), { as: 'claude:opus', source: '13' })
  assert.throws(() => parseArgs(['--as', 'claude:opus', '--fast', 'x']), /not an option/)
})

test("the source is the fix branch's issue, unless one is given", () => {
  assert.equal(sourceOf('fix/13-fill', undefined), 13)
  assert.equal(sourceOf('chore/skills', '20'), 20)
  assert.throws(() => sourceOf('chore/skills', undefined), /--source/)
})

test('the Rounds count up from 1, past the reports that exist', () => {
  assert.equal(nextRound(['checkout']), 1)
  assert.equal(nextRound(['review-1.md', 'review-1.json', 'checkout']), 2)
})

test('the verdict is the last verdict line of the report', () => {
  assert.equal(verdictOf('## Source\n\nNone.\n\nVerdict: approved\n'), 'approved')
  assert.equal(verdictOf('Verdict: approved means none.\n\nVerdict: changes'), 'changes')
  assert.equal(verdictOf('no verdict here'), undefined)
})

test('the prompt names the skill, the source, the tip and the earlier reports, and never the builder', () => {
  const prompt = reviewPrompt({ source: 13, checkout: '/c', tip: 'abc', earlier: ['/r/review-1.md'] })
  assert.match(prompt, /`review` skill/)
  assert.match(prompt, /issue #13/)
  assert.match(prompt, /origin\/main\.\.\.abc/)
  assert.match(prompt, /\/r\/review-1\.md/)
  assert.doesNotMatch(prompt, /opus|claude|glm|builder/i)
})

test('a reviewer that the builder names is checked against its family', () => {
  const config = { roles: {}, families: { zai: 'zai' } }
  const pick = chooseReviewer(config, { runner: 'headless', tool: 'claude', model: 'opus' }, 'headless:claude:sonnet')
  assert.equal(pick.sameFamily, true)
  assert.equal(chooseReviewer(config, { runner: 'headless', tool: 'claude', model: 'opus' }, 'headless:pi:zai/glm-5.3').sameFamily, false)
})

test("the record says when the reviewer was of the builder's family", () => {
  const role = parseRole('headless:claude:sonnet')
  assert.equal(reviewedBy({ role, family: 'anthropic', sameFamily: false }), 'Reviewed-by: headless:claude:sonnet (anthropic)')
  assert.match(reviewedBy({ role, family: 'anthropic', sameFamily: true }), /builder's family \(anthropic\), in a fresh session/)
})
