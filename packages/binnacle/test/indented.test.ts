import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { indented, wrap } from '../src/index.ts'

const wrapped = (text: string, at: { readonly width: number }) => wrap(text, at.width)
const timed = (text: string, at: { readonly width: number; readonly time: number }) => [`${text} ${at.time} ${at.width}`]
const acting = () => [
  { text: 'fold', fold: '1', from: 3 },
  { text: 'run', run: 'x' },
]

test('indented draws the Look at the width less the cells, and puts that many spaces before each line', () => {
  assert.deepEqual(indented(wrapped, 2)('one two three', { width: 9 }), ['  one two', '  three'])
})

test('indented gives the Look the rest of what it is given', () => {
  assert.deepEqual(indented(timed, 2)('at', { width: 10, time: 7 }), ['  at 7 8'])
})

test('indented keeps a line object, and moves its from past the indent', () => {
  assert.deepEqual(indented(acting, 2)(undefined, { width: 10 }), [
    { text: '  fold', fold: '1', from: 5 },
    { text: '  run', run: 'x', from: 2 },
  ])
})

test('indented gives the Look one cell at least', () => {
  assert.deepEqual(indented(timed, 4)('at', { width: 3, time: 0 }), ['    at 0 1'])
})
