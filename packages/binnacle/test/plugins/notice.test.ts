import { afterEach, beforeEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Context } from '@deepseek-ai/cordis'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as notice from '../../src/plugins/notice/index.ts'
import { newer } from '../../src/plugins/notice/index.ts'
import type { UpdateLook } from '../../src/plugins/notice/index.ts'
import { mount } from '../../src/testing/index.ts'
import type { Mounted } from '../../src/testing/index.ts'

const own = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }

let dir: string
let server: Server
let latest: string
let asked: number
let app: Mounted | undefined

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'binnacle-notice-'))
  asked = 0
  // npm's `latest` of the package, as the registry gives it.
  server = createServer((_request, response) => {
    asked += 1
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ name: '@easeshine/binnacle', version: latest }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
})

afterEach(async () => {
  await app?.close()
  app = undefined
  await new Promise((resolve) => server.close(resolve))
  rmSync(dir, { recursive: true, force: true })
})

const url = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/latest`
const told = () => join(dir, 'notice.json')

async function started(more: object[] = [], at = url()) {
  await app?.close()
  app = await mount({
    size: { columns: 80, rows: 12 },
    builtins: ['binnacle-transcript'],
    stored: { id: 'session-stored', events: [{ seq: 0, type: 'test/one', time: 1, data: {} }] as never },
    plugins: [[notice, { latest: at, told: told() }], ...more] as never,
  })
  return app
}

// The check is asked in the background, so the screen is read until it settles.
async function settledScreen(shown: Mounted): Promise<string[]> {
  for (let tries = 0; tries < 50; tries += 1) {
    const rows = await shown.screen()
    if (asked > 0 && rows.some((row) => row.includes('Update Available'))) return rows
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return shown.screen()
}

test('versions are ordered as semver orders them, a release after its prereleases', () => {
  assert.deepEqual(
    [
      newer('0.2.0', '0.1.9'),
      newer('0.1.0', '0.1.0'),
      newer('0.1.0', '0.1.0-rc.1'),
      newer('0.1.0-rc.2', '0.1.0-rc.10'),
      newer('0.0.9', '0.1.0'),
      newer('x', '0.1.0'),
    ],
    [true, false, true, false, false, false],
  )
})

test('a newer version on npm is told above the first event, with what to run and where the changes are', async () => {
  latest = '99.0.0'
  const rows = await settledScreen(await started())
  assert.deepEqual(rows.slice(0, 7), [
    '─'.repeat(80),
    ' Update Available',
    ' New version 99.0.0 is available. Run npm install -g @easeshine/binnacle',
    ' Changelog: https://github.com/easeshine/binnacle/releases',
    '─'.repeat(80),
    '',
    '▾ #0 test/one',
  ])
})

test('each version is told once: the next start says nothing of it, and a newer one is told again', async () => {
  latest = '99.0.0'
  await settledScreen(await started())
  assert.deepEqual(JSON.parse(readFileSync(told(), 'utf8')), { told: '99.0.0' })
  const again = await settledScreen(await started())
  assert.equal(again[0], '▾ #0 test/one')
  latest = '99.1.0'
  assert.equal((await settledScreen(await started()))[1], ' Update Available')
})

test('the version that runs, or an older one, is not told', async () => {
  latest = own.version
  const shown = await started()
  const rows = await settledScreen(shown)
  assert.equal(asked, 1)
  assert.equal(rows[0], '▾ #0 test/one')
})

test('npm that cannot be reached tells nothing, and the version stays untold', async () => {
  latest = '99.0.0'
  const gone = url()
  await new Promise((resolve) => server.close(resolve))
  writeFileSync(told(), JSON.stringify({ told: '1.0.0' }))
  const rows = await settledScreen(await started([], gone))
  assert.equal(rows[0], '▾ #0 test/one')
  assert.deepEqual(JSON.parse(readFileSync(told(), 'utf8')), { told: '1.0.0' })
  server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
})

test("an author draws the notice through the Look notice.update, given the update and the transcript's width", async () => {
  latest = '99.0.0'
  const given: Parameters<UpdateLook>[] = []
  const author = {
    name: 'author',
    inject: ['binnacle'],
    apply: (ctx: Context) => {
      ctx.binnacle.look<UpdateLook>('notice.update', () => (update, width) => {
        given.push([update, width])
        return [`binnacle ${update.version} is out`]
      })
    },
  }
  const shown = await started([author])
  for (let tries = 0; tries < 50 && given.length === 0; tries += 1) await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual((await shown.screen()).slice(0, 2), ['binnacle 99.0.0 is out', '▾ #0 test/one'])
  assert.deepEqual(given.at(-1), [
    {
      version: '99.0.0',
      current: own.version,
      command: 'npm install -g @easeshine/binnacle',
      changelog: 'https://github.com/easeshine/binnacle/releases',
    },
    80,
  ])
})

test('the test kit loads the notice with every built-in, and it asks npm nothing', async () => {
  app = await mount({ size: { columns: 60, rows: 6 } })
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(asked, 0)
})
