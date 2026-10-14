import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

// An agent reads dsh's source in .refs/dsh, so it must be the dsh that binnacle builds and tests on.
test("the dsh Reference's tag is the version of each dsh package that binnacle peers on and tests with", () => {
  const version = read('references.json').dsh.tag.replace(/^dsh-v/, '')
  const pkg = read('packages/binnacle/package.json')
  const pins = Object.entries({ ...pkg.peerDependencies, ...pkg.devDependencies }).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
  assert.ok(pins.length > 1)
  assert.deepEqual(
    pins.filter(([, pin]) => pin !== version),
    [],
  )
})
