import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PACKAGE } from '../src/core/name.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test("the core's name for the package is the name in package.json", () => {
  assert.equal(PACKAGE, JSON.parse(read('package.json')).name)
})

test("each of binnacle's rows in cordis.patch.yml names the package, or one of the package's exports", () => {
  const exports = Object.keys(JSON.parse(read('package.json')).exports as object)
  const names = [...read('cordis.patch.yml').matchAll(/- id: binnacle\S*\n\s+name: '([^']+)'$/gm)].map(([, name]) => name!)
  assert.ok(names.length > 1)
  assert.deepEqual(
    names.filter((name) => !exports.includes(name === PACKAGE ? '.' : `.${name.slice(PACKAGE.length)}`)),
    [],
  )
})
