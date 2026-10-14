import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import type { Binnacle } from '../../src/api.ts'
import { createModel, internals } from '../../src/index.ts'
import { copyToClipboard } from '../../src/plugins/copy/clipboard.ts'
import type { CopyState } from '../../src/plugins/copy/index.ts'
import { mount } from '../../src/testing/index.ts'
import type { Mounted } from '../../src/testing/index.ts'
import { FakeSystem } from '../support/mount.ts'
import type { FakeTool } from '../../src/testing/core.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const OSC52 = (text: string) => `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`

const copied = async (system: FakeSystem, text = 'é path') => ({
  copied: await copyToClipboard(text, system, new AbortController().signal),
  ran: system.ran.map(({ command, input }) => `${command} ${input ?? ''}`.trim()),
  written: system.written,
})

const systemOf = (
  platform: string,
  env: Record<string, string> = {},
  tools: Record<string, FakeTool> = {},
  files: Record<string, string> = {},
) => new FakeSystem({ platform, env, tools, files })

test('on macOS a copy runs pbcopy with the text on its stdin, and says it copied', async () => {
  assert.deepEqual(await copied(systemOf('darwin', {}, { pbcopy: '' })), {
    copied: { outcome: 'copied' },
    ran: ['pbcopy é path'],
    written: [],
  })
})

test('on Linux a copy tries termux-clipboard-set in Termux, wl-copy under Wayland, then xclip, then xsel, and the first that works wins', async () => {
  const env = { TERMUX_VERSION: '1', WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }
  const tools: Record<string, FakeTool> = { 'termux-clipboard-set': 'fails', 'wl-copy': 'fails', xclip: 'fails', xsel: '' }
  assert.deepEqual((await copied(systemOf('linux', env, tools))).ran, [
    'termux-clipboard-set é path',
    'wl-copy é path',
    'xclip é path',
    'xsel é path',
  ])
})

test('a tool that hangs is killed after 3 seconds, and hands on to the next', async () => {
  const system = systemOf('linux', { DISPLAY: ':0' }, { xclip: 'hangs', xsel: '' })
  const later = internals.later
  const timers: { ms: number; run: () => void }[] = []
  internals.later = (ms, run) => {
    timers.push({ ms, run })
    return () => {}
  }
  try {
    const copying = copyToClipboard('text', system, new AbortController().signal)
    await Promise.resolve()
    for (const { run } of timers) run()
    assert.deepEqual(
      [await copying, timers.map(({ ms }) => ms), system.ran.map(({ command }) => command)],
      [{ outcome: 'copied' }, [3000], ['xclip', 'xsel']],
    )
  } finally {
    internals.later = later
  }
})

test('on Windows a copy writes the text to a temporary UTF-8 file that PowerShell reads into Set-Clipboard, and removes the file after', async () => {
  const system = systemOf('win32', {}, { 'powershell.exe': '' })
  const done = await copyToClipboard("it's é", system, new AbortController().signal)
  const [run] = system.ran
  assert.deepEqual(
    [done, run?.command, run?.args.at(-1), system.files.size],
    [
      { outcome: 'copied' },
      'powershell.exe',
      "Set-Clipboard -Value ([System.IO.File]::ReadAllText('/tmp/binnacle-copy-1.txt', [System.Text.Encoding]::UTF8))",
      0,
    ],
  )
})

test('in WSL with no display, PowerShell reads the file at the Windows path that wslpath gives', async () => {
  const system = systemOf(
    'linux',
    {},
    { wslpath: "C:\\Users\\o'neil\\t.txt\n", 'powershell.exe': '' },
    { '/proc/version': 'Linux 5.15 microsoft-standard-WSL2' },
  )
  const done = await copyToClipboard('text', system, new AbortController().signal)
  assert.deepEqual(
    [done, system.ran.map(({ command }) => command), system.ran[1]?.args.at(-1)],
    [
      { outcome: 'copied' },
      ['wslpath', 'powershell.exe'],
      "Set-Clipboard -Value ([System.IO.File]::ReadAllText('C:\\Users\\o''neil\\t.txt', [System.Text.Encoding]::UTF8))",
    ],
  )
})

test('with no tool, a copy asks the terminal with OSC 52 and says it was sent; over SSH it asks the terminal after a tool copied too', async () => {
  const none = await copied(systemOf('linux'))
  const remote = await copied(systemOf('darwin', { SSH_CONNECTION: '1 2 3 4' }, { pbcopy: '' }))
  assert.deepEqual(
    [none, remote],
    [
      { copied: { outcome: 'sent' }, ran: [], written: [OSC52('é path')] },
      { copied: { outcome: 'copied' }, ran: ['pbcopy é path'], written: [OSC52('é path')] },
    ],
  )
})

test('a copy whose OSC 52 would be longer than 100 000 bytes of base64, where no tool copied it, fails as too long for the terminal', async () => {
  const done = await copied(systemOf('linux'), 'x'.repeat(75_001))
  assert.deepEqual([done.copied, done.written], [{ outcome: 'failed', reason: 'too long for the terminal' }, []])
})

async function withStatus(author: (binnacle: Binnacle) => void = () => {}) {
  app = await mount({
    size: { columns: 60, rows: 2 },
    builtins: ['binnacle-copy', 'binnacle-status-line'],
    plugins: [{ name: 'author', inject: ['binnacle'], apply: (ctx: Context) => void author(ctx.binnacle) }],
  })
  return app
}

test('after a copy, the status line says `copied` for two seconds, in the success Tone', async () => {
  const shown = await withStatus((binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world'] })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 4, y: 0 })
  const copiedRow = (await shown.screen())[1]
  const colour = (await shown.style(22, 1)).colour
  await shown.clock.pass(2000)
  assert.deepEqual(
    [copiedRow, colour, (await shown.screen())[1], shown.copied],
    ['idle · deepseek-v4 · copied', 2, 'idle · deepseek-v4', ['hello']],
  )
})

test('the status line says why a copy failed for five seconds, and that a copy was only sent to the terminal for two', async () => {
  const copy = createModel<CopyState>({})
  const shown = await withStatus((binnacle) => {
    binnacle.model('copy', copy)
  })
  copy.set((state) => {
    Object.assign(state, { last: { outcome: 'failed', reason: 'too long for the terminal', at: shown.clock.now } })
  })
  const failed = (await shown.screen())[1]
  await shown.clock.pass(4000)
  const still = (await shown.screen())[1]
  await shown.clock.pass(1000)
  const gone = (await shown.screen())[1]
  copy.set((state) => {
    Object.assign(state, { last: { outcome: 'sent', at: shown.clock.now } })
  })
  assert.deepEqual(
    [failed, still, gone, (await shown.screen())[1]],
    [
      'idle · deepseek-v4 · copy failed: too long for the terminal',
      'idle · deepseek-v4 · copy failed: too long for the terminal',
      'idle · deepseek-v4',
      'idle · deepseek-v4 · sent to the terminal',
    ],
  )
})

test('a copy whose tools are stopped, as when its row unloads, writes nothing to the terminal', async () => {
  const system = systemOf('linux', { DISPLAY: ':0' }, { xclip: 'hangs', xsel: 'hangs' })
  const stop = new AbortController()
  const copying = copyToClipboard('text', system, stop.signal)
  await Promise.resolve()
  stop.abort()
  assert.deepEqual([await copying, system.written], [{ outcome: 'failed', reason: 'stopped' }, []])
})

test('the model `copy` goes with its row', async () => {
  const shown = await withStatus((binnacle) => {
    binnacle.place('transcript', { lines: () => ['hello world'] })
  })
  await shown.drag({ x: 0, y: 0 }, { x: 4, y: 0 })
  await shown.unload('binnacle-copy')
  assert.deepEqual(shown.binnacle.modelOf<CopyState>('copy').state, undefined)
})
