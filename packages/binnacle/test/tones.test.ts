import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import type { Binnacle, ThemeLayer } from '../src/api.ts'
import type { TerminalColorMode } from '../src/terminal/pi/colors.ts'
import { mount } from './support/mount.ts'

async function drawn(author: (binnacle: Binnacle) => void, colorMode: TerminalColorMode = 'truecolor') {
  const mounted = await mount({ columns: 12, rows: 1, colorMode })
  mounted.ready()
  await mounted.ctx.plugin({
    name: 'author',
    inject: ['binnacle'],
    apply: (ctx: Context) => {
      author(ctx.binnacle)
    },
  })
  return mounted
}

function themer(ctx: Context, layer: ThemeLayer, name = 'themer') {
  return ctx.plugin({
    name,
    inject: ['binnacle'],
    apply: (plugin: Context) => {
      plugin.binnacle.theme(layer)
    },
  })
}

function painted(...given: Parameters<Binnacle['paint']>[0][]) {
  return (binnacle: Binnacle) => {
    binnacle.place('transcript', { lines: () => [given.map((tone) => binnacle.paint(tone, 'x')).join('')] })
  }
}

test("an author paints in one of pi's Tones that binnacle did not have, such as mdQuote, and it draws in its default", async () => {
  const { terminal } = await drawn(painted('mdQuote', 'thinkingMax', 'syntaxKeyword', 'bashMode', 'mdHr'))
  const styles = await Promise.all([0, 1, 2, 3, 4].map((x) => terminal.styleAt(x, 0)))
  assert.deepEqual(
    styles.map(({ colour, dim }) => [colour, dim]),
    [
      [8, false],
      [208, false],
      [4, false],
      [2, false],
      ['default', true],
    ],
  )
})

test('mdHeading, mdCode, mdLink and selectedBg draw as heading, code, link and selection drew', async () => {
  const { terminal } = await drawn(painted('mdHeading', 'mdCode', 'mdLink', 'selectedBg'))
  const styles = await Promise.all([0, 1, 2].map((x) => terminal.styleAt(x, 0)))
  assert.deepEqual(
    [styles.map(({ colour, bold, underline }) => [colour, bold, underline]), await terminal.inverseAt(3, 0)],
    [
      [
        [6, true, false],
        [3, false, false],
        [4, false, true],
      ],
      true,
    ],
  )
})

test('a layer that names heading, code, link or selection is refused, and the error names the new name, as paint, fill and a like of one are', async () => {
  const { ctx } = await mount()
  const renamed = { heading: 'mdHeading', code: 'mdCode', link: 'mdLink', selection: 'selectedBg' }
  for (const [old, now] of Object.entries(renamed)) {
    const error = new RegExp(`^binnacle: the Tone '${old}' is now '${now}'$`)
    assert.throws(() => ctx.binnacle.theme({ colors: { [old]: 'magenta' } }), { message: error })
    assert.throws(() => ctx.binnacle.theme({ colors: { mine: { like: old } } }), { message: error })
    assert.throws(() => ctx.binnacle.paint(old, 'x'), { message: error })
    assert.throws(() => ctx.binnacle.fill(old, 'x'), { message: error })
    assert.throws(() => ctx.binnacle.paint({ like: old }, 'x'), { message: error })
  }
})

test("a Tone in a Hue draws in the Hue's colour, and a layer that gives the Hue an exact colour changes each Tone in it", async () => {
  const { ctx, terminal } = await drawn(painted('accent', 'mdHeading'))
  const before = await Promise.all([0, 1].map(async (x) => (await terminal.styleAt(x, 0)).colour))
  await themer(ctx, { hues: { cyan: '#5fd7ff' } })
  const after = await Promise.all([0, 1].map((x) => terminal.styleAt(x, 0)))
  assert.deepEqual(
    [before, after.map(({ colour, bold }) => [colour, bold])],
    [
      [6, 6],
      [
        ['#5fd7ff', false],
        ['#5fd7ff', true],
      ],
    ],
  )
})

test('a Tone in an exact colour stays as it is when a layer changes a Hue', async () => {
  const { ctx, terminal } = await drawn(painted('accent', 'borderAccent'))
  await themer(ctx, { colors: { borderAccent: '#00afaf' } }, 'first')
  await themer(ctx, { hues: { cyan: '#5fd7ff' } }, 'second')
  const colours = await Promise.all([0, 1].map(async (x) => (await terminal.styleAt(x, 0)).colour))
  assert.deepEqual(colours, ['#5fd7ff', '#00afaf'])
})

test('a Tone in orange draws as the colour 208 of 256, and a layer can give orange another colour', async () => {
  const { ctx, terminal } = await drawn(painted({ color: 'orange' }, 'mine'))
  await themer(ctx, { colors: { mine: 'orange' } }, 'first')
  const before = await Promise.all([0, 1].map(async (x) => (await terminal.styleAt(x, 0)).colour))
  await themer(ctx, { hues: { orange: '#ffaf00' } }, 'second')
  const after = await Promise.all([0, 1].map(async (x) => (await terminal.styleAt(x, 0)).colour))
  assert.deepEqual(
    [before, after],
    [
      [208, 208],
      ['#ffaf00', '#ffaf00'],
    ],
  )
})

test('a background in a Hue follows the Hue, as a colour does', async () => {
  const { ctx, terminal } = await drawn(painted('mine'))
  await themer(ctx, { colors: { mine: { background: 'orange' } } }, 'first')
  const before = await terminal.backgroundAt(0, 0)
  await themer(ctx, { hues: { orange: '#ffaf00' } }, 'second')
  assert.deepEqual([before, await terminal.backgroundAt(0, 0)], [208, '#ffaf00'])
})

test('a layer that names a Hue that is not one, or gives a Hue a colour that is not one, is refused, and the error names the Hue', async () => {
  const { ctx } = await mount()
  // A layer from plain JavaScript can name any Hue; the cast stands for it.
  assert.throws(() => ctx.binnacle.theme({ hues: { purple: '#800080' } as NonNullable<ThemeLayer['hues']> }), {
    message: /'purple' is not a Hue/,
  })
  assert.throws(() => ctx.binnacle.theme({ hues: { cyan: 'red' } }), { message: /the Hue 'cyan'.*'red'/ })
  assert.throws(() => ctx.binnacle.theme({ hues: { cyan: '36' } }), { message: /the Hue 'cyan'.*'36'/ })
  assert.throws(() => ctx.binnacle.theme({ hues: { orange: 'orange' } }), { message: /the Hue 'orange'.*'orange'/ })
  assert.deepEqual([ctx.binnacle.tokens.hues.cyan, ctx.binnacle.tokens.hues.orange], ['cyan', 208])
})

test('a Tone like error draws as error, and follows error when a layer changes it', async () => {
  const { ctx, terminal } = await drawn(painted('mine'))
  await themer(ctx, { colors: { mine: { like: 'error' } } }, 'first')
  const before = (await terminal.styleAt(0, 0)).colour
  await themer(ctx, { colors: { error: '#ff5f87' } }, 'second')
  assert.deepEqual([before, (await terminal.styleAt(0, 0)).colour], [1, '#ff5f87'])
})

test('a Tone like error, with bold over it, draws as error with bold', async () => {
  const { ctx, terminal } = await drawn(painted('mine'))
  await themer(ctx, { colors: { mine: { like: 'error', bold: true } } })
  const { colour, bold } = await terminal.styleAt(0, 0)
  assert.deepEqual([colour, bold], [1, true])
})

test('a layer that gives a Tone of like its own colour wins over the Tone it was like', async () => {
  const { ctx, terminal } = await drawn(painted('mine'))
  await themer(ctx, { colors: { mine: { like: 'error', bold: true } } }, 'first')
  const { colour: was } = await terminal.styleAt(0, 0)
  await themer(ctx, { colors: { mine: 'magenta' } }, 'second')
  const { colour, bold } = await terminal.styleAt(0, 0)
  assert.deepEqual([was, colour, bold], [1, 5, false])
})

test('a layer whose like makes a loop is refused, and the error names the Tones of the loop', async () => {
  const { ctx } = await mount()
  await themer(ctx, { colors: { a: { like: 'b' } } })
  assert.throws(() => ctx.binnacle.theme({ colors: { b: { like: 'a' } } }), { message: /loop.*'b'.*'a'.*'b'/ })
  assert.throws(() => ctx.binnacle.theme({ colors: { c: { like: 'c' } } }), { message: /loop.*'c'.*'c'/ })
  assert.deepEqual(ctx.binnacle.tokens.colors['b'], undefined)
})

test("a loop that a layer's going leaves draws each Tone of the loop with its own Style alone, and the unload does not fail", async () => {
  const { ctx, terminal } = await drawn(painted('a', 'b'))
  await themer(ctx, { colors: { b: { like: 'a', color: 'blue' } } }, 'first')
  const breaker = themer(ctx, { colors: { b: 'yellow' } }, 'second')
  await breaker
  await themer(ctx, { colors: { a: { like: 'b', color: 'green', bold: true } } }, 'third')
  await breaker.dispose()
  const styles = await Promise.all([0, 1].map((x) => terminal.styleAt(x, 0)))
  assert.deepEqual(
    styles.map(({ colour, bold }) => [colour, bold]),
    [
      [2, true],
      [4, false],
    ],
  )
})

test('a Tone like a Tone that no layer gives draws with its own attributes alone', async () => {
  const { ctx, terminal } = await drawn(painted('mine'))
  await themer(ctx, { colors: { mine: { like: 'nowhere', italic: true } } })
  const { colour, italic } = await terminal.styleAt(0, 0)
  assert.deepEqual([colour, italic], ['default', true])
})

test('paint of a Style like error draws as the Tone does, and follows the theme', async () => {
  const { ctx, terminal } = await drawn(painted({ like: 'error' }))
  const before = (await terminal.styleAt(0, 0)).colour
  await themer(ctx, { colors: { error: 'magenta' } })
  assert.deepEqual([before, (await terminal.styleAt(0, 0)).colour], [1, 5])
})

test('an author gives a Tone of a new meaning, such as diffMoved, a colour in a layer, and paints in it', async () => {
  const { ctx, terminal } = await drawn(painted('diffMoved'))
  await themer(ctx, { colors: { diffMoved: 'magenta' } })
  assert.equal((await terminal.styleAt(0, 0)).colour, 5)
})

test('text painted in a Tone that no layer gives draws plain', async () => {
  const { ctx, terminal } = await drawn(painted('nowhere'))
  assert.deepEqual(
    [await terminal.styleAt(0, 0), ctx.binnacle.paint('nowhere', 'x')],
    [{ colour: 'default', bold: false, dim: false, italic: false, underline: false }, 'x'],
  )
})

test("tokens gives each Tone's Style as it draws, its like read, and the colour of each Hue", async () => {
  const { ctx } = await mount()
  await themer(ctx, {
    colors: { mine: { like: 'mdQuote', bold: true }, lost: { like: 'nowhere', italic: true } },
    hues: { cyan: '#5fd7ff' },
  })
  const { colors, hues } = ctx.binnacle.tokens
  assert.deepEqual(
    [colors.mdQuote, colors['mine'], colors['lost'], colors.selectedBg, colors.searchMatchBg, colors.userMessageBg, hues],
    [
      { color: 'bright-black' },
      { color: 'bright-black', bold: true },
      { italic: true },
      { inverse: true },
      { inverse: true },
      {},
      {
        black: 'black',
        red: 'red',
        green: 'green',
        yellow: 'yellow',
        blue: 'blue',
        magenta: 'magenta',
        cyan: '#5fd7ff',
        white: 'white',
        'bright-black': 'bright-black',
        'bright-red': 'bright-red',
        'bright-green': 'bright-green',
        'bright-yellow': 'bright-yellow',
        'bright-blue': 'bright-blue',
        'bright-magenta': 'bright-magenta',
        'bright-cyan': 'bright-cyan',
        'bright-white': 'bright-white',
        orange: 208,
      },
    ],
  )
})

test('a Tone named as a property of every object, such as constructor, draws plain until a layer gives it, and then as the layer gives it', async () => {
  const names = ['constructor', 'toString', '__proto__', 'hasOwnProperty']
  const { ctx, terminal } = await drawn(painted(...names, { like: 'toString' }))
  const plain = [ctx.binnacle.paint('constructor', 'x'), ctx.binnacle.fill('toString', 'x'), ctx.binnacle.paint({ like: 'valueOf' }, 'x')]
  await themer(ctx, { colors: Object.fromEntries([...names.map((name) => [name, 'magenta']), ['valueOf', { like: 'toString' }]]) })
  const colours = await Promise.all([0, 1, 2, 3, 4].map(async (x) => (await terminal.styleAt(x, 0)).colour))
  assert.deepEqual([plain, colours, ctx.binnacle.tokens.colors['valueOf']], [['x', 'x', 'x'], [5, 5, 5, 5, 5], { color: 'magenta' }])
})
