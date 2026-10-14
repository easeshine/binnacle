import { afterEach, beforeEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { dshRange, launch, PROFILE } from '../src/command/launch.ts'
import { PACKAGE } from '../src/core/name.ts'

// A dsh that writes each call to a log, prints FAKE_DSH_VERSION, and installs a binnacle as pnpm would: a link for a checkout, a copy for a version.
const FAKE_DSH = `#!/usr/bin/env node
const { appendFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const args = process.argv.slice(2)
appendFileSync(process.env.FAKE_LOG, JSON.stringify(args) + '\\n')
if (args[0] === '--version') { console.log(process.env.FAKE_DSH_VERSION); process.exit(0) }
if (args[0] === 'plugin') {
  if (process.env.FAKE_ADD === 'fails') process.exit(3)
  if (process.env.FAKE_ADD === 'nothing') process.exit(0)
  const dir = join(process.env.DSH_HOME, 'profiles', args[2])
  const manifest = join(dir, 'package.json')
  const profile = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : { dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } } }
  const spec = args[4]
  const installed = join(dir, 'node_modules', '${PACKAGE}')
  rmSync(installed, { recursive: true, force: true })
  mkdirSync(join(dir, 'node_modules', '@easeshine'), { recursive: true })
  if (spec.startsWith('link:')) symlinkSync(spec.slice(5), installed)
  else { mkdirSync(installed); writeFileSync(join(installed, 'package.json'), JSON.stringify({ version: spec.split('@').at(-1) })) }
  const added = profile.dependencies === undefined || profile.dependencies['${PACKAGE}'] === undefined
  profile.dependencies = { ...profile.dependencies, '${PACKAGE}': spec.startsWith('link:') ? spec : spec.split('@').at(-1) }
  if (added && process.env.FAKE_ADD !== 'unbundled') profile.dsh.profile.bundles.push('${PACKAGE}')
  writeFileSync(manifest, JSON.stringify(profile))
}
`

let dir: string
let log: string
let home: string
let bin: string
let node: string

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-command-')))
  log = join(dir, 'log')
  home = join(dir, 'home')
  bin = join(dir, 'bin')
  node = join(dir, 'node')
  mkdirSync(bin)
  mkdirSync(node)
  symlinkSync(process.execPath, join(node, 'node'))
  writeFileSync(log, '')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

function tool(name: string, text: string) {
  writeFileSync(join(bin, name), text)
  chmodSync(join(bin, name), 0o755)
}

const withDsh = () => tool('dsh', FAKE_DSH)
const withPnpm = () => tool('pnpm', '#!/bin/sh\nexit 0\n')

// A binnacle as npm installs it, in a node_modules, or as a checkout, which is in none.
function binnacle(version: string, where: 'npm' | 'checkout' = 'npm'): string {
  const at = where === 'npm' ? join(dir, 'global', 'node_modules', '@easeshine', 'binnacle') : join(dir, 'checkout')
  mkdirSync(at, { recursive: true })
  const peerDependencies = {
    '@deepseek-ai/cordis': '4.0.5-alpha.1',
    '@deepseek-ai/dsh-agent': '0.2.1-alpha.1',
    '@deepseek-ai/dsh-llm': '0.2.1-alpha.1',
  }
  writeFileSync(join(at, 'package.json'), JSON.stringify({ name: PACKAGE, version, peerDependencies }))
  return at
}

async function binnacleRuns(packageDir: string, argv: string[], env: Record<string, string> = {}) {
  const said: string[] = []
  const printed: string[] = []
  const started: string[][] = []
  const code = await launch({
    argv,
    packageDir,
    // node, for the fake dsh's first line, and no other command of the machine's.
    env: { PATH: [bin, node].join(delimiter), DSH_HOME: home, FAKE_LOG: log, FAKE_DSH_VERSION: '0.2.1-alpha.1', ...env },
    platform: process.platform,
    print: (line) => printed.push(line),
    say: (line) => said.push(line),
    start: async (dsh, args) => {
      started.push([dsh, ...args])
      return 0
    },
  })
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as string[])
  writeFileSync(log, '')
  return { code, said, printed, started, calls }
}

const profile = () =>
  JSON.parse(readFileSync(join(home, 'profiles', PROFILE, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }

test("binnacle's dsh versions are the ranges of its peers on dsh's packages, and not on cordis", () => {
  assert.equal(
    dshRange({ peerDependencies: { '@deepseek-ai/cordis': '4.0.5', '@deepseek-ai/dsh-agent': '0.2.1', '@deepseek-ai/dsh-llm': '0.2.1' } }),
    '0.2.1',
  )
  assert.equal(dshRange({ peerDependencies: { '@deepseek-ai/dsh-agent': '>=0.2.1', '@deepseek-ai/dsh': '<0.3.0' } }), '>=0.2.1 <0.3.0')
})

test('on the first run, binnacle installs its own version into its profile, then starts dsh with it and the flags', async () => {
  withDsh()
  withPnpm()
  const run = await binnacleRuns(binnacle('1.2.3'), ['--session', 'abc'])
  assert.equal(run.code, 0)
  assert.deepEqual(run.said, [`binnacle: installing binnacle 1.2.3 into its dsh profile, ${PROFILE}`])
  assert.deepEqual(run.calls, [['--version'], ['plugin', '--profile', PROFILE, 'add', `${PACKAGE}@1.2.3`]])
  assert.deepEqual(run.started, [[join(bin, 'dsh'), '--profile', PROFILE, '--session', 'abc']])
})

test('on the next run at the same version, binnacle says nothing and installs nothing', async () => {
  withDsh()
  withPnpm()
  const at = binnacle('1.2.3')
  await binnacleRuns(at, [])
  const run = await binnacleRuns(at, [])
  assert.deepEqual(run.said, [])
  assert.deepEqual(run.calls, [['--version']])
  assert.equal(run.started.length, 1)
})

test('when the profile has another version, binnacle says both and installs its own', async () => {
  withDsh()
  withPnpm()
  await binnacleRuns(binnacle('1.2.2'), [])
  const run = await binnacleRuns(binnacle('1.2.3'), [])
  assert.deepEqual(run.said, [`binnacle: the dsh profile ${PROFILE} has binnacle 1.2.2, and this is binnacle 1.2.3: installing it`])
  assert.equal(profile().dependencies[PACKAGE], '1.2.3')
  assert.equal(run.started.length, 1)
})

test('binnacle from a checkout links the checkout into its profile', async () => {
  withDsh()
  withPnpm()
  const at = binnacle('0.0.0', 'checkout')
  const first = await binnacleRuns(at, [])
  assert.deepEqual(first.said, [`binnacle: installing binnacle's checkout at ${at} into its dsh profile, ${PROFILE}`])
  assert.deepEqual(first.calls.at(-1), ['plugin', '--profile', PROFILE, 'add', `link:${at}`])
  const next = await binnacleRuns(at, [])
  assert.deepEqual(next.said, [])
  const released = await binnacleRuns(binnacle('1.2.3'), [])
  assert.deepEqual(released.said, [
    `binnacle: the dsh profile ${PROFILE} has binnacle's checkout at ${at}, and this is binnacle 1.2.3: installing it`,
  ])
})

test('with no dsh, binnacle says which dsh to install, and starts nothing', async () => {
  const run = await binnacleRuns(binnacle('1.2.3'), [])
  assert.equal(run.code, 1)
  assert.deepEqual(run.said, [
    'binnacle: binnacle 1.2.3 runs on dsh 0.2.1-alpha.1, and dsh is not installed. Install it: npm install -g @deepseek-ai/dsh@0.2.1-alpha.1',
  ])
  assert.deepEqual(run.started, [])
})

test('with a dsh that binnacle does not run on, binnacle says what to install, and neither installs nor starts', async () => {
  withDsh()
  withPnpm()
  const run = await binnacleRuns(binnacle('1.2.3'), [], { FAKE_DSH_VERSION: '0.2.2' })
  assert.equal(run.code, 1)
  assert.deepEqual(run.said, [
    'binnacle: binnacle 1.2.3 runs on dsh 0.2.1-alpha.1, and dsh is 0.2.2.',
    'Install the dsh that binnacle runs on: npm install -g @deepseek-ai/dsh@0.2.1-alpha.1. Or install a binnacle that runs on dsh 0.2.2.',
  ])
  assert.deepEqual(run.calls, [['--version']])
  assert.deepEqual(run.started, [])
})

test('with no pnpm, binnacle says to install it when it must install, and starts without it when it need not', async () => {
  withDsh()
  const at = binnacle('1.2.3')
  const run = await binnacleRuns(at, [])
  assert.equal(run.code, 1)
  assert.equal(
    run.said.at(-1),
    'binnacle: dsh installs binnacle with pnpm, and pnpm is not installed. Install it: https://pnpm.io/installation',
  )
  assert.deepEqual(run.started, [])
  withPnpm()
  await binnacleRuns(at, [])
  rmSync(join(bin, 'pnpm'))
  assert.equal((await binnacleRuns(at, [])).started.length, 1)
})

test('a profile by its name that does not depend on binnacle is left as it is', async () => {
  withDsh()
  withPnpm()
  const profileDir = join(home, 'profiles', PROFILE)
  mkdirSync(profileDir, { recursive: true })
  const theirs = JSON.stringify({ dependencies: { binnacle: 'link:/elsewhere' } })
  writeFileSync(join(profileDir, 'package.json'), theirs)
  const run = await binnacleRuns(binnacle('1.2.3'), [])
  assert.equal(run.code, 1)
  assert.deepEqual(run.said, [
    `binnacle: the dsh profile ${PROFILE}, at ${profileDir}, is not binnacle's: it does not depend on ${PACKAGE}.`,
    'binnacle changes no profile it did not make. Move that folder away, and binnacle makes its own.',
  ])
  assert.equal(readFileSync(join(profileDir, 'package.json'), 'utf8'), theirs)
  assert.deepEqual(run.started, [])
})

test('an install that fails, or that leaves another binnacle, is said, and binnacle starts nothing', async () => {
  withDsh()
  withPnpm()
  const failed = await binnacleRuns(binnacle('1.2.3'), [], { FAKE_ADD: 'fails' })
  assert.equal(failed.code, 3)
  assert.equal(failed.said.at(-1), `binnacle: dsh could not install binnacle 1.2.3 into the profile ${PROFILE}; it says why above.`)
  const unchanged = await binnacleRuns(binnacle('1.2.3'), [], { FAKE_ADD: 'nothing' })
  assert.equal(unchanged.code, 1)
  assert.deepEqual(unchanged.said.slice(1), [
    `binnacle: after the install, the dsh profile ${PROFILE} has no binnacle.`,
    `Install it yourself: dsh plugin --profile ${PROFILE} add ${PACKAGE}@1.2.3`,
  ])
  assert.deepEqual([...failed.started, ...unchanged.started], [])
})

test('a profile that does not load binnacle is said, with where to add it', async () => {
  withDsh()
  withPnpm()
  const run = await binnacleRuns(binnacle('1.2.3'), [], { FAKE_ADD: 'unbundled' })
  assert.equal(run.code, 1)
  const manifest = join(home, 'profiles', PROFILE, 'package.json')
  assert.equal(
    run.said.at(-1),
    `binnacle: the dsh profile ${PROFILE} does not load binnacle. Add "${PACKAGE}" to dsh.profile.bundles in ${manifest}.`,
  )
  assert.deepEqual(run.started, [])
})

test('--version says the version, and needs no dsh', async () => {
  const run = await binnacleRuns(binnacle('1.2.3'), ['--version'])
  assert.deepEqual(run.printed, ['binnacle 1.2.3'])
  assert.deepEqual(run.said, [])
  assert.equal(existsSync(home), false)
})
