// A Spec is `intents/<slug>/spec.md`. Its Parts are the numbered items under `## Parts of the build`,
// and an item runs until the next line that starts at the margin.
import { join } from 'node:path'

export const PARTS = '## Parts of the build'

export function specPath(slug) {
  return join('intents', slug, 'spec.md')
}

export function section(body, heading) {
  const lines = body.split('\n')
  const at = lines.findIndex((line) => line.trim() === heading)
  if (at === -1) return ''
  const end = lines.findIndex((line, index) => index > at && line.startsWith('## '))
  return lines
    .slice(at + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
}

export function partsOf(spec) {
  const parts = []
  let current
  for (const line of section(spec, PARTS).split('\n')) {
    const start = /^(\d+)\. (.*)$/.exec(line)
    if (start !== null) {
      current = { k: Number(start[1]), lines: [start[2]] }
      parts.push(current)
    } else if (current !== undefined && (line === '' || /^\s/.test(line))) current.lines.push(line)
    else current = undefined
  }
  return parts.map(({ k, lines }) => ({ k, text: lines.join('\n').trim() }))
}

export function titleOf(spec) {
  const heading = spec.split('\n').find((line) => line.startsWith('# '))
  return heading === undefined
    ? ''
    : heading
        .slice(2)
        .replace(/^Spec: /, '')
        .trim()
}

// A Part may name its own Door. Without one, it takes its Spec's.
export function doorOf(part, spec) {
  const own = /\b(one|two)-way\b/i.exec(part)
  if (own !== null) return `${own[1].toLowerCase()}-way`
  const word = section(spec, '## Door')
    .split(/[\s.,:]/)[0]
    .toLowerCase()
  return word === 'one-way' || word === 'two-way' ? word : undefined
}
