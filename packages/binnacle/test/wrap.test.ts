import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { wrap } from '../src/index.ts'

test('wrap wraps a text at the width, with first before its first line and the lines after it under the text', () => {
  assert.deepEqual(wrap('one two three four', 10, { first: '› ' }), ['› one two', '  three', '  four'])
})

test('wrap puts rest before each line after the first, its own newlines included', () => {
  assert.deepEqual(wrap('one two\nthree', 9, { first: '- ', rest: '| ' }), ['- one two', '| three'])
})

test('wrap with no prefix wraps the text alone', () => {
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three'])
})

test('wrap carries a style that spans a wrap to the next line, after its prefix', () => {
  assert.deepEqual(wrap('\x1b[1mone two\x1b[22m', 5, { first: '> ' }), ['> \x1b[1mone', '  \x1b[1mtwo\x1b[22m'])
})

test('wrap of an empty text gives first alone', () => {
  assert.deepEqual([wrap('', 10, { first: '› ' }), wrap('', 10)], [['› '], ['']])
})

test('a first wider than the width draws as wide as it is, and the text gets one cell a line', () => {
  assert.deepEqual(wrap('ab', 2, { first: '>>> ' }), ['>>> a', '    b'])
})

test('wrap with plain makes the text plain and keeps its own line breaks', () => {
  assert.deepEqual(wrap('\x1b[31mone\x1b[0m\r\ntwo\x07\rthree', 10, { first: '> ', plain: true }), ['> one', '  two', '  three'])
})

test('wrap with plain leaves the prefixes as they are', () => {
  assert.deepEqual(wrap('one', 10, { first: '\x1b[1m>\x1b[22m ', plain: true }), ['\x1b[1m>\x1b[22m one'])
})
