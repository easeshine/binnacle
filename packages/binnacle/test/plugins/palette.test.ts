import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { PaletteSource, Style, ThemeLayer, Tone } from '../../src/api.ts'
import { mount } from '../../src/testing/index.ts'
import type { MountOptions, Mounted } from '../../src/testing/index.ts'

let app: Mounted | undefined
const env = process.env.PI_CODING_AGENT_DIR
afterEach(async () => {
  await app?.close()
  app = undefined
  if (env === undefined) delete process.env.PI_CODING_AGENT_DIR
  else process.env.PI_CODING_AGENT_DIR = env
})

const folder = (): string => realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-palettes-')))

interface Command {
  readonly name: string
  readonly description: string
  readonly handler: () => unknown
}

// dsh's command registry, as dsh-base provides it: a plugin registers a command, and the composer runs a line.
function registry(ctx: Context): void {
  const registered: Command[] = []
  const service = {
    register: (command: Command) => {
      registered.push(command)
      ctx.emit('commands/change')
      return () => registered.splice(registered.indexOf(command), 1)
    },
    list: () => registered.map(({ name, description }) => ({ name, description })),
    execute: async (_agent: unknown, line: string) => {
      const found = registered.find((command) => line === `/${command.name}`)
      if (found === undefined) return undefined
      return { commandId: 'cmd-1', result: await found.handler() }
    },
  }
  ctx.provide('commands' as never, service as never)
}

/** An author's plugin that draws one `x` in each Tone, or each Style, on the transcript's first row. */
const painter = (...tones: (Tone | Style)[]) => ({
  name: 'painter',
  inject: ['binnacle'],
  apply: (ctx: Context) => {
    ctx.binnacle.place('transcript', { lines: () => [tones.map((tone) => ctx.binnacle.paint(tone, 'x')).join('')] })
  },
})

interface Picking {
  /** `palette.json`'s text, with none for no file. */
  readonly file?: string
  /** The person's own pi themes, by their file's name. */
  readonly themes?: { readonly [file: string]: string }
  readonly tones?: readonly (Tone | Style)[]
  readonly rows?: number
  readonly more?: MountOptions
}

async function picking(options: Picking = {}) {
  const pi = folder()
  mkdirSync(join(pi, 'themes'))
  for (const [file, text] of Object.entries(options.themes ?? {})) writeFileSync(join(pi, 'themes', file), text)
  process.env.PI_CODING_AGENT_DIR = pi
  const profile = folder()
  if (options.file !== undefined) writeFileSync(join(profile, 'palette.json'), options.file)
  app = await mount({
    size: { columns: 40, rows: options.rows ?? 12 },
    builtins: ['binnacle-composer', 'binnacle-commands', 'binnacle-palette', 'binnacle-status-line'],
    profile,
    provide: registry,
    ...options.more,
    plugins: [painter(...(options.tones ?? ['mdHeading', 'mdQuote', 'accent'])), ...(options.more?.plugins ?? [])],
  })
  const shown = app
  const command = async (): Promise<string[]> => {
    await shown.type('/palette')
    await shown.press('enter')
    return shown.screen()
  }
  const file = () => readFileSync(join(profile, 'palette.json'), 'utf8')
  const colours = async (count: number) => Promise.all(Array.from({ length: count }, async (_, x) => (await shown.style(x, 0)).colour))
  return { app: shown, command, file, profile, pi, colours }
}

const RULE = '─'.repeat(40)

test('a person runs /palette, and a List of palettes opens above the composer, the one in use marked: Terminal, then pi’s dark and light, then each of their own pi themes by its file’s name', async () => {
  const { command } = await picking({ themes: { 'mine.json': '{}', 'zed.json': '{}', 'notes.txt': '' } })
  assert.deepEqual(await command(), [
    'xxx',
    '',
    'idle · deepseek-v4',
    RULE,
    '› Terminal',
    '  dark — pi',
    '  light — pi',
    '  mine — pi-themes',
    '  zed — pi-themes',
    RULE,
    '',
    RULE,
  ])
})

// pi's own colours, as its dark.json and light.json give them.
const DARK = { yellow: 'okhsl(83 88% 67%)', green: 'okhsl(159 59% 67%)', violet: 'okhsl(295 50% 67%)', blueBg: 'okhsl(233 41% 24%)' }
const LIGHT = { yellow: 'okhsl(83 99% 47%)', green: 'okhsl(159 75% 46%)' }

/** The List's rows, under its rule. */
const listed = async (shown: Mounted) => {
  const screen = await shown.screen()
  const top = screen.indexOf(RULE)
  return screen.slice(top + 1, screen.indexOf(RULE, top + 1))
}

/** The colour of each cell of the first row, from `from`. */
const row = async (shown: Mounted, count: number, from = 0) =>
  Promise.all(Array.from({ length: count }, async (_, x) => (await shown.style(from + x, 0)).colour))

/** Lets what the file system and the promises do settle, on the fake clock. */
const settled = async (shown: Mounted) => {
  for (let tries = 0; tries < 5; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    await shown.clock.pass(10)
  }
}

/** A source of an author's, whose loads wait until the test settles them. */
function slowSource(name: string, palettes: readonly string[]) {
  const waiting: { name: string; resolve: (layer: ThemeLayer) => void; reject: (why: Error) => void }[] = []
  const source: PaletteSource = {
    name,
    list: () => Promise.resolve(palettes.map((palette) => ({ name: palette }))),
    load: (palette) => new Promise((resolve, reject) => waiting.push({ name: palette, resolve, reject })),
  }
  const plugin = { name: `source-${name}`, inject: ['binnacle'], apply: (ctx: Context) => void ctx.binnacle.palettes(source) }
  return { source, plugin, waiting }
}

test('a person moves the mark to a palette, and binnacle draws in it at once, with the person’s own colours over it', async () => {
  const { app: shown, command } = await picking({
    file: '{ "colors": { "mdQuote": "#ff00ff" } }',
    tones: ['mdHeading', 'mdQuote', { color: DARK.yellow }],
  })
  await command()
  const before = await row(shown, 3)
  await shown.press('down')
  const [heading, quote, yellow] = await row(shown, 3)
  assert.deepEqual(
    [before.slice(0, 2), heading === yellow, quote, shown.binnacle.palette.state.shown],
    [[6, '#ff00ff'], true, '#ff00ff', 'pi/dark'],
  )
})

test('a person presses enter on a palette that loaded, and the palette is kept: palette.json names it, and the List closes', async () => {
  const { app: shown, command, file } = await picking({ file: '{ "colors": { "mdQuote": "#ff00ff" } }' })
  await command()
  await shown.press('down')
  await shown.press('enter')
  const screen = await shown.screen()
  assert.deepEqual(
    [file(), screen.slice(-3), shown.binnacle.palette.state],
    [
      '{\n  "palette": "pi/dark",\n  "colors": {\n    "mdQuote": "#ff00ff"\n  }\n}\n',
      [RULE, ' ', RULE],
      { inUse: 'pi/dark', shown: 'pi/dark', error: undefined },
    ],
  )
})

test('palette.json that names pi’s dark draws in it from the first draw', async () => {
  const { app: shown } = await picking({ file: '{ "palette": "pi/dark" }', tones: ['mdHeading', { color: DARK.yellow }] })
  const [heading, yellow] = await row(shown, 2)
  assert.deepEqual([heading === yellow, heading !== 6, shown.binnacle.palette.state.shown], [true, true, 'pi/dark'])
})

test('a person presses esc, and binnacle draws in the palette that palette.json names, and the file does not change', async () => {
  const text = '{ "palette": "pi/dark", "colors": {} }'
  const { app: shown, command, file } = await picking({ file: text, tones: ['mdHeading', { color: DARK.yellow }] })
  await command()
  await shown.press('down')
  const light = (await row(shown, 2))[0]
  await shown.press('escape')
  const [heading, yellow] = await row(shown, 2)
  assert.deepEqual(
    [light === yellow, heading === yellow, file(), (await shown.screen()).slice(-3), shown.binnacle.palette.state.shown],
    [false, true, text, [RULE, ' ', RULE], 'pi/dark'],
  )
})

test('a person picks another palette, and each of their own colours that names a Hue follows the new palette’s Hue, and each exact colour stays as it is', async () => {
  const { app: shown, command } = await picking({
    file: '{ "palette": "pi/dark", "colors": { "mdHeading": "green", "mdQuote": "#ff00ff" } }',
    tones: ['mdHeading', 'mdQuote', { color: DARK.green }, { color: LIGHT.green }],
  })
  const [inDark, quoteInDark, darkGreen] = await row(shown, 3)
  await command()
  await shown.press('down')
  const [inLight, quoteInLight, , lightGreen] = await row(shown, 4)
  assert.deepEqual(
    [inDark === darkGreen, inLight === lightGreen, inLight !== inDark, quoteInDark, quoteInLight],
    [true, true, true, '#ff00ff', '#ff00ff'],
  )
})

test('a person picks Terminal, and binnacle draws in its defaults, with their own colours over them, and palette.json holds no palette', async () => {
  const {
    app: shown,
    command,
    file,
  } = await picking({
    file: '{ "palette": "pi/dark", "hues": { "orange": "#ffaf00" }, "colors": { "mdHeading": "green", "mdQuote": "orange" } }',
  })
  await command()
  await shown.press('up')
  await shown.press('enter')
  assert.deepEqual(
    [JSON.parse(file()), await row(shown, 3), shown.binnacle.palette.state.inUse],
    [{ hues: { orange: '#ffaf00' }, colors: { mdHeading: 'green', mdQuote: 'orange' } }, [2, '#ffaf00', 6], 'terminal'],
  )
})

test('pi’s dark draws each Tone in the colour that pi’s dark gives it, its vars read, and each of pi’s backgrounds as a background', async () => {
  const { app: shown } = await picking({
    file: '{ "palette": "pi/dark" }',
    tones: ['accent', 'selectedBg', 'border', { color: DARK.violet }, { background: DARK.blueBg }, { color: 'okhsl(231 57% 65%)' }],
  })
  const colours = await row(shown, 6)
  const backgrounds = [(await shown.style(1, 0)).background, (await shown.style(4, 0)).background]
  assert.deepEqual(
    [colours[0] === colours[3], colours[1], backgrounds[0] === backgrounds[1], colours[2] === colours[5]],
    [true, 'default', true, true],
  )
})

test('a pi theme’s vars named as a Hue, such as red, or violet for magenta, give the palette that Hue, and each other Hue is the terminal’s own', async () => {
  const { app: shown } = await picking({
    file: '{ "palette": "pi/dark", "colors": { "a": "magenta", "b": "yellow", "c": "orange", "d": "cyan" } }',
    tones: ['a', 'b', 'c', 'd', { color: DARK.violet }, { color: DARK.yellow }],
  })
  const [a, b, c, d, violet, yellow] = await row(shown, 6)
  assert.deepEqual([a === violet, b === yellow, c, d], [true, true, 208, 6])
})

test('the mark on a palette that does not load shows what is wrong beside it, and binnacle keeps the colours it drew', async () => {
  const { app: shown, command } = await picking({ file: '{ "palette": "pi/dark" }', themes: { 'mine.json': '{ not json' } })
  await command()
  await shown.press('down')
  const drawn = await row(shown, 3)
  await shown.press('down')
  await settled(shown)
  assert.deepEqual(
    [await listed(shown), await row(shown, 3), shown.binnacle.palette.state],
    [
      ['  Terminal', '  dark — pi', '  light — pi', '› mine — pi-themes not JSON'],
      drawn,
      { inUse: 'pi/dark', shown: 'pi/light', error: undefined },
    ],
  )
})

test('enter on a palette that does not load keeps the List open, and the file as it was', async () => {
  const text = '{ "palette": "pi/dark" }'
  const { app: shown, command, file } = await picking({ file: text, themes: { 'mine.json': '{ not json' } })
  await command()
  await shown.press('down')
  await shown.press('down')
  await settled(shown)
  await shown.press('enter')
  await settled(shown)
  assert.deepEqual([await listed(shown), file()], [['  Terminal', '  dark — pi', '  light — pi', '› mine — pi-themes not JSON'], text])
})

const DARK_THEME = JSON.parse(readFileSync(new URL('../../src/terminal/pi/dark.json', import.meta.url), 'utf8')) as {
  colors: { [tone: string]: unknown }
}

/** pi's dark theme, as a person copies it, with these colours changed and those taken out. */
const piTheme = (colors: { readonly [tone: string]: unknown }, without: readonly string[] = []) =>
  JSON.stringify({
    ...DARK_THEME,
    colors: { ...Object.fromEntries(Object.entries(DARK_THEME.colors).filter(([tone]) => !without.includes(tone))), ...colors },
  })
const accentTheme = (accent: string) => piTheme({ accent })

test('a pi theme is read only when the mark moves to it, and when palette.json names it at the start', async () => {
  const {
    app: shown,
    command,
    pi,
  } = await picking({
    file: '{ "palette": "pi-themes/mine" }',
    themes: { 'mine.json': accentTheme('#ff0000'), 'other.json': accentTheme('#00ff00') },
    tones: ['accent'],
  })
  const atStart = (await row(shown, 1))[0]
  await command()
  writeFileSync(join(pi, 'themes', 'other.json'), accentTheme('#0000ff'))
  await shown.press('down')
  await settled(shown)
  assert.deepEqual([atStart, (await row(shown, 1))[0], shown.binnacle.palette.state.shown], ['#ff0000', '#0000ff', 'pi-themes/other'])
})

test('a palette.json that names a palette that is not there, or that does not load, draws as Terminal, with the person’s own colours, and the status line says which palette and why', async () => {
  const gone = await picking({ file: '{ "palette": "pi-themes/mine", "colors": { "mdQuote": "#ff00ff" } }', rows: 6 })
  const notThere = [await row(gone.app, 3), (await gone.app.screen())[2], gone.app.binnacle.palette.state.shown]
  await gone.app.close()
  const broken = await picking({
    file: '{ "palette": "pi-themes/mine", "colors": { "mdQuote": "#ff00ff" } }',
    themes: { 'mine.json': '{' },
    rows: 6,
  })
  assert.deepEqual(
    [notThere, [await row(broken.app, 3), (await broken.app.screen())[2], broken.app.binnacle.palette.state.shown]],
    [
      [[6, '#ff00ff', 6], 'palette.json: no palette pi-themes/mine…', 'terminal'],
      [[6, '#ff00ff', 6], 'palette.json: pi-themes/mine: not JSON …', 'terminal'],
    ],
  )
})

test('a person picks a palette while palette.json on disk holds a mistake, and binnacle does not write the file, and the status line says what is wrong', async () => {
  const { app: shown, command, file, profile } = await picking({ file: '{}' })
  await command()
  await shown.press('down')
  writeFileSync(join(profile, 'palette.json'), '{ "colors": { "mdQuote": "#00fff" } }')
  await shown.press('enter')
  const screen = await shown.screen()
  assert.deepEqual(
    [file(), screen.find((line) => line.startsWith('palette.json')), (await listed(shown))[1]],
    ['{ "colors": { "mdQuote": "#00fff" } }', 'palette.json: the Tone mdQuote is not a…', '› dark — pi'],
  )
})

test('a pick writes palette into the file as it is on disk once its palette has loaded, so a colour saved while it loaded is kept', async () => {
  const slow = slowSource('slow', ['one'])
  const { app: shown, command, file, profile } = await picking({ file: '{}', more: { plugins: [slow.plugin] } })
  await command()
  await shown.press('pagedown')
  await shown.press('pagedown')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('enter')
  writeFileSync(join(profile, 'palette.json'), '{ "colors": { "mdQuote": "#00ffff" } }')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  assert.deepEqual(
    [JSON.parse(file()), shown.binnacle.palette.state.inUse],
    [{ palette: 'slow/one', colors: { mdQuote: '#00ffff' } }, 'slow/one'],
  )
})

test('esc while a pick waits ends it: the file does not change, and the List closes', async () => {
  const slow = slowSource('slow', ['one'])
  const { app: shown, command, file } = await picking({ file: '{}', more: { plugins: [slow.plugin] } })
  await command()
  await shown.press('pagedown')
  await shown.press('pagedown')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('enter')
  await shown.press('down')
  await shown.press('escape')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  assert.deepEqual(
    [file(), (await shown.screen()).slice(-3), shown.binnacle.palette.state.shown, slow.waiting.length],
    ['{}', [RULE, ' ', RULE], 'terminal', 0],
  )
})

test('an author adds a place that palettes come from, with binnacle.palettes(source), and its palettes are in the List after pi’s', async () => {
  const mine: PaletteSource = {
    name: 'mine',
    list: () => Promise.resolve([{ name: 'sea' }, { name: 'sand', description: 'warm' }, { name: 'sea' }]),
    load: () => Promise.resolve({ hues: { cyan: '#00aaaa' }, colors: { accent: '#123456' } }),
  }
  const plugin = { name: 'mine', inject: ['binnacle'], apply: (ctx: Context) => void ctx.binnacle.palettes(mine) }
  const { app: shown, command } = await picking({ themes: { 'own.json': '{}' }, more: { plugins: [plugin] }, rows: 14 })
  await command()
  await shown.press('pagedown')
  await settled(shown)
  assert.deepEqual(
    [await listed(shown), (await row(shown, 3))[2]],
    [['  Terminal', '  dark — pi', '  light — pi', '  own — pi-themes', '  sea — mine', '› sand — mine · warm'], '#123456'],
  )
})

test('a second source of a name that is taken is refused, and the error names it', async () => {
  const { app: shown } = await picking()
  const again = { name: 'pi', list: () => Promise.resolve([]), load: () => Promise.reject(new Error('none')) }
  assert.throws(() => shown.binnacle.palettes(again), { message: "binnacle: a palette source named 'pi' is there already" })
  assert.throws(() => shown.binnacle.palettes({ ...again, name: 'a/b' }), {
    message: "binnacle: a palette source's name is letters, digits and -, not 'a/b'",
  })
})

test('a palette that its source loads after the mark has left it is not drawn, even when the mark has come back to it and a newer load drew it', async () => {
  const slow = slowSource('slow', ['one', 'two'])
  const { app: shown, command } = await picking({ more: { plugins: [slow.plugin] }, tones: ['accent'] })
  await command()
  await shown.press('up')
  await shown.press('up')
  await shown.press('down')
  const [first, second, third] = slow.waiting.splice(0)
  third!.resolve({ colors: { accent: '#00ff00' } })
  await settled(shown)
  const drawn = (await row(shown, 1))[0]
  first!.resolve({ colors: { accent: '#ff0000' } })
  second!.resolve({ colors: { accent: '#0000ff' } })
  await settled(shown)
  assert.deepEqual(
    [[first!.name, second!.name, third!.name], drawn, (await row(shown, 1))[0]],
    [['two', 'one', 'two'], '#00ff00', '#00ff00'],
  )
})

test('a Request that comes while the List is open hides it with the composer, and when it goes, the List is back with its mark and the Focus', async () => {
  const { app: shown, command } = await picking({
    more: {
      builtins: [
        'binnacle-composer',
        'binnacle-commands',
        'binnacle-palette',
        'binnacle-status-line',
        'binnacle-requests',
        'binnacle-requests-view',
      ],
    },
    rows: 16,
  })
  await command()
  await shown.press('down')
  await shown.press('down')
  const approved = shown.approve('write')
  const asked = await shown.screen()
  await shown.press('enter')
  await approved
  await shown.press('up')
  assert.deepEqual(
    [asked.some((line) => line.includes('light — pi')), await listed(shown)],
    [false, ['  Terminal', '› dark — pi', '  light — pi']],
  )
})

test('with the palette’s row off, /palette is no command', async () => {
  const { app: shown, command } = await picking({ more: { builtins: ['binnacle-composer', 'binnacle-commands', 'binnacle-status-line'] } })
  const screen = await command()
  assert.deepEqual([screen.includes('› Terminal'), shown.binnacle.paletteSources()], [false, []])
})

test('a save that names another palette while a pick waits ends the pick: the file keeps what was saved, and its palette draws', async () => {
  const slow = slowSource('slow', ['one'])
  const { app: shown, command, file, profile } = await picking({ file: '{}', more: { plugins: [slow.plugin] } })
  await command()
  await shown.press('pagedown')
  await shown.press('pagedown')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('enter')
  writeFileSync(join(profile, 'palette.json'), '{ "palette": "pi/light" }')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  assert.deepEqual([file(), shown.binnacle.palette.state.shown], ['{ "palette": "pi/light" }', 'pi/light'])
})

test('a source that throws in list shows its name with the error, beside the other sources’ palettes', async () => {
  const failing: PaletteSource = {
    name: 'broken',
    list: () => Promise.reject(new Error('no folder')),
    load: () => Promise.reject(new Error('none')),
  }
  const plugin = { name: 'broken', inject: ['binnacle'], apply: (ctx: Context) => void ctx.binnacle.palettes(failing) }
  const { app: shown, command } = await picking({ more: { plugins: [plugin] } })
  await command()
  assert.deepEqual(await listed(shown), ['› Terminal', '  dark — pi', '  light — pi', '  broken — no folder'])
})

test('a source whose plugin unloads while its palette is in use draws as Terminal, and the status line says it is not there', async () => {
  const mine: PaletteSource = {
    name: 'mine',
    list: () => Promise.resolve([{ name: 'sea' }]),
    load: () => Promise.resolve({ colors: { mdHeading: '#123456' } }),
  }
  const plugin = { name: 'mine', inject: ['binnacle'], apply: (ctx: Context) => void ctx.binnacle.palettes(mine) }
  const { app: shown } = await picking({ file: '{ "palette": "mine/sea" }', more: { plugins: [plugin] } })
  const before = (await row(shown, 1))[0]
  await shown.unload('mine')
  await settled(shown)
  assert.deepEqual(
    [before, (await row(shown, 1))[0], shown.binnacle.palette.state],
    ['#123456', 6, { inUse: 'mine/sea', shown: 'terminal', error: 'palette.json: no palette mine/sea' }],
  )
})

test('/palette, typed while the List is open, moves the mark to the palette in use, and draws it', async () => {
  const { app: shown, command } = await picking({ file: '{ "palette": "pi/dark" }' })
  await command()
  await shown.press('down')
  shown.binnacle.focus('composer.input')
  await command()
  assert.deepEqual([(await listed(shown))[1], shown.binnacle.palette.state.shown], ['› dark — pi', 'pi/dark'])
})

test('a pick that esc ended, and that settles after a new pick began, leaves the new pick waiting, and the new pick closes the List', async () => {
  const slow = slowSource('slow', ['one'])
  const { app: shown, command, file } = await picking({ file: '{}', more: { plugins: [slow.plugin] } })
  await command()
  await shown.press('pagedown')
  await shown.press('pagedown')
  slow.waiting.shift()!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('enter')
  await shown.press('escape')
  shown.binnacle.focus('composer.input')
  await command()
  await shown.press('pagedown')
  await shown.press('pagedown')
  slow.waiting.splice(1, 1)[0]!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('enter')
  const [ended, picked] = slow.waiting.splice(0)
  ended!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  await shown.press('up')
  const waiting = [shown.binnacle.modelOf<{ picking: boolean }>('palette.picker').state?.picking, (await listed(shown)).at(-1)]
  picked!.resolve({ colors: { accent: 'red' } })
  await settled(shown)
  assert.deepEqual(
    [waiting, JSON.parse(file()), (await shown.screen()).slice(-3)],
    [[true, '› one — slow'], { palette: 'slow/one' }, [RULE, ' ', RULE]],
  )
})

test('a pick whose write fails leaves the palette in use as the file names it, and the status line says why', async () => {
  const { app: shown, command, file, profile } = await picking({ file: '{}' })
  chmodSync(join(profile, 'palette.json'), 0o444)
  await command()
  await shown.press('down')
  await shown.press('enter')
  const { inUse, error } = shown.binnacle.palette.state
  assert.deepEqual([file(), inUse, error?.startsWith('palette.json: cannot be written: ')], ['{}', 'terminal', true])
})

test('a pi palette gives each Hue that its vars do not name the terminal’s own, over a plugin’s Hue', async () => {
  const plugin = {
    name: 'hues',
    inject: ['binnacle'],
    apply: (ctx: Context) => void ctx.binnacle.theme({ hues: { orange: '#123456', cyan: '#112233' } }),
  }
  const { app: shown } = await picking({
    file: '{ "palette": "pi/dark", "colors": { "a": "orange", "b": "cyan" } }',
    tones: ['a', 'b'],
    more: { plugins: [plugin] },
  })
  assert.deepEqual(await row(shown, 2), [208, 6])
})

test('the first draw waits for a palette that loads within 100 ms, and draws in it', async () => {
  const slow = slowSource('slow', ['one'])
  const seen: unknown[] = []
  const recorder = {
    name: 'recorder',
    inject: ['binnacle'],
    apply: (ctx: Context) => {
      ctx.binnacle.place('transcript', {
        lines: () => {
          seen.push(ctx.binnacle.tokens.colors.mdHeading.color)
          return ['x']
        },
      })
    },
  }
  const { app: shown } = await picking({ file: '{ "palette": "slow/one" }', more: { plugins: [slow.plugin, recorder] } })
  const before = seen.length
  slow.waiting.shift()!.resolve({ colors: { mdHeading: '#123456' } })
  await settled(shown)
  assert.deepEqual([before, seen[0], shown.binnacle.palette.state.shown], [0, '#123456', 'slow/one'])
})

test('a pi theme that leaves out an optional colour takes pi’s fallback for it, as thinkingMax takes thinkingXhigh', async () => {
  const { app: shown } = await picking({
    file: '{ "palette": "pi-themes/mine" }',
    themes: { 'mine.json': piTheme({ thinkingXhigh: '#123456' }, ['thinkingMax']) },
    tones: ['thinkingMax', 'thinkingXhigh'],
  })
  assert.deepEqual(await row(shown, 2), ['#123456', '#123456'])
})

test('a pi theme that has not each colour that pi asks of a theme does not load, and says which', async () => {
  const { app: shown } = await picking({
    file: '{ "palette": "pi-themes/bad" }',
    themes: { 'bad.json': piTheme({}, ['mdHeading', 'bashMode']) },
  })
  assert.deepEqual(
    [shown.binnacle.palette.state.shown, shown.binnacle.palette.state.error],
    ['terminal', 'palette.json: pi-themes/bad: not a pi theme: it has no mdHeading, bashMode'],
  )
})
