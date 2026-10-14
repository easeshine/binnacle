import { afterAll, beforeAll, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const kept = [
  'toPlainText',
  'visibleWidth',
  'truncateToWidth',
  'createModel',
  'list',
  'line',
  'tabs',
  'title',
  'wrap',
  'CHAT_LAYOUT',
  'Editor',
  'CURSOR_MARKER',
]

let into: string
let files: string[]
let unpacked: string

beforeAll(() => {
  // Under the package's own node_modules, so that the unpacked dist resolves its dependencies as an installed one does.
  into = mkdtempSync(join(root, 'node_modules', '.packed-'))
  execFileSync('pnpm', ['pack', '--pack-destination', into], { cwd: root, stdio: 'ignore' })
  const tarball = join(
    into,
    readdirSync(into).find((name) => name.endsWith('.tgz'))!,
  )
  files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path !== '')
    .map((path) => path.replace(/^package\//, ''))
  execFileSync('tar', ['-xzf', tarball, '-C', into])
  unpacked = join(into, 'package')
})

afterAll(() => rmSync(into, { recursive: true, force: true }))

const read = (path: string) => readFileSync(join(unpacked, path), 'utf8')
// Every page for authors, as one text.
const guide = () =>
  files
    .filter((path) => path.startsWith('docs/author/') && path.endsWith('.md'))
    .map(read)
    .join('\n')

test("the packed package holds the docs, the skill and the built-ins' source, and no note for binnacle's own agents", () => {
  const plugins = Object.keys(JSON.parse(read('package.json')).exports as object)
    .filter((path) => path.startsWith('./plugins/'))
    .map((path) => `src${path.slice(1)}/index.ts`)
  const wanted = [
    'docs/use/index.md',
    'docs/author/index.md',
    'docs/glossary.md',
    'skills/binnacle/SKILL.md',
    'src/index.ts',
    'src/api.ts',
    'src/kit/list.ts',
    'dist/index.mjs',
    'dist/index.d.mts',
    ...plugins,
  ]
  assert.ok(plugins.length > 0)
  assert.deepEqual([wanted.filter((path) => !files.includes(path)), files.filter((path) => path.endsWith('AGENTS.md'))], [[], []])
})

test("the packed export map gives what the Kit keeps, the composer's editor, and not pi-tui's Input", async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const index = await import(pathToFileURL(join(unpacked, exports['.']!)).href)
  assert.deepEqual(
    kept.filter((name) => !(name in index)),
    [],
  )
  assert.deepEqual(
    ['Input'].filter((name) => name in index),
    [],
  )
})

test("the packed Requests' view gives what an author builds on, and the docs for authors name each", async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const view = await import(pathToFileURL(join(unpacked, exports['./plugins/requests-view']!)).href)
  const built = ['REQUEST_LAYOUT', 'titleOf', 'itemsOf', 'pick', 'advance', 'keyOf']
  assert.deepEqual(
    built.filter((name) => !(name in view) || !guide().includes(name)),
    [],
  )
})

test('the packed transcript gives its readers of an event, and the docs for authors name each', async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const transcript = await import(pathToFileURL(join(unpacked, exports['./plugins/transcript']!)).href)
  const readers = ['textOf', 'reasoningOf', 'callOf', 'producerOf', 'noticeOf', 'isPrompt', 'failed', 'withoutReasoning']
  assert.deepEqual(
    readers.filter((name) => typeof transcript[name] !== 'function' || !guide().includes(`${name}(`)),
    [],
  )
})

test('the packed status line gives `STATUS_LAYOUT` to build on, and the docs for authors name it', async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const statusLine = await import(pathToFileURL(join(unpacked, exports['./plugins/status-line']!)).href)
  assert.deepEqual(
    [statusLine.STATUS_LAYOUT, guide().includes('STATUS_LAYOUT')],
    [{ row: [{ place: 'status.state' }, { place: 'status.model' }], separator: true }, true],
  )
})

test('the packed offer of commands gives `COMMANDS_LAYOUT` to build on, and the docs for authors name it', async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const offer = await import(pathToFileURL(join(unpacked, exports['./plugins/commands']!)).href)
  assert.deepEqual(
    [offer.COMMANDS_LAYOUT, guide().includes('COMMANDS_LAYOUT')],
    [{ place: 'commands.list', size: { most: 9 }, border: ['top'] }, true],
  )
})

test('the packed docs for authors name every member of the author API, every export, every Tone, and how to load a plugin in a profile', () => {
  const text = guide()
  // The bundle puts the author API in a chunk of its own, named by its hash.
  const api = files
    .filter((path) => path.endsWith('.d.mts'))
    .map(read)
    .find((types) => types.includes('interface Binnacle {'))!
  const binnacle = api.slice(api.indexOf('interface Binnacle {'))
  const members = [...binnacle.slice(0, binnacle.indexOf('\n}')).matchAll(/^ {2}(?:readonly )?(\w+)[<(:]/gm)].map(
    ([, name]) => `binnacle.${name}`,
  )
  const tones = [...api.match(/type Tone = ([^;]+);/)![1]!.matchAll(/'(\w+)'/g)].map(([, tone]) => tone!)
  const wanted = [
    ...members,
    ...kept.map((name) => (/^[a-z]/.test(name) ? `${name}(` : name)),
    ...tones.map((tone) => `\`${tone}\``),
    'cordis.patch.yml',
    'dsh --profile',
  ]
  assert.ok(members.length > 10)
  assert.deepEqual(
    wanted.filter((name) => !text.includes(name)),
    [],
  )
})

test('the packed `@easeshine/binnacle/testing` mounts the packed built-ins with no terminal, and the docs for authors show how to test a plugin with it', async () => {
  const exports = JSON.parse(read('package.json')).exports as Record<string, string>
  const testing = await import(pathToFileURL(join(unpacked, exports['./testing']!)).href)
  const mounted = await testing.mount({ size: { columns: 30, rows: 5 } })
  const rows = await mounted.screen()
  await mounted.close()
  assert.deepEqual([rows[1], guide().includes("import { mount } from '@easeshine/binnacle/testing'")], ['idle · deepseek-v4', true])
})
