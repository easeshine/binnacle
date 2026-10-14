import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

// A heading's anchor, as GitHub and the docs site make it.
const anchorOf = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replaceAll('`', '')
    .replace(/[^a-z0-9 -]/g, '')
    .replaceAll(' ', '-')

const markdown = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((path) => path !== '' && existsSync(join(root, path)))

// The docs site and the package both read these links, so each must find its file and its heading.
test('each relative link in a markdown file finds its file, and its heading when it names one', () => {
  const broken = []
  for (const path of markdown) {
    const text = readFileSync(join(root, path), 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/.test(target)) continue
      const [file, anchor] = target.split('#')
      const to = file === '' ? path : normalize(join(dirname(path), file))
      if (!existsSync(join(root, to))) {
        broken.push(`${path}: ${target}`)
        continue
      }
      if (anchor === undefined || !to.endsWith('.md')) continue
      const headings = [...readFileSync(join(root, to), 'utf8').matchAll(/^#+ (.*)$/gm)].map(([, heading]) => anchorOf(heading))
      if (!headings.includes(anchor)) broken.push(`${path}: ${target}`)
    }
  }
  assert.ok(markdown.length > 20)
  assert.deepEqual(broken, [])
})
