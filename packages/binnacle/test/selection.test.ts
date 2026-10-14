import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import type { Binnacle, Point, SelectionState } from '../src/api.ts'
import { createModel, internals } from '../src/index.ts'
import { mount } from '../src/testing/index.ts'
import type { MountOptions, Mounted } from '../src/testing/index.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

async function selecting(columns: number, rows: number, author: (binnacle: Binnacle) => void, more: MountOptions = {}) {
  await app?.close()
  app = await mount({
    size: { columns, rows },
    builtins: ['binnacle-copy'],
    plugins: [{ name: 'author', inject: ['binnacle'], apply: (ctx: Context) => void author(ctx.binnacle) }],
    ...more,
  })
  return app
}

const selectionOf = (mounted: Mounted) => mounted.binnacle.modelOf<SelectionState>('selection').state?.selected

const inverseRow = async (mounted: Mounted, y: number, width: number) => {
  let marks = ''
  for (let x = 0; x < width; x++) marks += (await mounted.style(x, y)).inverse ? '#' : '.'
  return marks
}

test('a drag selects the cells from the press to the pointer, inverse, and its release copies them, one line for each row, with no blanks at their ends', async () => {
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world', 'second line', 'third'] })
  })
  await shown.drag({ x: 2, y: 0 }, { x: 6, y: 1 })
  assert.deepEqual(
    [await inverseRow(shown, 0, 12), await inverseRow(shown, 1, 12), await inverseRow(shown, 2, 12), selectionOf(shown), shown.copied],
    ['..#########.', '#######.....', '............', { place: 'transcript', text: 'llo world\nsecond' }, ['llo world\nsecond']],
  )
})

test('a drag up and to the left selects as a drag down and to the right does, both end cells in it', async () => {
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world', 'second line'] })
  })
  await shown.drag({ x: 6, y: 1 }, { x: 2, y: 0 })
  assert.deepEqual(shown.copied, ['llo world\nsecond'])
})

test('a press and a release on one cell clicks it on the release, and a press that moves clicks nothing', async () => {
  const clicks: Point[] = []
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', {
      lines: () => ['hello world'],
      click: (at) => {
        clicks.push(at)
        return true
      },
    })
  })
  await shown.click(1, 0)
  await shown.clock.pass(600)
  await shown.drag({ x: 1, y: 0 }, { x: 4, y: 0 })
  assert.deepEqual([clicks, shown.copied], [[{ line: 0, column: 1 }], ['ello']])
})

test('a drag back to the cell it was pressed on selects nothing, copies nothing and clicks nothing', async () => {
  const clicks: Point[] = []
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', {
      lines: () => ['hello world'],
      click: (at) => {
        clicks.push(at)
        return true
      },
    })
  })
  await shown.drag({ x: 1, y: 0 }, [
    { x: 3, y: 0 },
    { x: 1, y: 0 },
  ])
  assert.deepEqual([clicks, shown.copied, selectionOf(shown)], [[], [], undefined])
})

test('a drag that leaves its Place selects to its edge, and never a row of another Place, nor past the end of its last row', async () => {
  const shown = await selecting(12, 4, (binnacle) => {
    binnacle.layout('chat', { column: [{ place: 'transcript', size: { fixed: 2 } }, { place: 'composer.input' }] })
    binnacle.place('transcript', { lines: () => ['hello world'] })
    binnacle.place('composer.input', { lines: () => ['draft'] })
  })
  await shown.drag({ x: 6, y: 0 }, { x: 2, y: 2 })
  assert.deepEqual([shown.copied, await inverseRow(shown, 2, 12)], [['world'], '............'])
})

test('a Selection stays through keys, the wheel and new output below it, and the next press clears it', async () => {
  const lines = createModel({ lines: ['one', 'two'] })
  const shown = await selecting(12, 4, (binnacle) => {
    binnacle.place('transcript', { lines: () => lines.state.lines, models: [lines] })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 2, y: 0 })
  await shown.press('space')
  await shown.wheel(0, 0, 1)
  lines.set((state) => {
    state.lines = [...state.lines, 'three']
  })
  const kept = [selectionOf(shown)?.text, await inverseRow(shown, 0, 4)]
  await shown.click(0, 3)
  assert.deepEqual([kept, selectionOf(shown), await inverseRow(shown, 0, 4)], [['one', '###.'], undefined, '....'])
})

test('a change to the text a Selection covers clears it, and so do a resize and another Screen shown', async () => {
  const lines = createModel({ lines: ['one', 'two'] })
  let shownScreen: (() => void) | undefined
  const shown = await selecting(12, 4, (binnacle) => {
    binnacle.place('transcript', { lines: () => lines.state.lines, models: [lines] })
    shownScreen = () => void binnacle.show({ name: 'other', layout: { place: 'transcript' } })
  })
  const cleared: (string | undefined)[] = []
  await shown.drag({ x: 0, y: 1 }, { x: 2, y: 1 })
  lines.set((state) => {
    state.lines = ['one', 'TWO']
  })
  await shown.screen()
  cleared.push(selectionOf(shown)?.text)
  await shown.drag({ x: 0, y: 0 }, { x: 2, y: 0 })
  await shown.resize(10, 4)
  cleared.push(selectionOf(shown)?.text)
  await shown.drag({ x: 0, y: 0 }, { x: 2, y: 0 })
  shownScreen!()
  await shown.screen()
  cleared.push(selectionOf(shown)?.text)
  assert.deepEqual(cleared, [undefined, undefined, undefined])
})

test('a drag that begins in a node with `mouse: false` selects nothing, and one in a node with `clicks: false` selects', async () => {
  const shown = await selecting(12, 4, (binnacle) => {
    binnacle.layout('chat', {
      column: [
        { place: 'a', size: { fixed: 1 }, mouse: false },
        { place: 'b', size: { fixed: 1 }, clicks: false },
      ],
    })
    binnacle.place('a', { lines: () => ['alpha'] })
    binnacle.place('b', { lines: () => ['beta'] })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 3, y: 0 })
  const none = selectionOf(shown)
  await shown.drag({ x: 0, y: 1 }, { x: 3, y: 1 })
  assert.deepEqual([none, shown.copied], [undefined, ['beta']])
})

test("a drag over a float selects in the float's Place, and a Selection beneath a float is drawn only where its Place shows", async () => {
  const menu = createModel({ lines: [] as string[] })
  const shown = await selecting(12, 4, (binnacle) => {
    binnacle.layout('chat', { over: { place: 'transcript' }, float: { place: 'menu' }, at: { side: 'bottom', width: 4 } })
    binnacle.place('transcript', { lines: () => ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc', 'dddddddddd'] })
    binnacle.place('menu', { lines: () => menu.state.lines, models: [menu] })
  })
  await shown.drag({ x: 0, y: 3 }, { x: 9, y: 3 })
  menu.set((state) => {
    state.lines = ['menu']
  })
  const under = await inverseRow(shown, 3, 12)
  menu.set((state) => {
    state.lines = []
  })
  const back = await inverseRow(shown, 3, 12)
  menu.set((state) => {
    state.lines = ['menu']
  })
  await shown.screen()
  await shown.drag({ x: 4, y: 3 }, { x: 6, y: 3 })
  assert.deepEqual([under, back, shown.copied], ['####....##..', '##########..', ['dddddddddd', 'men']])
})

test('a wide grapheme is selected and painted whole when either of its cells is', async () => {
  const shown = await selecting(12, 2, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['中文字'] })
  })
  await shown.drag({ x: 1, y: 0 }, { x: 2, y: 0 })
  assert.deepEqual([shown.copied, await inverseRow(shown, 0, 6)], [['中文'], '####..'])
})

test('a drag moves no Focus, and keys go on to the Place that has it', async () => {
  const keys: string[] = []
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.layout('chat', { column: [{ place: 'transcript' }, { place: 'composer.input', size: 'content' }] })
    binnacle.place('transcript', { lines: () => ['hello world'], key: () => true })
    binnacle.place('composer.input', {
      lines: () => ['draft'],
      key: (data) => {
        keys.push(data)
        return true
      },
    })
    binnacle.focus('composer.input')
  })
  await shown.drag({ x: 0, y: 0 }, { x: 3, y: 0 })
  await shown.type('x')
  assert.deepEqual([keys, selectionOf(shown)?.text], [['x'], 'hell'])
})

test('a double click selects a word, a path whole, and copies it; the first click of the run acts, and the second only selects', async () => {
  const clicks: Point[] = []
  const shown = await selecting(30, 2, (binnacle) => {
    binnacle.place('transcript', {
      lines: () => ['open src/core/input.ts now'],
      click: (at) => {
        clicks.push(at)
        return true
      },
    })
  })
  await shown.click(8, 0)
  await shown.click(9, 0)
  assert.deepEqual(
    [clicks, shown.copied, await inverseRow(shown, 0, 26)],
    [[{ line: 0, column: 8 }], ['src/core/input.ts'], '.....#################....'],
  )
})

test("a triple click selects the Part's line across every row it wraps to, and a click after 500 ms starts again", async () => {
  const clicks: Point[] = []
  const shown = await selecting(10, 4, (binnacle) => {
    binnacle.place('transcript', {
      lines: () => ['first', 'alpha beta gamma delta'],
      click: (at) => {
        clicks.push(at)
        return true
      },
    })
  })
  for (let count = 0; count < 3; count++) await shown.click(1, 2)
  await shown.clock.pass(600)
  await shown.click(1, 2)
  assert.deepEqual([shown.copied, clicks.length], [['gamma', 'alpha beta\ngamma\ndelta'], 2])
})

test('a drag after a double click grows the Selection by whole words', async () => {
  const shown = await selecting(30, 2, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['one two three four'] })
  })
  await shown.click(5, 0)
  await shown.drag({ x: 5, y: 0 }, { x: 10, y: 0 })
  assert.deepEqual(shown.copied, ['two three'])
})

test('a drag held above its Place scrolls it one row each 50 ms, and the Selection grows with it', async () => {
  const shown = await selecting(10, 4, (binnacle) => {
    binnacle.layout('chat', { column: [{ place: 'head', size: { fixed: 1 } }, { place: 'transcript' }] })
    binnacle.place('head', { lines: () => ['head'] })
    binnacle.place('transcript', { lines: () => Array.from({ length: 10 }, (_, index) => `line ${index}`) })
  })
  await shown.drag({ x: 5, y: 3 }, { x: 0, y: 0 }, 100)
  assert.deepEqual(
    [shown.copied, await shown.screen()],
    [['line 5\nline 6\nline 7\nline 8\nline 9'], ['head', 'line 5', 'line 6', 'line 7']],
  )
})

test('an author binds `copy.selection` to a key: a release copies nothing, the key copies, and with no Selection the key copies nothing', async () => {
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world'] })
    binnacle.bind('copy.selection', ['ctrl+o'])
  })
  await shown.press('ctrl+o')
  await shown.drag({ x: 0, y: 0 }, { x: 4, y: 0 })
  const released = [...shown.copied]
  await shown.press('ctrl+o')
  assert.deepEqual([released, shown.copied], [[], ['hello']])
})

test("an author's own `copy.selection` runs on a release, given the Selection, and binnacle's clipboard is not written", async () => {
  const texts: string[] = []
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world'] })
    binnacle.action('copy.selection', {
      run: () => void texts.push(binnacle.modelOf<SelectionState>('selection').state?.selected?.text ?? ''),
    })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 4, y: 0 })
  assert.deepEqual([texts, shown.copied], [['hello'], []])
})

test('a Selection of blank rows copies nothing', async () => {
  const shown = await selecting(12, 3, (binnacle) => {
    binnacle.place('transcript', { lines: () => ['', '', 'x'] })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 5, y: 1 })
  assert.deepEqual([selectionOf(shown), shown.copied], [{ place: 'transcript', text: '\n' }, []])
})

test('a press on a row that changes before its release still clicks', async () => {
  const lines = createModel({ lines: ['tick 1'] })
  const clicks: Point[] = []
  const shown = await selecting(12, 2, (binnacle) => {
    binnacle.place('transcript', {
      lines: () => lines.state.lines,
      models: [lines],
      click: (at) => {
        clicks.push(at)
        return true
      },
    })
    internals.later(1000, () =>
      lines.set((state) => {
        state.lines = ['tick 2']
      }),
    )
  })
  await shown.drag({ x: 0, y: 0 }, [], 1500)
  assert.deepEqual(clicks, [{ line: 0, column: 0 }])
})
