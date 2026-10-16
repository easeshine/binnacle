import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Tone } from '../src/api.ts'
import { mount } from '../src/testing/index.ts'
import type { MountOptions, Mounted } from '../src/testing/index.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

/** A profile folder of the test's own, with `palette.json` holding `text` when it is given. */
function profile(text?: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-palette-')))
  if (text !== undefined) writeFileSync(join(dir, 'palette.json'), text)
  return dir
}

/** An author's plugin that draws one `x` in each Tone on the transcript's first row. */
const painter = (...tones: Tone[]) => ({
  name: 'painter',
  inject: ['binnacle'],
  apply: (ctx: Context) => {
    ctx.binnacle.place('transcript', { lines: () => [tones.map((tone) => ctx.binnacle.paint(tone, 'x')).join('')] })
  },
})

async function booted(dir: string, tones: Tone[], more: MountOptions = {}) {
  await app?.close()
  app = await mount({
    size: { columns: 70, rows: 3 },
    builtins: ['binnacle-status-line'],
    profile: dir,
    plugins: [painter(...tones)],
    ...more,
  })
  return app
}

/**
 * Saves `palette.json`, by `text` or by a function that saves it, and passes the fake clock until `seen` holds, as the watch reads the file a while after the save.
 * The save is made again each half second until then, as the system can start a folder's watch a while after binnacle asks for it.
 */
async function saved(shown: Mounted, dir: string, text: string | (() => void), seen: () => Promise<boolean>): Promise<void> {
  const save = typeof text === 'string' ? () => writeFileSync(join(dir, 'palette.json'), text) : text
  for (let tries = 0; tries < 1000; tries++) {
    if (tries % 50 === 0) save()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await shown.clock.pass(50)
    if (await seen()) return
  }
}

const colours = async (shown: Mounted, count: number) =>
  Promise.all(Array.from({ length: count }, async (_, x) => (await shown.style(x, 0)).colour))

test("a colour for a Tone in palette.json in binnacle's profile draws at the start", async () => {
  const shown = await booted(profile('{ "colors": { "mdHeading": "green", "mdQuote": "#ff00ff" } }'), ['mdHeading', 'mdQuote', 'error'])
  assert.deepEqual(await colours(shown, 3), [2, '#ff00ff', 1])
})

test('a person saves palette.json while binnacle runs, and binnacle draws in the new colours at once', async () => {
  const dir = profile('{ "colors": { "mdHeading": "green" } }')
  const shown = await booted(dir, ['mdHeading', 'mdQuote'])
  const before = await colours(shown, 2)
  await saved(
    shown,
    dir,
    '{ "colors": { "mdHeading": "magenta", "mdQuote": "#00ffff" } }',
    async () => (await shown.style(0, 0)).colour !== 2,
  )
  assert.deepEqual(
    [before, await colours(shown, 2)],
    [
      [2, 8],
      [5, '#00ffff'],
    ],
  )
})

test('a save by a rename, as an editor saves, is read too', async () => {
  const dir = profile('{ "colors": { "mdHeading": "green" } }')
  const shown = await booted(dir, ['mdHeading'])
  const rename = () => {
    writeFileSync(join(dir, 'palette.json.tmp'), '{ "colors": { "mdHeading": "magenta" } }')
    renameSync(join(dir, 'palette.json.tmp'), join(dir, 'palette.json'))
  }
  await saved(shown, dir, rename, async () => (await shown.style(0, 0)).colour === 5)
  assert.equal((await shown.style(0, 0)).colour, 5)
})

test("a colour in palette.json wins over each plugin's theme layer, a built-in's or an author's, whichever loads last", async () => {
  const shown = await booted(profile('{ "colors": { "mdHeading": "green", "status.text": "red" } }'), ['mdHeading', 'mdQuote'])
  await shown.ctx.plugin({
    name: 'late',
    inject: ['binnacle'],
    apply: (ctx: Context) => void ctx.binnacle.theme({ colors: { mdHeading: 'magenta', mdQuote: 'blue', 'status.text': 'yellow' } }),
  })
  assert.deepEqual(
    [await colours(shown, 2), (await shown.style(0, 2)).colour, (await shown.screen())[2]],
    [[2, 4], 1, 'idle · deepseek-v4'],
  )
})

test('a Hue in palette.json changes each Tone in it, as a layer’s Hue does, and a Tone of the file in that Hue too', async () => {
  const shown = await booted(profile('{ "hues": { "orange": "#ff8700", "cyan": 81 }, "colors": { "error": "orange" } }'), [
    'syntaxString',
    'accent',
    'error',
    'success',
  ])
  assert.deepEqual(await colours(shown, 4), ['#ff8700', 81, '#ff8700', 2])
})

test('a palette.json that is not JSON, or that names a colour that is not one, leaves the colours it had, and the status line says what is wrong and where', async () => {
  const dir = profile('{ "colors": { "mdHeading": "green", "mdQuote": "#00ffff" } }')
  const shown = await booted(dir, ['mdHeading', 'mdQuote'])
  const warned = (start: string) => async () => (await shown.screen())[2]!.startsWith(start)
  await saved(shown, dir, '{ "colors": { "mdHeading": "red" ', warned('palette.json: not JSON'))
  const broken = [await colours(shown, 2), (await shown.screen())[2], (await shown.style(0, 2)).colour]
  await saved(shown, dir, '{ "colors": { "mdHeading": "red", "mdQuote": "#00fff" } }', warned('palette.json: the Tone'))
  assert.deepEqual(
    [broken, [await colours(shown, 2), (await shown.screen())[2]]],
    [
      [[2, '#00ffff'], "palette.json: not JSON at line 1 column 34: Expected ',' or '}' after…", 1],
      [[2, '#00ffff'], "palette.json: the Tone mdQuote is not a colour: '#00fff' · idle · dee…"],
    ],
  )
})

test("when palette.json is mended, the colours follow it, and the status line's warning goes", async () => {
  const dir = profile('{ "colors": { "mdHeading": "green", "mdQuote": "#00fff" } }')
  const shown = await booted(dir, ['mdHeading', 'mdQuote'])
  const broken = [await colours(shown, 2), (await shown.screen())[2]]
  await saved(
    shown,
    dir,
    '{ "colors": { "mdHeading": "magenta", "mdQuote": "#00ffff" } }',
    async () => (await shown.style(0, 0)).colour === 5,
  )
  assert.deepEqual(
    [broken, [await colours(shown, 2), (await shown.screen())[2], shown.binnacle.palette.state.error]],
    [
      [[6, 8], "palette.json: the Tone mdQuote is not a colour: '#00fff' · idle · dee…"],
      [[5, '#00ffff'], 'idle · deepseek-v4', undefined],
    ],
  )
})

test("with no palette.json, or an empty one, binnacle draws in the terminal's own colours, as before", async () => {
  const none = await booted(profile(), ['mdHeading', 'mdQuote', 'syntaxString'])
  const noFile = [await colours(none, 3), (await none.screen())[2]]
  const empty = await booted(profile(''), ['mdHeading', 'mdQuote', 'syntaxString'])
  const emptyFile = [await colours(empty, 3), (await empty.screen())[2]]
  const object = await booted(profile('{}'), ['mdHeading', 'mdQuote', 'syntaxString'])
  const objectFile = await colours(object, 3)
  const noFolder = await booted(join(profile(), 'gone'), ['mdHeading'])
  assert.deepEqual(
    [noFile, emptyFile, objectFile, [await colours(noFolder, 1), noFolder.binnacle.palette.state]],
    [
      [[6, 8, 208], 'idle · deepseek-v4'],
      [[6, 8, 208], 'idle · deepseek-v4'],
      [6, 8, 208],
      [[6], { inUse: 'terminal', shown: 'terminal', error: undefined }],
    ],
  )
})

test("palette.json deleted while binnacle runs leaves the terminal's own colours", async () => {
  const dir = profile('{ "colors": { "mdHeading": "green" } }')
  const shown = await booted(dir, ['mdHeading'])
  await saved(
    shown,
    dir,
    () => rmSync(join(dir, 'palette.json'), { force: true }),
    async () => (await shown.style(0, 0)).colour === 6,
  )
  assert.deepEqual([(await shown.style(0, 0)).colour, (await shown.screen())[2]], [6, 'idle · deepseek-v4'])
})

test('palette.json refuses a key that is not one of its three, a Hue that is not one, a colour that is not one, a Style it cannot read, and a like loop, and names each', async () => {
  const files = [
    '{ "colours": {} }',
    '{ "palette": 3 }',
    '{ "hues": { "pink": "#ff00ff" } }',
    '{ "hues": { "orange": "red" } }',
    '{ "colors": { "mdHeading": { "color": "teal" } } }',
    '{ "colors": { "mdHeading": { "background": 300 } } }',
    '{ "colors": { "mdHeading": { "bold": "yes" } } }',
    '{ "colors": { "mdHeading": { "shade": 1 } } }',
    '{ "colors": { "heading": "green" } }',
    '{ "colors": { "a": { "like": "b" }, "b": { "like": "a" } } }',
    '[]',
  ]
  const errors = []
  for (const file of files) errors.push([(await booted(profile(file), ['mdHeading'])).binnacle.palette.state.error, await colours(app!, 1)])
  assert.deepEqual(errors, [
    ["palette.json: 'colours' is not palette, hues or colors", [6]],
    ['palette.json: palette is not a name: 3', [6]],
    ["palette.json: 'pink' is not a Hue", [6]],
    ["palette.json: the Hue 'orange' takes a 256-colour index or an exact colour, not 'red'", [6]],
    ["palette.json: the Tone mdHeading's colour is not a colour: 'teal'", [6]],
    ["palette.json: the Tone mdHeading's background is not a colour: 300", [6]],
    ["palette.json: the Tone mdHeading's bold is not true or false: 'yes'", [6]],
    ["palette.json: the Tone mdHeading has no 'shade': a Style takes like, color, background, bold, dim, italic, underline, inverse", [6]],
    ["palette.json: the Tone 'heading' is now 'mdHeading'", [6]],
    ["palette.json: the like makes a loop: 'a' like 'b' like 'a'", [6]],
    ['palette.json: not an object of palette, hues and colors', [6]],
  ])
})

test('binnacle.palette names the palette that palette.json names, and the one drawn, and an author cannot set it', async () => {
  const dir = profile('{ "palette": "pi/dark" }')
  const shown = await booted(dir, ['mdHeading'])
  const named = { ...shown.binnacle.palette.state }
  shown.binnacle.palette.set((state) => Object.assign(state, { inUse: 'pi/light' }))
  const set = { ...shown.binnacle.palette.state }
  let told = 0
  shown.binnacle.palette.watch(() => told++)
  await saved(shown, dir, '{}', async () => shown.binnacle.palette.state.inUse === 'terminal')
  assert.deepEqual(
    [named, set, { ...shown.binnacle.palette.state }, told > 0],
    [
      { inUse: 'pi/dark', shown: 'terminal', error: undefined },
      { inUse: 'pi/dark', shown: 'terminal', error: undefined },
      { inUse: 'terminal', shown: 'terminal', error: undefined },
      true,
    ],
  )
})

test("a like in palette.json that makes a loop with a feature's layer, loaded after the file, is refused, and refused no more once that layer goes", async () => {
  const shown = await booted(profile('{ "colors": { "error": { "like": "status.error", "color": "green" } } }'), ['error'])
  const looped = [shown.binnacle.palette.state.error, await colours(shown, 1), (await shown.style(0, 2)).colour]
  await shown.unload('binnacle-status-line')
  assert.deepEqual(
    [looped, [shown.binnacle.palette.state.error, await colours(shown, 1)]],
    [
      ["palette.json: the like makes a loop: 'error' like 'status.error' like 'error'", [1], 1],
      [undefined, [2]],
    ],
  )
})

test('a palette.json that cannot be read keeps the colours it had, and the status line says why until it is read, as a layer comes or at the start', async () => {
  const dir = profile('{ "colors": { "mdHeading": "green" } }')
  const shown = await booted(dir, ['mdHeading'])
  const folder = () => {
    rmSync(join(dir, 'palette.json'), { force: true })
    mkdirSync(join(dir, 'palette.json'), { recursive: true })
  }
  await saved(shown, dir, folder, async () => shown.binnacle.palette.state.error !== undefined)
  const unread = [await colours(shown, 1), (await shown.screen())[2]]
  await shown.ctx.plugin({
    name: 'late',
    inject: ['binnacle'],
    apply: (ctx: Context) => void ctx.binnacle.theme({ colors: { success: 'blue' } }),
  })
  const layered = [await colours(shown, 1), (await shown.screen())[2]]
  const atStart = await booted(dir, ['mdHeading'])
  assert.deepEqual(
    [unread, layered, [await colours(atStart, 1), (await atStart.screen())[2]]],
    [
      [[2], 'palette.json: cannot be read: EISDIR: illegal operation on a director…'],
      [[2], 'palette.json: cannot be read: EISDIR: illegal operation on a director…'],
      [[6], 'palette.json: cannot be read: EISDIR: illegal operation on a director…'],
    ],
  )
})
