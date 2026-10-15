import { onTestFinished, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDoc } from './doc.mjs'

function place() {
  const root = mkdtempSync(join(tmpdir(), 'doc-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'spec.md')
  writeFileSync(file, '# Spec\n\nOne.\n')
  return { root, file, home: join(root, 'home') }
}

const thread = (by, replies = []) => ({
  id: 'c1',
  quote: 'One',
  context: 'One.',
  block: 1,
  text: 'why?',
  by,
  at: 'now',
  resolved: false,
  replies,
})

test('the page answers only its own link, and gives the file and its comments', async () => {
  const { file, home } = place()
  const doc = await openDoc(file, { home })
  onTestFinished(() => doc.close())
  assert.equal((await fetch(doc.link.replace(/t=\w+/, 't=wrong'))).status, 403)
  const state = await (await fetch(doc.link.replace('/?', '/state?'))).json()
  assert.deepEqual(state, { path: file, name: 'spec.md', source: '# Spec\n\nOne.\n', comments: [] })
})

test('a hand-over writes the edits to the file, keeps the file as it was in its doc folder, and writes the comments', async () => {
  const { file, home } = place()
  const doc = await openDoc(file, { home })
  const answer = await fetch(doc.link.replace('/?', '/handover?'), {
    method: 'POST',
    body: JSON.stringify({ source: '# Spec\n\nTwo.\n', comments: [thread('person')], note: 'read it' }),
  })
  assert.equal(answer.status, 200)
  const summary = await doc.done
  const [folder] = readdirSync(join(home, 'docs'))
  const dir = join(home, 'docs', folder)
  assert.match(folder, /^[0-9a-f]{8}-spec$/)
  assert.equal(readFileSync(file, 'utf8'), '# Spec\n\nTwo.\n')
  assert.equal(readFileSync(join(dir, 'before.md'), 'utf8'), '# Spec\n\nOne.\n')
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'comments.json'), 'utf8')), [thread('person')])
  assert.deepEqual(summary.split('\n'), [
    `HANDOVER ${file}`,
    `edited: yes, diff with: git diff --no-index ${join(dir, 'before.md')} ${file}`,
    `comments: 1 open, 1 waiting for the agent, in ${join(dir, 'comments.json')}`,
    'note: read it',
  ])
})

test("a thread waits for the agent only when the person spoke last in it, and the next pass shows the agent's replies", async () => {
  const { file, home } = place()
  const first = await openDoc(file, { home })
  const answered = [thread('person', [{ by: 'agent', text: 'because', at: 'later' }])]
  await fetch(first.link.replace('/?', '/handover?'), {
    method: 'POST',
    body: JSON.stringify({ source: '# Spec\n\nOne.\n', comments: answered }),
  })
  assert.match(await first.done, /\nedited: no\ncomments: 1 open, 0 waiting for the agent, in /)

  const second = await openDoc(file, { home })
  onTestFinished(() => second.close())
  const state = await (await fetch(second.link.replace('/?', '/state?'))).json()
  assert.deepEqual(state.comments, answered)
})
