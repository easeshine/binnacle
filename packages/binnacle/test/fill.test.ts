import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import type { Binnacle, Style } from '../src/api.ts'
import { frame } from '../src/index.ts'
import { mount } from '../src/testing/index.ts'
import type { MountOptions, Mounted } from '../src/testing/index.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

async function filling(columns: number, rows: number, author: (binnacle: Binnacle) => void, more: MountOptions = {}) {
  await app?.close()
  app = await mount({
    size: { columns, rows },
    builtins: [],
    plugins: [{ name: 'author', inject: ['binnacle'], apply: (ctx: Context) => void author(ctx.binnacle) }],
    ...more,
  })
  return app
}

const backgrounds = (shown: Mounted, y: number, cells: readonly number[]) =>
  Promise.all(cells.map(async (x) => (await shown.style(x, y)).background))

const fillStyle = (binnacle: Binnacle, style: Style, text: string) => binnacle.fill(style, text)

const BACKGROUND = { color: 'black', background: 'bright-black' } as const
const BLUE: Style = { background: 'blue' }

test("an author fills a line with a Style's background, and the background reaches the right edge of the line's Place", async () => {
  const shown = await filling(8, 1, (binnacle) => {
    binnacle.place('transcript', { lines: () => [fillStyle(binnacle, BLUE, 'hey')] })
  })
  assert.deepEqual(await backgrounds(shown, 0, [0, 2, 3, 5, 7]), [4, 4, 4, 4, 4])
})

test('an author fills a line with a Tone that a theme layer gives a background, and the background follows the theme', async () => {
  const shown = await filling(8, 1, (binnacle) => {
    binnacle.theme({ colors: { muted: BACKGROUND } })
    binnacle.place('transcript', { lines: () => [binnacle.fill('muted', 'hey')] })
  })
  assert.deepEqual(await backgrounds(shown, 0, [0, 2, 3, 5, 7]), [8, 8, 8, 8, 8])
})

test('an author paints text on a background with paint, and the background stops where the text stops, on each row that the text wraps to', async () => {
  const shown = await filling(4, 2, (binnacle) => {
    binnacle.place('transcript', { lines: () => [binnacle.paint(BACKGROUND, 'one two')] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 0, [0, 1, 2, 3]), await backgrounds(shown, 1, [0, 1, 2, 3])],
    [
      [8, 8, 8, 'default'],
      [8, 8, 8, 'default'],
    ],
  )
})

test('an author fills a line with a Tone that has no background, and the line draws as paint draws it, with nothing behind the rest of the row', async () => {
  const shown = await filling(8, 1, (binnacle) => {
    binnacle.place('transcript', { lines: () => [binnacle.fill('muted', 'hey') + binnacle.fill('muted', '')] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 0, [0, 1, 2, 3]), (await shown.style(0, 0)).colour],
    [['default', 'default', 'default', 'default'], 8],
  )
})

test('an author paints text inside a filled line, in a Tone or a Style with a background of its own, and the fill draws again after it, to the edge', async () => {
  const shown = await filling(8, 1, (binnacle) => {
    binnacle.theme({ colors: { muted: BACKGROUND } })
    binnacle.place('transcript', {
      lines: () => [binnacle.fill('muted', `a${binnacle.paint({ background: 'red' }, 'b')}c`)],
    })
  })
  assert.deepEqual([await backgrounds(shown, 0, [0, 1, 2, 4, 7]), (await shown.style(1, 0)).colour], [[8, 1, 8, 8, 8], 0])
})

test('an author fills an empty line, and a whole row of the background draws', async () => {
  const shown = await filling(6, 1, (binnacle) => {
    binnacle.place('transcript', { lines: () => [fillStyle(binnacle, BLUE, '')] })
  })
  assert.deepEqual(await backgrounds(shown, 0, [0, 2, 5]), [4, 4, 4])
})

test('an author fills a line longer than its Place, and each row that it wraps to fills to the edge', async () => {
  const shown = await filling(4, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => [fillStyle(binnacle, BLUE, 'one two three')] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 0, [0, 1, 2, 3]), await backgrounds(shown, 1, [0, 1, 2, 3]), await backgrounds(shown, 2, [0, 1, 2, 3])],
    [
      [4, 4, 4, 4],
      [4, 4, 4, 4],
      [4, 4, 4, 4],
    ],
  )
})

test('a line that ends with a colour, bold, dim, italic, underline or inverse still open still draws the rest of its row plain', async () => {
  const shown = await filling(12, 1, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['\x1b[31ma\x1b[1mb\x1b[2mc\x1b[3md\x1b[4me\x1b[7mf'] })
  })
  assert.deepEqual(await shown.style(8, 0), {
    colour: 'default',
    background: 'default',
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
  })
})

test("an author fills a line in a frame, and the background reaches the frame's inner edge, and the edge keeps its own Tone", async () => {
  const shown = await filling(8, 5, (binnacle) => {
    binnacle.theme({ colors: { muted: BACKGROUND } })
    binnacle.place('transcript', {
      lines: (width) => frame(binnacle, [binnacle.fill('muted', 'hi'), binnacle.paint(BACKGROUND, 'one two')], width),
    })
  })
  assert.deepEqual(
    [
      await shown.screen(),
      await backgrounds(shown, 1, [0, 1, 5, 6, 7]),
      (await shown.style(0, 1)).dim,
      await backgrounds(shown, 2, [0, 1, 3, 4, 7]),
    ],
    [
      ['╭──────╮', '│hi    │', '│one   │', '│two   │', '╰──────╯'],
      ['default', 8, 8, 8, 'default'],
      true,
      ['default', 8, 8, 'default', 'default'],
    ],
  )
})

test("a filled row in a box stops at the box's content: the padding and the edges draw as they did", async () => {
  const shown = await filling(9, 5, (binnacle) => {
    binnacle.theme({ colors: { muted: BACKGROUND } })
    binnacle.layout('chat', { place: 'transcript', border: true, padding: 1 })
    binnacle.place('transcript', { lines: () => [binnacle.fill('muted', 'hi')] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 2, [0, 1, 2, 4, 6, 7, 8]), await backgrounds(shown, 1, [0, 4, 8])],
    [
      ['default', 'default', 8, 8, 8, 'default', 'default'],
      ['default', 'default', 'default'],
    ],
  )
})

test('a float over a filled row leaves the fill on each side of it', async () => {
  const shown = await filling(6, 1, (binnacle) => {
    binnacle.layout('chat', { over: { place: 'under' }, float: { place: 'note' }, at: { width: 2 } })
    binnacle.place('under', { lines: () => [fillStyle(binnacle, BLUE, 'hey')] })
    binnacle.place('note', { lines: () => ['xy'] })
  })
  assert.deepEqual(await backgrounds(shown, 0, [0, 1, 2, 3, 4, 5]), [4, 4, 'default', 'default', 4, 4])
})

test("a float over a filled row in a box leaves the box's padding and edges as they were", async () => {
  const shown = await filling(10, 6, (binnacle) => {
    binnacle.layout('chat', {
      column: [{ over: { place: 'under' }, float: { place: 'note' }, at: { side: 'top', width: 2 } }],
      border: true,
      padding: 1,
    })
    binnacle.place('under', { lines: () => [fillStyle(binnacle, BLUE, ''), fillStyle(binnacle, BLUE, 'hi')] })
    binnacle.place('note', { lines: () => ['xy'] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 2, [2, 6, 7, 8, 9]), await backgrounds(shown, 3, [2, 7, 8, 9])],
    [
      [4, 4, 4, 'default', 'default'],
      [4, 4, 'default', 'default'],
    ],
  )
})

test('a person who copies a filled row gets its text with no spaces at its end', async () => {
  const shown = await filling(
    10,
    1,
    (binnacle) => {
      binnacle.place('transcript', { lines: () => [fillStyle(binnacle, BLUE, 'hey you')] })
    },
    { builtins: ['binnacle-copy'] },
  )
  await shown.drag({ x: 0, y: 0 }, { x: 9, y: 0 })
  assert.deepEqual(shown.copied, ['hey you'])
})

test("an author whose theme layer changes the fill's Tone sees the fill in the new colour, and in the old one again when the layer goes", async () => {
  const shown = await filling(6, 1, (binnacle) => {
    binnacle.place('transcript', { lines: () => [binnacle.fill('muted', 'hey')] })
  })
  const plain = await backgrounds(shown, 0, [0, 5])
  const layer = await shown.ctx.plugin({
    name: 'themer',
    inject: ['binnacle'],
    apply: (ctx: Context) => {
      ctx.binnacle.theme({ colors: { muted: { background: '#3a3a5a' } } })
    },
  })
  const exact = await backgrounds(shown, 0, [0, 5])
  await layer.dispose()
  assert.deepEqual(
    [plain, exact, await backgrounds(shown, 0, [0, 5])],
    [
      ['default', 'default'],
      ['#3a3a5a', '#3a3a5a'],
      ['default', 'default'],
    ],
  )
})

test('a theme layer that gives a Tone a background that is not a colour is refused, and the error names the Tone, and paint and fill with a Style whose background is not one throw', async () => {
  const shown = await filling(6, 1, () => {})
  assert.throws(() => shown.binnacle.theme({ colors: { muted: { background: '36' } } }), /muted.*'36'/)
  assert.throws(() => shown.binnacle.paint({ background: '36' }, 'x'), /'36'/)
  assert.throws(() => fillStyle(shown.binnacle, { background: '36' }, 'x'), /'36'/)
})

test('a filled line in a separated row draws its background only as far as its text', async () => {
  const shown = await filling(10, 1, (binnacle) => {
    binnacle.layout('chat', { row: [{ place: 'left' }, { place: 'right' }], separator: true })
    binnacle.place('left', { lines: () => [fillStyle(binnacle, BLUE, 'hey')] })
    binnacle.place('right', { lines: () => ['there'] })
  })
  assert.deepEqual(await backgrounds(shown, 0, [0, 1, 2, 3, 4, 5, 6, 9]), [4, 4, 4, 'default', 'default', 'default', 'default', 'default'])
})

test('a filled line in a nested child of a separated row draws its background only as far as its text', async () => {
  const shown = await filling(12, 1, (binnacle) => {
    binnacle.layout('chat', { row: [{ column: [{ place: 'left' }] }, { place: 'right' }], separator: true })
    binnacle.place('left', { lines: () => [fillStyle(binnacle, BLUE, 'hey')] })
    binnacle.place('right', { lines: () => ['ok'] })
  })
  assert.deepEqual(
    [await shown.screen(), await backgrounds(shown, 0, [0, 2, 3, 5, 6, 7, 11])],
    [['hey · ok'], [4, 4, 'default', 'default', 'default', 'default', 'default']],
  )
})

test('a raw colon-form background fills each row that its line wraps to', async () => {
  const shown = await filling(4, 2, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['\x1b[48:5:4mone two'] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 0, [0, 1, 2, 3]), await backgrounds(shown, 1, [0, 1, 2, 3])],
    [
      [4, 4, 4, 4],
      [4, 4, 4, 4],
    ],
  )
})

test('a background in the colon form fills each row that its line wraps to, over an older background before it', async () => {
  const shown = await filling(5, 2, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['\x1b[41mx\x1b[48:5:4mone two'] })
  })
  assert.deepEqual(
    [await backgrounds(shown, 0, [0, 1, 4]), await backgrounds(shown, 1, [0, 2, 4])],
    [
      [1, 4, 4],
      [4, 4, 4],
    ],
  )
})
