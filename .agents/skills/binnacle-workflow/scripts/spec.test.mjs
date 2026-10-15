import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { doorOf, partsOf, titleOf } from './spec.mjs'

const SPEC = `# Spec: select and copy

- **Status:** agreed

## Parts of the build

1. **A drag selects.**
   - Behaviours 1 to 3.

   One-way: it adds a Tone.
2. **A copy reaches the clipboard.** Two-way. After Part 1.
3. **Words and lines.**

Part 1 is the thin path through every seam.

## Door

One-way: it adds a gesture.
`

test("a Spec's Parts are its numbered items, each with its indented lines, and the paragraph after them is no Part", () => {
  const parts = partsOf(SPEC)
  assert.deepEqual(
    parts.map((part) => part.k),
    [1, 2, 3],
  )
  assert.match(parts[0].text, /Behaviours 1 to 3\.\n\n {3}One-way: it adds a Tone\.$/)
  assert.equal(parts[2].text, '**Words and lines.**')
})

test("a Part's Door is its own, or its Spec's", () => {
  const parts = partsOf(SPEC)
  assert.equal(doorOf(parts[1].text, SPEC), 'two-way')
  assert.equal(doorOf(parts[2].text, SPEC), 'one-way')
  assert.equal(doorOf('No door.', '# Spec: x\n'), undefined)
})

test("a Spec's title is its heading, without `Spec:`", () => {
  assert.equal(titleOf(SPEC), 'select and copy')
})
