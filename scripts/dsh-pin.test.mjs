import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import semver from 'semver'

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const OPTIONS = { includePrerelease: true }

// An agent reads dsh's source in .refs/dsh, so it must be the dsh that binnacle tests on, and one that its peers allow.
test("the dsh Reference's tag is the dsh that binnacle tests with, and each of binnacle's peers on dsh and cordis allows what it tests with", () => {
  const version = read('references.json').dsh.tag.replace(/^dsh-v/, '')
  const pkg = read('packages/binnacle/package.json')
  const dsh = Object.entries(pkg.devDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
  assert.ok(dsh.length > 1)
  assert.deepEqual(
    dsh.filter(([, pin]) => pin !== version),
    [],
  )
  const peers = Object.entries(pkg.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/'))
  assert.deepEqual(
    peers.filter(([name, range]) => !semver.satisfies(pkg.devDependencies[name] ?? '', range, OPTIONS)),
    [],
  )
})
